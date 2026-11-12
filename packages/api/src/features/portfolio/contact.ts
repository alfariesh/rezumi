import { ORPCError } from "@orpc/server";
import { and, asc, desc, eq, isNull, lt, or, sql } from "drizzle-orm";
import z from "zod";
import { db } from "@rezumi/db/client";
import * as schema from "@rezumi/db/schema";
import { deliverPortfolioMessageNotice } from "@rezumi/email/portfolio";
import { env } from "@rezumi/env/server";
import { parsePortfolioData } from "@rezumi/schema/portfolio/data";
import { PORTFOLIO_MESSAGE_LIMITS, PORTFOLIO_MESSAGE_TRAP_FIELD } from "@rezumi/schema/portfolio/statistics";
import { rateLimitConfig } from "@rezumi/utils/rate-limit";
import { createRateLimiter } from "../../redis";
import { ownerIsNotBanned } from "../resume/access-policy";
import { rateLimitAddress } from "./client-address";
import { portfolioOwnsProfilePath } from "./public";
import { countMessage } from "./statistics";
import { dayInTimeZone } from "./traffic";
import { isContactFormConfigured, verifyTurnstileToken } from "./turnstile";
import { portfolioAccess } from "./visitor-access";

const message = schema.portfolioMessage;
const limits = rateLimitConfig.portfolioPublic;

const attemptLimiter = createRateLimiter("portfolioMessageAttempts", limits.messageAttempts);
const ipLimiter = createRateLimiter("portfolioMessagesPerIp", limits.messagesPerIp);
const portfolioLimiter = createRateLimiter("portfolioMessagesPerPortfolio", limits.messagesPerPortfolio);
const visitorLimiter = createRateLimiter("portfolioMessagesPerVisitor", limits.messagesPerVisitor);

export const passesLimit = async (limiter: typeof ipLimiter, key: string) =>
	env.FLAG_DISABLE_API_RATE_LIMIT || (await limiter.limit(key)).success;

const fieldsSchema = z.object({
	name: z
		.string()
		.transform((value) => value.replace(/\s+/g, " ").trim())
		.pipe(z.string().min(1).max(PORTFOLIO_MESSAGE_LIMITS.name)),
	email: z.string().trim().max(PORTFOLIO_MESSAGE_LIMITS.email).pipe(z.email()),
	body: z.string().trim().min(1).max(PORTFOLIO_MESSAGE_LIMITS.body),
	serviceId: z.string().trim().max(64).optional(),
});

/** Addresses in a message, which is what spam mostly is. */
const countLinks = (text: string) => text.match(/https?:\/\/|\bwww\./gi)?.length ?? 0;

export type PortfolioMessageForm = Readonly<Record<string, unknown>>;

export type PortfolioMessageResult =
	| { ok: true; portfolioId?: string }
	| { ok: false; code: "invalid" | "turnstile" | "rate_limited" | "unavailable" };

const fail = (code: Extract<PortfolioMessageResult, { ok: false }>["code"]) => ({ ok: false, code }) as const;

// Postgres text can't hold NUL, so a character no person types can't turn a message into a failed insert.
export const formField = (form: PortfolioMessageForm, name: string) =>
	typeof form[name] === "string" ? form[name].replaceAll("\0", "") : "";

/**
 * Takes a message from a portfolio's contact form (`02-teknis.md` section 10), or null when the address shows no
 * portfolio. The trap field answers success without storing, so a bot learns nothing. Turnstile comes after the cheap
 * checks, and only a message that passes it counts toward the limits, so failed attempts can't use up a portfolio's
 * daily allowance, and one visitor can use only part of it. The message itself is never logged.
 */
export async function submitPortfolioMessage(input: {
	username: string;
	form: PortfolioMessageForm;
	trustedClient?: string | undefined;
	/** The visitor's request, for the password gate: a portfolio they can't open takes no message. */
	requestHeaders?: Headers | undefined;
	now?: Date;
}): Promise<PortfolioMessageResult | null> {
	const [row] = await db
		.select({
			id: schema.portfolio.id,
			userId: schema.portfolio.userId,
			data: schema.portfolio.data,
			timeZone: schema.user.timezone,
			passwordHash: schema.portfolio.password,
		})
		.from(schema.portfolio)
		.innerJoin(schema.user, eq(schema.portfolio.userId, schema.user.id))
		.where(
			and(
				eq(schema.user.username, input.username.toLowerCase()),
				portfolioOwnsProfilePath(schema.user.id),
				ownerIsNotBanned(),
			),
		)
		.limit(1);
	if (!row) return null;

	// Behind a password, only a visitor who opened the portfolio can write to it (no new code: the form is just closed).
	if ((await portfolioAccess(row, input.requestHeaders ?? new Headers())) === "locked") return fail("unavailable");
	const data = parsePortfolioData(row.data);
	if (!data.contact.form || data.sections.hidden.includes("contact") || !isContactFormConfigured())
		return fail("unavailable");
	if (formField(input.form, PORTFOLIO_MESSAGE_TRAP_FIELD)) return { ok: true };

	const parsed = fieldsSchema.safeParse({
		name: formField(input.form, "name"),
		email: formField(input.form, "email"),
		body: formField(input.form, "message"),
		serviceId: formField(input.form, "serviceId") || undefined,
	});
	if (!parsed.success || countLinks(parsed.data.body) > PORTFOLIO_MESSAGE_LIMITS.links) return fail("invalid");

	// Per address (an IPv6 address by its /64); clients without one share a bucket.
	const client = `ip:${rateLimitAddress(input.trustedClient) ?? "unknown"}`;
	if (!(await passesLimit(attemptLimiter, client))) return fail("rate_limited");
	if (!(await verifyTurnstileToken(formField(input.form, "cf-turnstile-response"), input.trustedClient)))
		return fail("turnstile");
	if (!(await passesLimit(ipLimiter, client))) return fail("rate_limited");
	if (!(await passesLimit(visitorLimiter, `${row.id}:${client}`))) return fail("rate_limited");
	if (!(await passesLimit(portfolioLimiter, row.id))) return fail("rate_limited");

	const { name, email, body, serviceId } = parsed.data;
	const known = serviceId && data.services.items.some((service) => service.id === serviceId) ? serviceId : null;
	const now = input.now ?? new Date();
	await db.transaction(async (tx) => {
		await tx.insert(message).values({ portfolioId: row.id, name, email, body, serviceId: known, createdAt: now });
		await countMessage(tx, row.id, dayInTimeZone(now, row.timeZone));
	});
	return { ok: true, portfolioId: row.id };
}

const EMAIL_WINDOW_MS = 10 * 60 * 1000;

/**
 * Claims the right to email a portfolio's owner: at most one email per 10 minutes. The claim is one conditional update,
 * so of several messages arriving together exactly one sends.
 */
async function claimMessageEmail(portfolioId: string, now: Date): Promise<boolean> {
	const cutoff = new Date(now.getTime() - EMAIL_WINDOW_MS);
	const claimed = await db
		.update(schema.portfolio)
		.set({ messageEmailAt: now })
		.where(
			and(
				eq(schema.portfolio.id, portfolioId),
				or(isNull(schema.portfolio.messageEmailAt), lt(schema.portfolio.messageEmailAt, cutoff)),
			),
		)
		.returning({ id: schema.portfolio.id });
	return claimed.length > 0;
}

const releaseMessageEmail = (portfolioId: string, claim: Date) =>
	db
		.update(schema.portfolio)
		.set({ messageEmailAt: null })
		.where(and(eq(schema.portfolio.id, portfolioId), eq(schema.portfolio.messageEmailAt, claim)));

/**
 * Sends the email for a portfolio's messages not told about yet, if the 10-minute window allows it. One message goes
 * out in full with Reply-To set to its sender; several are merged into a count. A failed send keeps its claim, so the
 * job tries again when the 10 minutes are up, rather than every minute. Email that isn't set up leaves the messages
 * waiting the same way. Messages sent while the window is shut wait for the job. Delivery is at least once: when the
 * email went out but marking the messages failed (or the Worker stopped in between), the next window emails them again,
 * which beats an owner never hearing of a message.
 */
export async function notifyPortfolioMessages(portfolioId: string, now = new Date()): Promise<boolean> {
	if (!(await claimMessageEmail(portfolioId, now))) return false;
	try {
		const [owner] = await db
			.select({
				email: schema.user.email,
				data: schema.portfolio.data,
				locale: schema.billingAccount.locale,
			})
			.from(schema.portfolio)
			.innerJoin(schema.user, eq(schema.portfolio.userId, schema.user.id))
			.leftJoin(schema.billingAccount, eq(schema.billingAccount.userId, schema.user.id))
			.where(eq(schema.portfolio.id, portfolioId))
			.limit(1);
		const pending = await db
			.select({
				id: message.id,
				name: message.name,
				email: message.email,
				body: message.body,
				serviceId: message.serviceId,
			})
			.from(message)
			.where(and(eq(message.portfolioId, portfolioId), isNull(message.notifiedAt)))
			.orderBy(asc(message.createdAt));
		const first = pending[0];
		if (!owner || !first) {
			await releaseMessageEmail(portfolioId, now);
			return false;
		}
		const data = parsePortfolioData(owner.data);
		const service =
			pending.length === 1 && first.serviceId
				? (data.services.items.find((item) => item.id === first.serviceId)?.title.trim() ?? null)
				: null;
		const delivery = await deliverPortfolioMessageNotice({
			to: owner.email,
			notice: {
				lang: (owner.locale ?? data.locale ?? "id").startsWith("id") ? "id" : "en",
				count: pending.length,
				message: pending.length === 1 ? { name: first.name, email: first.email, body: first.body, service } : undefined,
				inboxUrl: new URL("/dashboard/portfolio", env.APP_URL).href,
			},
		});
		if (delivery === "unconfigured") return false;
		await db
			.update(message)
			.set({ notifiedAt: now })
			.where(
				sql`${message.id} in (${sql.join(
					pending.map((item) => sql`${item.id}`),
					sql`, `,
				)})`,
			);
		return true;
	} catch {
		console.error("[portfolio] Sending a message notification failed; it is tried again after the email window.");
		return false;
	}
}

const DIGESTS_PER_RUN = 20;

/** Sends the merged emails now due, longest waiting first: portfolios with messages waiting past their 10-minute window. */
export async function sendDueMessageEmails(now: Date): Promise<number> {
	const cutoff = new Date(now.getTime() - EMAIL_WINDOW_MS);
	const due = await db
		.select({ id: message.portfolioId })
		.from(message)
		.innerJoin(schema.portfolio, eq(message.portfolioId, schema.portfolio.id))
		.where(
			and(
				isNull(message.notifiedAt),
				or(isNull(schema.portfolio.messageEmailAt), lt(schema.portfolio.messageEmailAt, cutoff)),
			),
		)
		.groupBy(message.portfolioId)
		.orderBy(sql`min(${message.createdAt})`)
		.limit(DIGESTS_PER_RUN);
	let sent = 0;
	for (const { id } of due) if (await notifyPortfolioMessages(id, now)) sent += 1;
	return sent;
}

const RETENTION_BATCH = 500;

/** Deletes messages past their retention (owner decision #7), a batch per run. */
export async function deleteExpiredMessages(now: Date): Promise<number> {
	const cutoff = new Date(now.getTime() - PORTFOLIO_MESSAGE_LIMITS.retentionDays * 86_400_000);
	const expired = db
		.select({ id: message.id })
		.from(message)
		.where(lt(message.createdAt, cutoff))
		.limit(RETENTION_BATCH);
	const deleted = await db
		.delete(message)
		.where(sql`${message.id} in ${expired}`)
		.returning({ id: message.id });
	return deleted.length;
}

const DEFAULT_PAGE = 30;
const MAX_PAGE = 50;

export function parseCursor(cursor: string | undefined): { at: Date; id: string } | null {
	const separator = cursor?.indexOf("|") ?? -1;
	if (!cursor || separator < 0) return null;
	const at = new Date(cursor.slice(0, separator));
	return Number.isNaN(at.getTime()) ? null : { at, id: cursor.slice(separator + 1) };
}

/** The owner's inbox, newest first, a page at a time. */
export async function listPortfolioMessages(
	portfolio: { id: string; services: readonly { id: string; title: string }[] },
	input: { cursor?: string | undefined; limit?: number | undefined },
) {
	const limit = Math.min(input.limit ?? DEFAULT_PAGE, MAX_PAGE);
	const after = parseCursor(input.cursor);
	const rows = await db
		.select({
			id: message.id,
			name: message.name,
			email: message.email,
			body: message.body,
			serviceId: message.serviceId,
			createdAt: message.createdAt,
			readAt: message.readAt,
		})
		.from(message)
		.where(
			and(
				eq(message.portfolioId, portfolio.id),
				after
					? or(lt(message.createdAt, after.at), and(eq(message.createdAt, after.at), lt(message.id, after.id)))
					: undefined,
			),
		)
		.orderBy(desc(message.createdAt), desc(message.id))
		.limit(limit + 1);
	const [unread] = await db
		.select({ total: sql<number>`count(*)::int` })
		.from(message)
		.where(and(eq(message.portfolioId, portfolio.id), isNull(message.readAt)));
	const page = rows.slice(0, limit);
	const last = page.at(-1);
	return {
		items: page.map(({ serviceId, ...item }) => ({
			...item,
			serviceTitle: portfolio.services.find((service) => service.id === serviceId)?.title.trim() || null,
		})),
		unread: unread?.total ?? 0,
		nextCursor: rows.length > limit && last ? `${last.createdAt.toISOString()}|${last.id}` : null,
	};
}

/** Marks one of the owner's messages read or unread; another portfolio's ID is simply not found. */
export async function setPortfolioMessageRead(portfolioId: string, id: string, read: boolean, now = new Date()) {
	const updated = await db
		.update(message)
		.set({ readAt: read ? now : null })
		.where(and(eq(message.id, id), eq(message.portfolioId, portfolioId)))
		.returning({ id: message.id });
	if (updated.length === 0) throw new ORPCError("NOT_FOUND");
	return { ok: true as const };
}

export async function deletePortfolioMessage(portfolioId: string, id: string) {
	const deleted = await db
		.delete(message)
		.where(and(eq(message.id, id), eq(message.portfolioId, portfolioId)))
		.returning({ id: message.id });
	if (deleted.length === 0) throw new ORPCError("NOT_FOUND");
	return { ok: true as const };
}

/** The account's messages, for its data export. */
export function exportPortfolioMessages(userId: string) {
	return db
		.select({
			name: message.name,
			email: message.email,
			body: message.body,
			serviceId: message.serviceId,
			createdAt: message.createdAt,
			readAt: message.readAt,
		})
		.from(message)
		.innerJoin(schema.portfolio, eq(message.portfolioId, schema.portfolio.id))
		.where(eq(schema.portfolio.userId, userId))
		.orderBy(desc(message.createdAt));
}
