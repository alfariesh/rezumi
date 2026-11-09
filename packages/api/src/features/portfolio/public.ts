import type { PortfolioData } from "@rezumi/schema/portfolio/data";
import type { ResumeData } from "@rezumi/schema/resume/data";
import type { SQL, SQLWrapper } from "drizzle-orm";
import { and, asc, count, eq, isNotNull, isNull, sql } from "drizzle-orm";
import { isbot } from "isbot";
import { db } from "@rezumi/db/client";
import * as schema from "@rezumi/db/schema";
import { parsePortfolioData } from "@rezumi/schema/portfolio/data";
import { PORTFOLIO_NEW_ACCOUNT_NOINDEX_DAYS } from "@rezumi/schema/portfolio/limits";
import { getEntitlements } from "../billing/entitlements";
import { isCustomDomainsEnabled } from "../custom-domain/service";
import { isOwner, ownerIsNotBanned, resolveViewer } from "../resume/access-policy";
import { parseStoredResumeData } from "../resume/resume-data-validation";
import { isFirstVisitThisHour } from "../resume/view-dedup";
import { getPortfolioMode } from "./mode";

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
 * decision #5). The page's robots tag and the sitemap both read this one rule.
 */
function portfolioIsIndexable(): SQL<boolean> {
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
					.where(and(eq(schema.customDomain.userId, row.userId), isNotNull(schema.customDomain.verifiedAt)))
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

/**
 * Counts a visit to a published portfolio: once an hour per visitor, never for its owner or for crawlers. Link
 * previews and the editor's preview never reach here (the card has its own route; the preview renders in the browser).
 */
export async function recordPortfolioVisit(input: {
	portfolio: Pick<PublicPortfolio, "id" | "userId">;
	requestHeaders: Headers;
	trustedClient?: string | undefined;
}): Promise<void> {
	if (isbot(input.requestHeaders.get("user-agent") ?? "")) return;
	const viewer = await resolveViewer(input.requestHeaders);
	if (isOwner(input.portfolio, viewer)) return;
	if (!(await isFirstVisitThisHour(`portfolio:${input.portfolio.id}`, input.trustedClient))) return;
	const today = new Date().toISOString().slice(0, 10);
	await db
		.insert(schema.portfolioStatisticsDaily)
		.values({ portfolioId: input.portfolio.id, date: today, views: 1 })
		.onConflictDoUpdate({
			target: [schema.portfolioStatisticsDaily.portfolioId, schema.portfolioStatisticsDaily.date],
			set: { views: sql`${schema.portfolioStatisticsDaily.views} + 1` },
		});
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
			? sql`not exists (select 1 from ${schema.customDomain} verified_domain where verified_domain.user_id = ${schema.portfolio.userId} and verified_domain.verified_at is not null)`
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
