import { and, asc, eq, gt, inArray, isNotNull, isNull, lt, lte, notExists, or, sql } from "drizzle-orm";
import { db } from "@rezumi/db/client";
import * as schema from "@rezumi/db/schema";
import { getEntitlements } from "../billing/entitlements";
import { getPortfolioMode, isPortfolioEnabledFor } from "../portfolio/mode";
import { CloudflareSaasError, deleteCustomHostname, isCloudflareSaasEnabled } from "./cloudflare";
import { clearedHostname, queueHostnameRemoval, syncHostname } from "./hostnames";
import { HOSTNAME_KEEP_MS, isHostnameDeletionDue, PLAN_GRACE_MS } from "./lifecycle";
import { isCustomDomainsEnabled, recheckStaleDomains } from "./service";

const MINUTE_MS = 60_000;
const ROWS_PER_RUN = 25;
// A claimed row is left alone this long, so a run that dies midway is retried without two runs doing the same work.
const CLAIM_MS = 10 * MINUTE_MS;
const PLAN_CHECK_INTERVAL_MS = 60 * MINUTE_MS;
const NOT_OPEN_RECHECK_MS = 60 * MINUTE_MS;
const MAX_REMOVAL_BACKOFF_MS = 6 * 60 * MINUTE_MS;

async function task<T>(work: () => Promise<T>, fallback: T, failure: string): Promise<T> {
	try {
		return await work();
	} catch (error) {
		console.error(`[custom-domain] ${failure}`, error);
		return fallback;
	}
}

async function accountOf(userId: string) {
	const [account] = await db
		.select({ role: schema.user.role, isAnonymous: schema.user.isAnonymous })
		.from(schema.user)
		.where(eq(schema.user.id, userId));
	return account;
}

/** Without portfolios open to the account, no plan applies to its domain (`00-keputusan.md` rule #3). */
async function planIncludesDomain(userId: string, now: Date) {
	const account = await accountOf(userId);
	if (!account || !isPortfolioEnabledFor(account)) return true;
	return (await getEntitlements(userId, now)).features.customDomain;
}

/**
 * Starts and stops each verified domain's clock after its plan ends (`planLapsedAt`). Nothing else is written here:
 * the grace and the redirect are worked out from that date where the domain is served.
 */
async function checkPlans(now: Date): Promise<number> {
	const domain = schema.customDomain;
	const due = await db
		.update(domain)
		.set({ planCheckedAt: now })
		.where(
			inArray(
				domain.userId,
				db
					.select({ userId: domain.userId })
					.from(domain)
					.where(
						and(
							isNotNull(domain.verifiedAt),
							or(
								isNull(domain.planCheckedAt),
								lt(domain.planCheckedAt, new Date(now.getTime() - PLAN_CHECK_INTERVAL_MS)),
							),
						),
					)
					.orderBy(sql`${domain.planCheckedAt} asc nulls first`, asc(domain.userId))
					.limit(ROWS_PER_RUN)
					.for("update", { skipLocked: true }),
			),
		)
		.returning({ userId: domain.userId, planLapsedAt: domain.planLapsedAt });

	for (const { userId, planLapsedAt } of due) {
		const included = await planIncludesDomain(userId, now);
		if (included === (planLapsedAt === null)) continue;
		await db
			.update(domain)
			// Coming back asks for a hostname at once: the old one may have been deleted while the plan was over.
			.set(included ? { planLapsedAt: null, cfNextCheckAt: null } : { planLapsedAt: now })
			.where(eq(domain.userId, userId));
	}
	return due.length;
}

/** Deletes hostnames nothing uses any more, backing off from Cloudflare trouble. */
async function processRemovals(now: Date): Promise<number> {
	const removal = schema.customDomainRemoval;
	const domain = schema.customDomain;
	const claimed = await db
		.update(removal)
		.set({ attempts: sql`${removal.attempts} + 1`, nextAttemptAt: new Date(now.getTime() + CLAIM_MS) })
		.where(
			inArray(
				removal.cfHostnameId,
				db
					.select({ id: removal.cfHostnameId })
					.from(removal)
					.where(
						and(
							lte(removal.nextAttemptAt, now),
							notExists(
								db.select({ id: domain.userId }).from(domain).where(eq(domain.cfHostnameId, removal.cfHostnameId)),
							),
						),
					)
					.orderBy(asc(removal.nextAttemptAt))
					.limit(ROWS_PER_RUN)
					.for("update", { skipLocked: true }),
			),
		)
		.returning();

	let removed = 0;
	for (const row of claimed) {
		try {
			await deleteCustomHostname(row.cfHostnameId);
			await db.delete(removal).where(eq(removal.cfHostnameId, row.cfHostnameId));
			removed += 1;
		} catch (error) {
			if (!(error instanceof CloudflareSaasError)) throw error;
			console.error(`[custom-domain] Deleting a hostname failed; it retries later. ${error.message}`);
			const backoff = Math.min(MINUTE_MS * 2 ** row.attempts, MAX_REMOVAL_BACKOFF_MS);
			await db
				.update(removal)
				.set({ nextAttemptAt: new Date(now.getTime() + backoff) })
				.where(eq(removal.cfHostnameId, row.cfHostnameId));
		}
	}
	return removed;
}

/** Makes hostnames for newly verified domains, follows the ones still settling, and drops the ones whose time is up. */
async function syncDueHostnames(now: Date): Promise<number> {
	const domain = schema.customDomain;
	const deletionCutoff = new Date(now.getTime() - PLAN_GRACE_MS - HOSTNAME_KEEP_MS);
	const claimed = await db
		.update(domain)
		.set({ cfNextCheckAt: new Date(now.getTime() + CLAIM_MS) })
		.where(
			inArray(
				domain.userId,
				db
					.select({ userId: domain.userId })
					.from(domain)
					.where(
						and(
							isNotNull(domain.verifiedAt),
							or(isNull(domain.cfNextCheckAt), lte(domain.cfNextCheckAt, now)),
							// Its hostname is already gone and stays gone until the plan comes back.
							or(isNull(domain.planLapsedAt), gt(domain.planLapsedAt, deletionCutoff), isNotNull(domain.cfHostnameId)),
						),
					)
					.orderBy(sql`${domain.cfNextCheckAt} asc nulls first`, asc(domain.userId))
					.limit(ROWS_PER_RUN)
					.for("update", { skipLocked: true }),
			),
		)
		.returning();

	let synced = 0;
	const mode = getPortfolioMode();
	for (const row of claimed) {
		if (isHostnameDeletionDue(row.planLapsedAt, now)) {
			await db.transaction(async (tx) => {
				// Locked and read again: the id can have changed since the row was claimed.
				const same = and(eq(domain.userId, row.userId), eq(domain.hostname, row.hostname));
				const [current] = await tx.select().from(domain).where(same).for("update");
				if (!current) return;
				await queueHostnameRemoval(tx, current);
				await tx.update(domain).set(clearedHostname).where(same);
			});
			continue;
		}
		if (!row.cfHostnameId) {
			// Each hostname costs money; none is made for an account the feature isn't open to.
			const account = await accountOf(row.userId);
			if (!account || !isPortfolioEnabledFor(account, mode)) {
				await db
					.update(domain)
					.set({ cfNextCheckAt: new Date(now.getTime() + NOT_OPEN_RECHECK_MS) })
					.where(eq(domain.userId, row.userId));
				continue;
			}
		}
		await syncHostname(row, now);
		synced += 1;
	}
	return synced;
}

/**
 * Custom domain upkeep, run every minute after the other jobs. Runs can overlap or repeat: rows are claimed with
 * `SKIP LOCKED`, and each Cloudflare call is safe to make twice. Without the Cloudflare automation nothing here runs,
 * so an installation without it keeps working as it did.
 */
export async function runCustomDomainJobs(now = new Date()) {
	const result = { plansChecked: 0, removed: 0, synced: 0 };
	if (!isCustomDomainsEnabled() || !isCloudflareSaasEnabled()) return result;
	result.plansChecked = await task(() => checkPlans(now), 0, "Checking plans failed; it retries next run.");
	result.synced = await task(() => syncDueHostnames(now), 0, "Syncing hostnames failed; it retries next run.");
	result.removed = await task(() => processRemovals(now), 0, "Deleting hostnames failed; it retries next run.");
	await task(() => recheckStaleDomains(), undefined, "Re-checking DNS failed; it retries next run.");
	return result;
}
