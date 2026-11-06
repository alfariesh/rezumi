import type { PortfolioData } from "@rezumi/schema/portfolio/data";
import type { ResumeData } from "@rezumi/schema/resume/data";
import type { SQL, SQLWrapper } from "drizzle-orm";
import { and, asc, count, eq, isNotNull, isNull, sql } from "drizzle-orm";
import { isbot } from "isbot";
import { db } from "@rezumi/db/client";
import * as schema from "@rezumi/db/schema";
import { parsePortfolioData } from "@rezumi/schema/portfolio/data";
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

export type PublicPortfolioResume = {
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
	/** Listed in search engines: the owner allows it (Phase 11 adds the young-account rule). */
	indexable: boolean;
	/** The verified custom domain the portfolio opens at, which search engines are pointed to. */
	customDomain: string | null;
	/** The source resume while it exists outside Trash; its sections fill the page. */
	resume: PublicPortfolioResume | null;
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
			showInSearchEngines: schema.portfolio.showInSearchEngines,
			data: schema.portfolio.data,
			updatedAt: schema.portfolio.updatedAt,
			username: schema.user.username,
			ownerName: schema.user.name,
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

	const [resume, domain] = await Promise.all([
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
	]);

	return {
		id: row.id,
		userId: row.userId,
		username: row.username,
		ownerName: row.ownerName,
		data: parsePortfolioData(row.data),
		updatedAt: row.updatedAt,
		indexable: row.showInSearchEngines,
		customDomain: domain,
		resume: resume
			? {
					data: parseStoredResumeData(resume.data),
					slug: resume.slug,
					isPublic: resume.isPublic,
					hasPassword: resume.password !== null,
					showDownloadButtons: resume.showDownloadButtons,
				}
			: null,
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
 * Portfolios listed in search engines: shown at `/<username>` now and allowed to be indexed. One with a verified
 * custom domain is left out; its own domain is its address. Needs the `user` join.
 */
const indexablePortfolioWhere = () =>
	and(
		eq(schema.portfolio.showInSearchEngines, true),
		portfolioOwnsProfilePath(schema.portfolio.userId),
		ownerIsNotBanned(),
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
