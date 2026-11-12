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
import { PORTFOLIO_LIMITS, PORTFOLIO_NEW_ACCOUNT_NOINDEX_DAYS } from "@rezumi/schema/portfolio/limits";
import { rateLimitConfig } from "@rezumi/utils/rate-limit";
import { createRateLimiter } from "../../redis";
import { getEntitlements } from "../billing/entitlements";
import { domainIsLive, isCustomDomainsEnabled, ownHosts } from "../custom-domain/service";
import { isOwner, ownerIsNotBanned, resolveViewer } from "../resume/access-policy";
import { parseStoredResumeData } from "../resume/resume-data-validation";
import { isFirstVisitThisHour } from "../resume/view-dedup";
import { writePortfolioEvent } from "./analytics";
import { rateLimitAddress } from "./client-address";
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
 * while only admins have them (`PORTFOLIO_MODE=admins`), their pages are tests, kept out of search engines. Never while
 * visitors need a password (Phase 13, B16).
 */
function portfolioIsIndexable(): SQL<boolean> {
	if (getPortfolioMode() !== "on") return sql<boolean>`false`;
	return sql<boolean>`(${schema.portfolio.showInSearchEngines} and ${schema.portfolio.password} is null and ${schema.user.createdAt} <= now() - make_interval(days => ${PORTFOLIO_NEW_ACCOUNT_NOINDEX_DAYS}) and ${portfolioOwnsProfilePath(schema.portfolio.userId)} and ${ownerIsNotBanned()})`;
}

/**
 * Who may load one of the portfolio's files (a `pictures/portfolio/` or `documents/portfolio/` storage key): `public`
 * when saved data uses it (`unused_since` is null) and its owner's portfolio shows at `/<username>` (the rule above) to
 * an owner who isn't banned; `protected` for such a file of a portfolio with a visitor password, which is served only
 * with a valid file token (`isValidPortfolioFileToken`, given to visitors who opened it) or to its owner, never cached
 * publicly; `none` otherwise: uploads not saved yet, files the portfolio stopped using, and every file of an
 * unpublished, suspended or switched-off portfolio stay with their owner. One lookup by the key's unique index.
 */
export async function portfolioFileGate(
	key: string,
): Promise<{ access: "public" } | { access: "protected"; passwordHash: string } | { access: "none" }> {
	if (getPortfolioMode() === "off") return { access: "none" };
	const [row] = await db
		.select({ passwordHash: schema.portfolio.password })
		.from(schema.portfolioFile)
		.innerJoin(schema.user, eq(schema.portfolioFile.userId, schema.user.id))
		.innerJoin(schema.portfolio, eq(schema.portfolio.userId, schema.portfolioFile.userId))
		.where(
			and(
				eq(schema.portfolioFile.key, key),
				isNull(schema.portfolioFile.unusedSince),
				portfolioOwnsProfilePath(schema.portfolioFile.userId),
				ownerIsNotBanned(),
			),
		)
		.limit(1);
	if (!row) return { access: "none" };
	return row.passwordHash ? { access: "protected", passwordHash: row.passwordHash } : { access: "public" };
}

/** `portfolioFileGate` without the hash, for callers that only need to know who may load the file. */
export async function portfolioFileAccess(key: string): Promise<"public" | "protected" | "none"> {
	return (await portfolioFileGate(key)).access;
}

/** Whether anyone may load one of the portfolio's files: `portfolioFileAccess` other than `none`. */
export async function isPublicPortfolioFile(key: string): Promise<boolean> {
	return (await portfolioFileAccess(key)) !== "none";
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
	/** The visitor password's hash, for the gate (`visitor-access.ts`) only: never in a view, log or response. */
	passwordHash: string | null;
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
			passwordHash: schema.portfolio.password,
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
		passwordHash: row.passwordHash,
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
export async function isPortfolioOwner(portfolio: { userId: string }, headers: Headers): Promise<boolean> {
	const sameSite = new Headers(headers);
	sameSite.delete("origin");
	sameSite.delete("sec-fetch-site");
	return isOwner(portfolio, await resolveViewer(sameSite));
}

const visitLimiter = createRateLimiter("portfolioVisits", rateLimitConfig.portfolioPublic.visits);

type VisitInput = {
	portfolio: Pick<PublicPortfolio, "id" | "userId" | "timezone">;
	requestHeaders: Headers;
	trustedClient?: string | undefined;
};

/**
 * Who is visiting, for one hour's deduplication, or null when nothing is counted: a crawler, an address over its limit,
 * or the portfolio's owner.
 */
async function countedVisitor(input: VisitInput): Promise<string | null> {
	if (isCrawler(input.requestHeaders)) return null;
	// An IPv6 address by its /64, like the form posts: rotating inside it gains nothing.
	const address = `ip:${rateLimitAddress(input.trustedClient) ?? "unknown"}`;
	if (!env.FLAG_DISABLE_API_RATE_LIMIT && !(await visitLimiter.limit(`${input.portfolio.id}:${address}`)).success)
		return null;
	if (await isPortfolioOwner(input.portfolio, input.requestHeaders)) return null;
	return visitorKey(input.requestHeaders, input.trustedClient);
}

/**
 * Counts a visit to a published portfolio: once an hour per visitor, never for its owner or for crawlers. Link
 * previews and the editor's preview never reach here (the card has its own route; the preview renders in the browser).
 * A work's page (`workId`, Phase 13 B2/B9) also counts that work as opened, once an hour per visitor and work; coming to
 * it from the portfolio's home doesn't count the portfolio visit twice (one key for both).
 */
export async function recordPortfolioVisit(
	input: VisitInput & { requestUrl: string; workId?: string | undefined },
): Promise<void> {
	const visitor = await countedVisitor(input);
	if (!visitor) return;
	const pageUrl = new URL(input.requestUrl);
	const referer = input.requestHeaders.get("referer");
	await countView({ ...input, visitor, pageUrl, referer });
	if (input.workId) await countWorkVisit({ ...input, workId: input.workId, visitor, pageUrl, referer });
}

type CountInput = VisitInput & { visitor: string; pageUrl: URL; referer: string | null };

/**
 * The one way a portfolio visit is counted, for the page itself (`recordPortfolioVisit`) and for a prerendered page's
 * `view` beacon: the same once-an-hour key, so a page counted by the server and by its beacon counts once. `referer` is
 * where the visitor came from, when known.
 */
async function countView(input: CountInput): Promise<void> {
	if (!(await isFirstVisitThisHour(`portfolio:${input.portfolio.id}:view:${input.visitor}`))) return;
	const hosts = new Set([...ownHosts(), input.pageUrl.hostname]);
	const source = visitSource({
		referer: input.referer,
		utmSource: input.pageUrl.searchParams.get("utm_source"),
		ownHosts: hosts,
	});
	await countVisit(input.portfolio.id, dayInTimeZone(new Date(), input.portfolio.timezone), source);
	writePortfolioEvent({
		portfolioId: input.portfolio.id,
		event: "view",
		source,
		referrerDomain: referrerDomain(input.referer, hosts),
		device: deviceClass(input.requestHeaders),
	});
}

/** A work's page opened: the daily `works` count, and its own data point with where the visitor came from. */
async function countWorkVisit(input: CountInput & { workId: string }): Promise<void> {
	const { portfolio, workId } = input;
	if (!(await isFirstVisitThisHour(`portfolio:${portfolio.id}:work:${workId}:${input.visitor}`))) return;
	await countWorkOpen(portfolio.id, dayInTimeZone(new Date(), portfolio.timezone), workId);
	const hosts = new Set([...ownHosts(), input.pageUrl.hostname]);
	const fromPortfolio = (() => {
		try {
			return input.referer !== null && hosts.has(new URL(input.referer).hostname.toLowerCase());
		} catch {
			return false;
		}
	})();
	writePortfolioEvent({
		portfolioId: portfolio.id,
		event: "work",
		workId,
		source: fromPortfolio
			? "portfolio"
			: visitSource({
					referer: input.referer,
					utmSource: input.pageUrl.searchParams.get("utm_source"),
					ownHosts: hosts,
				}),
		referrerDomain: referrerDomain(input.referer, hosts),
		device: deviceClass(input.requestHeaders),
	});
}

export type PortfolioEventTarget = Pick<PublicPortfolio, "id" | "userId" | "timezone" | "passwordHash"> & {
	hasWork: boolean;
};

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
			passwordHash: schema.portfolio.password,
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
 * Counts a beacon from a published page (`02-teknis.md` section 9): a click of one kind, once an hour per visitor and
 * kind, or the visit of a prerendered page once shown (`view`, counted as the page's visit, and on a work's page, with
 * its `workId`, as that work opened, deduplicated with the page's own count). A click on a work's page
 * carries the work's id (`workId`): the daily row counts it per portfolio, Analytics Engine per work. Opening a work is
 * counted by its page itself (`recordPortfolioVisit`), not by a beacon. Never its owner's or a crawler's.
 */
export async function recordPortfolioEvent(input: {
	target: PortfolioEventTarget;
	kind: PortfolioEventKind;
	workId?: string | undefined;
	/** A `view` beacon's `document.referrer`: where the visitor came from before the page. */
	ref?: string | undefined;
	requestHeaders: Headers;
	trustedClient?: string | undefined;
}): Promise<void> {
	const { target, kind } = input;
	if (kind === "view") {
		// The beacon comes from the page, so its own `Referer` is the page's address (with any `utm_source`); where the
		// visitor came from is the page's `document.referrer`, sent along as `ref`.
		const page = pageAddress(input.requestHeaders.get("referer"));
		if (!page) return;
		const visitor = await countedVisitor({ ...input, portfolio: target });
		if (!visitor) return;
		const visit = {
			portfolio: target,
			requestHeaders: input.requestHeaders,
			trustedClient: input.trustedClient,
			visitor,
			pageUrl: page,
			referer: pageAddress(input.ref?.slice(0, 300) ?? null)?.href ?? null,
		};
		await countView(visit);
		// A prerendered work's page also reports its work: opened once an hour per visitor, like the page's own count.
		if (input.workId && target.hasWork) await countWorkVisit({ ...visit, workId: input.workId });
		return;
	}
	if (isCrawler(input.requestHeaders)) return;
	if (
		!env.FLAG_DISABLE_API_RATE_LIMIT &&
		!(await eventLimiter.limit(`ip:${rateLimitAddress(input.trustedClient) ?? "unknown"}`)).success
	)
		return;
	if (await isPortfolioOwner(target, input.requestHeaders)) return;
	const visitor = visitorKey(input.requestHeaders, input.trustedClient);
	const workId = input.workId && target.hasWork ? input.workId : undefined;
	if (!(await isFirstVisitThisHour(`portfolio:${target.id}:${kind}:${workId ?? ""}:${visitor}`))) return;
	await countClick(target.id, dayInTimeZone(new Date(), target.timezone), kind);
	writePortfolioEvent({ portfolioId: target.id, event: kind, workId, device: deviceClass(input.requestHeaders) });
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

/**
 * Portfolios per page of the sitemap: each brings its home and up to `PORTFOLIO_LIMITS.works` work pages, and a page
 * holds at most 50,000 addresses (the protocol's limit): 980 portfolios, at most 49,980 addresses.
 */
const SITEMAP_PAGE_SIZE = Math.floor(50_000 / (1 + PORTFOLIO_LIMITS.works));

/** What `String.prototype.trim` removes, so the query reads a title as blank exactly when `isListedWork` does. */
const JS_WHITESPACE =
	"\t\n\v\f\r \u00a0\u1680\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200a\u2028\u2029\u202f\u205f\u3000\ufeff";

/**
 * The slugs of the works that have a page, worked out in the query from the stored JSON (no portfolio data comes back
 * to the server): `listedWorkSlugs` as SQL, none while the Work section is hidden, else the works that aren't hidden and
 * have a title, in their order. A real-database test keeps the two equal.
 */
const listedWorkSlugsSql = () => sql<string[]>`(case
	when coalesce(${schema.portfolio.data}->'sections'->'hidden', '[]'::jsonb) ? 'work' then '[]'::jsonb
	else coalesce((
		select jsonb_agg(work.item->>'slug' order by work.position)
		from jsonb_array_elements(case when jsonb_typeof(${schema.portfolio.data}->'works'->'items') = 'array' then ${schema.portfolio.data}->'works'->'items' else '[]'::jsonb end) with ordinality as work(item, position)
		where coalesce(work.item->'hidden', 'false'::jsonb) <> 'true'::jsonb
			and btrim(coalesce(work.item->>'title', ''), ${JS_WHITESPACE}) <> ''
			and jsonb_typeof(work.item->'slug') = 'string'
	), '[]'::jsonb)
end)`;

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
			.select({
				username: schema.user.username,
				updatedAt: schema.portfolio.updatedAt,
				workSlugs: listedWorkSlugsSql(),
			})
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
