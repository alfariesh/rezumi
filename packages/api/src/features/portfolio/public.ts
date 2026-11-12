import type { PortfolioData } from "@rezumi/schema/portfolio/data";
import type { PortfolioEventKind } from "@rezumi/schema/portfolio/statistics";
import type { ResumeData } from "@rezumi/schema/resume/data";
import type { SQL, SQLWrapper } from "drizzle-orm";
import { and, asc, count, eq, isNull, sql } from "drizzle-orm";
import { isbot } from "isbot";
import { db } from "@rezumi/db/client";
import * as schema from "@rezumi/db/schema";
import { env } from "@rezumi/env/server";
import { parsePortfolioData } from "@rezumi/schema/portfolio/data";
import { PORTFOLIO_NEW_ACCOUNT_NOINDEX_DAYS } from "@rezumi/schema/portfolio/limits";
import { rateLimitConfig } from "@rezumi/utils/rate-limit";
import { createRateLimiter } from "../../redis";
import { getEntitlements } from "../billing/entitlements";
import { domainIsLive, isCustomDomainsEnabled, ownHosts } from "../custom-domain/service";
import { isOwner, ownerIsNotBanned, resolveViewer } from "../resume/access-policy";
import { parseStoredResumeData } from "../resume/resume-data-validation";
import { isFirstVisitThisHour } from "../resume/view-dedup";
import { writePortfolioEvent } from "./analytics";
import { getPortfolioMode } from "./mode";
import { countClick, countVisit, countWorkOpen } from "./statistics";
import { dayInTimeZone, deviceClass, referrerDomain, visitorKey, visitSource } from "./traffic";

/**
 * Who `/<username>` belongs to (`02-teknis.md` section 6), as a query condition on an account id: true when the account
 * has a published portfolio that isn't suspended and that the switch (`PORTFOLIO_MODE`) lets its owner show. Then the
 * short address, the custom domain and the link preview are the portfolio's, and the primary resume moves to its own
 * address, `/<username>/<slug>`. The one rule every caller uses: the portfolio page, the resume page's canonical
 * address, both link previews and both sitemaps. While the switch is off it is a constant `false`, with no query.
 */
export function portfolioOwnsProfilePath(userId: SQLWrapper): SQL<boolean> {
	const mode = getPortfolioMode();
	if (mode === "off") return sql<boolean>`false`;
	return sql<boolean>`exists (select 1 from ${schema.portfolio} owned_portfolio inner join ${schema.user} owned_user on owned_user.id = owned_portfolio.user_id where owned_portfolio.user_id = ${userId} and owned_portfolio.is_public and owned_portfolio.suspended_at is null and owned_user.is_anonymous is not true${mode === "admins" ? sql` and owned_user.role = 'admin'` : sql``})`;
}

/**
 * Whether search engines may list a portfolio (`02-teknis.md` section 5.3), as one condition on a query that joins
 * `portfolio` and its owner (`user`): it shows at `/<username>` (published, not suspended, switched on for its owner),
 * the owner isn't banned and allows it ("Show in search engines"), and the account is at least a week old (owner
 * decision #5). The page's robots tag and the sitemap both read this one rule. Only once portfolios are open to everyone:
 * while only admins have them (`PORTFOLIO_MODE=admins`), their pages are tests, kept out of search engines.
 */
function portfolioIsIndexable(): SQL<boolean> {
	if (getPortfolioMode() !== "on") return sql<boolean>`false`;
	return sql<boolean>`(${schema.portfolio.showInSearchEngines} and ${schema.user.createdAt} <= now() - make_interval(days => ${PORTFOLIO_NEW_ACCOUNT_NOINDEX_DAYS}) and ${portfolioOwnsProfilePath(schema.portfolio.userId)} and ${ownerIsNotBanned()})`;
}

/**
 * Whether one of the portfolio's files (a `pictures/portfolio/` or `documents/portfolio/` storage key) may be served
 * to anyone: saved data uses it (`unused_since` is null), and its owner's portfolio shows at `/<username>` (the rule
 * above) to an owner who isn't banned. Uploads not saved yet, files the portfolio stopped using, and every file of an
 * unpublished, suspended or switched-off portfolio stay with their owner. One lookup by the key's unique index.
 */
export async function isPublicPortfolioFile(key: string): Promise<boolean> {
	if (getPortfolioMode() === "off") return false;
	const [row] = await db
		.select({ id: schema.portfolioFile.id })
		.from(schema.portfolioFile)
		.innerJoin(schema.user, eq(schema.portfolioFile.userId, schema.user.id))
		.where(
			and(
				eq(schema.portfolioFile.key, key),
				isNull(schema.portfolioFile.unusedSince),
				portfolioOwnsProfilePath(schema.portfolioFile.userId),
				ownerIsNotBanned(),
			),
		)
		.limit(1);
	return row !== undefined;
}

type PublicPortfolioResume = {
	data: ResumeData;
	slug: string;
	/** The resume's own web page is shared; buttons may link to it. */
	isPublic: boolean;
	hasPassword: boolean;
	showDownloadButtons: boolean;
};

export type PublicPortfolio = {
	id: string;
	userId: string;
	username: string;
	/** The account's display name, the last fallback for the page's name. */
	ownerName: string;
	/** The owner's time zone: a statistics day is theirs. */
	timezone: string;
	data: PortfolioData;
	updatedAt: Date;
	/** Listed in search engines: the owner allows it and the account is old enough (owner decision #5). */
	indexable: boolean;
	/** The verified custom domain the portfolio opens at, which search engines are pointed to. */
	customDomain: string | null;
	/** The source resume while it exists outside Trash; its sections fill the page. */
	resume: PublicPortfolioResume | null;
	/** What the owner's plan lets the page leave out, read on every view: a plan ending shows the badge again. */
	entitlements: { hidePortfolioCredit: boolean };
};

/**
 * The portfolio `/<username>` shows, or null when that address still opens the primary resume (no portfolio, not
 * published, suspended, switched off for its owner, or the owner is banned). A lookup only: nothing is counted.
 */
export async function findPublicPortfolio(username: string): Promise<PublicPortfolio | null> {
	if (getPortfolioMode() === "off") return null;
	const [row] = await db
		.select({
			id: schema.portfolio.id,
			userId: schema.portfolio.userId,
			sourceResumeId: schema.portfolio.sourceResumeId,
			data: schema.portfolio.data,
			updatedAt: schema.portfolio.updatedAt,
			username: schema.user.username,
			ownerName: schema.user.name,
			timezone: schema.user.timezone,
			indexable: portfolioIsIndexable(),
		})
		.from(schema.portfolio)
		.innerJoin(schema.user, eq(schema.portfolio.userId, schema.user.id))
		.where(
			and(
				// Usernames are stored lowercase, so `/Jane` opens the same page as `/jane`.
				eq(schema.user.username, username.toLowerCase()),
				portfolioOwnsProfilePath(schema.user.id),
				ownerIsNotBanned(),
			),
		)
		.limit(1);
	if (!row) return null;

	const [resume, domain, entitlements] = await Promise.all([
		row.sourceResumeId
			? db
					.select({
						data: schema.resume.data,
						slug: schema.resume.slug,
						isPublic: schema.resume.isPublic,
						password: schema.resume.password,
						showDownloadButtons: schema.resume.showDownloadButtons,
					})
					.from(schema.resume)
					.where(
						and(
							eq(schema.resume.id, row.sourceResumeId),
							eq(schema.resume.userId, row.userId),
							isNull(schema.resume.trashedAt),
						),
					)
					.limit(1)
					.then(([found]) => found)
			: undefined,
		isCustomDomainsEnabled()
			? db
					.select({ hostname: schema.customDomain.hostname })
					.from(schema.customDomain)
					.where(and(eq(schema.customDomain.userId, row.userId), domainIsLive()))
					.limit(1)
					.then(([found]) => found?.hostname ?? null)
			: null,
		getEntitlements(row.userId),
	]);

	return {
		id: row.id,
		userId: row.userId,
		username: row.username,
		ownerName: row.ownerName,
		timezone: row.timezone,
		data: parsePortfolioData(row.data),
		updatedAt: row.updatedAt,
		indexable: row.indexable === true,
		customDomain: domain,
		resume: resume ? readSourceResume(row.id, resume) : null,
		entitlements: { hidePortfolioCredit: entitlements.features.hidePortfolioCredit },
	};
}

/**
 * The source resume as the page reads it. Stored data that no longer passes the resume schema leaves the page
 * without its resume sections (logged for us to repair) instead of failing the whole page.
 */
function readSourceResume(
	portfolioId: string,
	resume: { data: unknown; slug: string; isPublic: boolean; password: string | null; showDownloadButtons: boolean },
): PublicPortfolioResume | null {
	let data: ResumeData;
	try {
		data = parseStoredResumeData(resume.data);
	} catch (error) {
		console.error(`[portfolio] Source resume of portfolio ${portfolioId} can't be read; shown without it`, error);
		return null;
	}
	return {
		data,
		slug: resume.slug,
		isPublic: resume.isPublic,
		hasPassword: resume.password !== null,
		showDownloadButtons: resume.showDownloadButtons,
	};
}

/** Anything that isn't a person's browser: crawlers, and clients that don't name themselves. */
function isCrawler(headers: Headers): boolean {
	const agent = headers.get("user-agent") ?? "";
	return !agent || isbot(agent);
}

/**
 * Whether the request is the portfolio's owner, to leave them out of the counts. The session is read without the
 * request's cross-site markers: the guard on them keeps other sites from acting as the owner, and this only decides
 * whether to count, so an owner following a link to their own page from another site is still the owner.
 */
async function isPortfolioOwner(portfolio: { userId: string }, headers: Headers): Promise<boolean> {
	const sameSite = new Headers(headers);
	sameSite.delete("origin");
	sameSite.delete("sec-fetch-site");
	return isOwner(portfolio, await resolveViewer(sameSite));
}

const visitLimiter = createRateLimiter("portfolioVisits", rateLimitConfig.portfolioPublic.visits);

/**
 * Counts a visit to a published portfolio: once an hour per visitor, never for its owner or for crawlers. Link
 * previews and the editor's preview never reach here (the card has its own route; the preview renders in the browser).
 */
export async function recordPortfolioVisit(input: {
	portfolio: Pick<PublicPortfolio, "id" | "userId" | "timezone">;
	requestHeaders: Headers;
	requestUrl: string;
	trustedClient?: string | undefined;
}): Promise<void> {
	const url = new URL(input.requestUrl);
	await countPortfolioVisit({
		portfolio: input.portfolio,
		requestHeaders: input.requestHeaders,
		pageUrl: url,
		referer: input.requestHeaders.get("referer"),
		trustedClient: input.trustedClient,
	});
}

/**
 * The one way a visit is counted, for the page itself (`recordPortfolioVisit`) and for a prerendered page's `view`
 * beacon: the same limit, owner and crawler checks, and the same once-an-hour key, so a page counted by the server and
 * by its beacon counts once. `referer` is where the visitor came from, when known.
 */
async function countPortfolioVisit(input: {
	portfolio: Pick<PublicPortfolio, "id" | "userId" | "timezone">;
	requestHeaders: Headers;
	pageUrl: URL;
	referer: string | null;
	trustedClient?: string | undefined;
}): Promise<void> {
	if (isCrawler(input.requestHeaders)) return;
	const address = `ip:${input.trustedClient?.trim() || "unknown"}`;
	if (!env.FLAG_DISABLE_API_RATE_LIMIT && !(await visitLimiter.limit(`${input.portfolio.id}:${address}`)).success)
		return;
	if (await isPortfolioOwner(input.portfolio, input.requestHeaders)) return;
	const visitor = visitorKey(input.requestHeaders, input.trustedClient);
	if (!(await isFirstVisitThisHour(`portfolio:${input.portfolio.id}:view:${visitor}`))) return;
	const url = input.pageUrl;
	const hosts = new Set([...ownHosts(), url.hostname]);
	const { referer } = input;
	const source = visitSource({ referer, utmSource: url.searchParams.get("utm_source"), ownHosts: hosts });
	await countVisit(input.portfolio.id, dayInTimeZone(new Date(), input.portfolio.timezone), source);
	writePortfolioEvent({
		portfolioId: input.portfolio.id,
		event: "view",
		source,
		referrerDomain: referrerDomain(referer, hosts),
		device: deviceClass(input.requestHeaders),
	});
}

export type PortfolioEventTarget = Pick<PublicPortfolio, "id" | "userId" | "timezone"> & { hasWork: boolean };

/** What a beacon needs to know about a portfolio, without reading its data: null when the address shows none. */
export async function findPortfolioEventTarget(
	username: string,
	workId?: string | undefined,
): Promise<PortfolioEventTarget | null> {
	if (getPortfolioMode() === "off") return null;
	const [row] = await db
		.select({
			id: schema.portfolio.id,
			userId: schema.portfolio.userId,
			timezone: schema.user.timezone,
			hasWork: workId
				? sql<boolean>`jsonb_path_exists(${schema.portfolio.data}, '$.works.items[*] ? (@.id == $id)', jsonb_build_object('id', ${workId}::text))`
				: sql<boolean>`false`,
		})
		.from(schema.portfolio)
		.innerJoin(schema.user, eq(schema.portfolio.userId, schema.user.id))
		.where(
			and(
				eq(schema.user.username, username.toLowerCase()),
				portfolioOwnsProfilePath(schema.user.id),
				ownerIsNotBanned(),
			),
		)
		.limit(1);
	return row ? { ...row, hasWork: row.hasWork === true } : null;
}

const eventLimiter = createRateLimiter("portfolioEvents", rateLimitConfig.portfolioPublic.events);

/**
 * Counts a beacon from a published page (`02-teknis.md` section 9): a click of one kind, a work whose detail was
 * opened, or the visit of a prerendered page once shown (`view`, counted as the page's visit). Once an hour per visitor
 * and kind (and per work), never for its owner or crawlers.
 */
export async function recordPortfolioEvent(input: {
	target: PortfolioEventTarget;
	kind: PortfolioEventKind;
	workId?: string | undefined;
	requestHeaders: Headers;
	trustedClient?: string | undefined;
}): Promise<void> {
	const { target, kind, workId } = input;
	if (kind === "view") {
		// The beacon comes from the page, so its own `Referer` is the page's address (with any `utm_source`); where the
		// visitor came from before isn't known here.
		const page = pageAddress(input.requestHeaders.get("referer"));
		if (page)
			await countPortfolioVisit({
				portfolio: target,
				requestHeaders: input.requestHeaders,
				pageUrl: page,
				referer: null,
				trustedClient: input.trustedClient,
			});
		return;
	}
	if (kind === "work" && (!workId || !target.hasWork)) return;
	if (isCrawler(input.requestHeaders)) return;
	if (
		!env.FLAG_DISABLE_API_RATE_LIMIT &&
		!(await eventLimiter.limit(`ip:${input.trustedClient?.trim() || "unknown"}`)).success
	)
		return;
	if (await isPortfolioOwner(target, input.requestHeaders)) return;
	const visitor = visitorKey(input.requestHeaders, input.trustedClient);
	const subject = kind === "work" ? `work:${workId ?? ""}` : kind;
	if (!(await isFirstVisitThisHour(`portfolio:${target.id}:${subject}:${visitor}`))) return;
	const date = dayInTimeZone(new Date(), target.timezone);
	if (kind === "work") await countWorkOpen(target.id, date, workId ?? "");
	else await countClick(target.id, date, kind);
	writePortfolioEvent({
		portfolioId: target.id,
		event: kind,
		workId: kind === "work" ? workId : undefined,
		device: deviceClass(input.requestHeaders),
	});
}

/** The page a beacon came from, when its `Referer` is an http(s) address. */
function pageAddress(referer: string | null): URL | null {
	if (!referer) return null;
	try {
		const url = new URL(referer);
		return url.protocol === "https:" || url.protocol === "http:" ? url : null;
	} catch {
		return null;
	}
}

/** A page of the sitemap holds at most this many addresses, the protocol's limit. */
const SITEMAP_PAGE_SIZE = 50_000;

/**
 * Portfolios listed in the sitemap: indexable (`portfolioIsIndexable`), except one with a verified custom domain, whose
 * own domain is its address. Needs the `user` join.
 */
const indexablePortfolioWhere = () =>
	and(
		portfolioIsIndexable(),
		isCustomDomainsEnabled()
			? sql`not exists (select 1 from ${schema.customDomain} where ${schema.customDomain.userId} = ${schema.portfolio.userId} and ${domainIsLive()})`
			: undefined,
	);

export function listIndexablePortfolios(page: number) {
	if (getPortfolioMode() === "off") return Promise.resolve([]);
	return (
		db
			.select({ username: schema.user.username, updatedAt: schema.portfolio.updatedAt })
			.from(schema.portfolio)
			.innerJoin(schema.user, eq(schema.portfolio.userId, schema.user.id))
			.where(indexablePortfolioWhere())
			// ponytail: offset paging, as for resumes; switch to keyset ranges if sitemap pages get slow.
			.orderBy(asc(schema.portfolio.id))
			.limit(SITEMAP_PAGE_SIZE)
			.offset(page * SITEMAP_PAGE_SIZE)
	);
}

export async function countIndexablePortfolios(): Promise<number> {
	if (getPortfolioMode() === "off") return 0;
	const [row] = await db
		.select({ total: count() })
		.from(schema.portfolio)
		.innerJoin(schema.user, eq(schema.portfolio.userId, schema.user.id))
		.where(indexablePortfolioWhere());
	return row?.total ?? 0;
}

export { SITEMAP_PAGE_SIZE as PORTFOLIO_SITEMAP_PAGE_SIZE };
