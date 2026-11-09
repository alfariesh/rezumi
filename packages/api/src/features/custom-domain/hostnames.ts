import type { CustomHostname } from "./cloudflare";
import type { DbOrTx } from "@rezumi/db/client";
import { and, eq, isNotNull } from "drizzle-orm";
import { db } from "@rezumi/db/client";
import * as schema from "@rezumi/db/schema";
import {
	CloudflareSaasError,
	createCustomHostname,
	getCustomHostname,
	isCloudflareSaasEnabled,
	restartCustomHostnameValidation,
} from "./cloudflare";
import { isHostnameDeletionDue, toConnectionProblem } from "./lifecycle";

export type DomainRow = typeof schema.customDomain.$inferSelect;

const MINUTE_MS = 60_000;
// Once made, a hostname settles within minutes; after that a slow certificate is only worth looking at now and then.
const WAITING_RECHECK_MS = 2 * MINUTE_MS;
const PROBLEM_RECHECK_MS = 60 * MINUTE_MS;
const ACTIVE_RECHECK_MS = 24 * 60 * MINUTE_MS;

/** A hostname no account uses any more, for the job to delete. The call that loses it does this in its transaction. */
export async function queueHostnameRemoval(tx: DbOrTx, hostname: { cfHostnameId: string | null; hostname: string }) {
	if (!hostname.cfHostnameId) return;
	await tx
		.insert(schema.customDomainRemoval)
		.values({ cfHostnameId: hostname.cfHostnameId, hostname: hostname.hostname })
		.onConflictDoNothing();
}

export const clearedHostname = {
	cfHostnameId: null,
	cfHostnameStatus: null,
	cfSslStatus: null,
	cfProblem: null,
	cfNextCheckAt: null,
} as const;

/** The row is still this account's proven claim on this domain: not replaced, moved away or out of proof meanwhile. */
const isSameDomain = (row: DomainRow) =>
	and(
		eq(schema.customDomain.userId, row.userId),
		eq(schema.customDomain.hostname, row.hostname),
		eq(schema.customDomain.verificationToken, row.verificationToken),
		isNotNull(schema.customDomain.verifiedAt),
	);

const recheckDelay = (hostname: CustomHostname) => {
	if (hostname.problem) return PROBLEM_RECHECK_MS;
	return hostname.status === "active" && hostname.sslStatus === "active" ? ACTIVE_RECHECK_MS : WAITING_RECHECK_MS;
};

/**
 * Stores what Cloudflare said about a domain. A domain replaced while the call was out leaves its hostname behind, so
 * that goes on the removal list; and a hostname reused here must not be deleted by an earlier removal.
 */
function recordHostname(row: DomainRow, hostname: CustomHostname, now: Date): Promise<DomainRow | null> {
	return db.transaction(async (tx) => {
		const [updated] = await tx
			.update(schema.customDomain)
			.set({
				cfHostnameId: hostname.id,
				cfHostnameStatus: hostname.status,
				cfSslStatus: hostname.sslStatus,
				cfProblem: hostname.problem,
				cfNextCheckAt: new Date(now.getTime() + recheckDelay(hostname)),
			})
			.where(isSameDomain(row))
			.returning();
		if (!updated) {
			await queueHostnameRemoval(tx, { cfHostnameId: hostname.id, hostname: row.hostname });
			return null;
		}
		await tx.delete(schema.customDomainRemoval).where(eq(schema.customDomainRemoval.cfHostnameId, hostname.id));
		return updated;
	});
}

async function recordFailure(row: DomainRow, error: CloudflareSaasError, now: Date): Promise<DomainRow | null> {
	// A full quota and a refused name are the domain's story to tell; a bad token or an outage is ours to fix.
	console.error(`[custom-domain] ${error.message}`);
	const cfProblem = error.failure === "quota" || error.failure === "rejected" ? error.failure : row.cfProblem;
	const [updated] = await db
		.update(schema.customDomain)
		.set({ cfProblem, cfNextCheckAt: new Date(now.getTime() + PROBLEM_RECHECK_MS) })
		.where(isSameDomain(row))
		.returning();
	return updated ?? null;
}

/**
 * Brings one verified domain in line with Cloudflare: makes its hostname when it has none and reads where it stands.
 * Safe to repeat and to run twice at once, since making a hostname that exists finds it instead. A hostname Cloudflare
 * dropped (moved away for over a week) is forgotten and made again on the next call.
 */
export async function syncHostname(
	row: DomainRow,
	now = new Date(),
	options: { restartValidation?: boolean } = {},
): Promise<DomainRow> {
	if (!isCloudflareSaasEnabled() || !row.verifiedAt || isHostnameDeletionDue(row.planLapsedAt, now)) return row;
	try {
		if (row.cfHostnameId) {
			// Cloudflare stops retrying a failed validation by itself, so a person's "Check again" restarts it.
			const current =
				options.restartValidation && toConnectionProblem(row.cfProblem)
					? await restartCustomHostnameValidation(row.cfHostnameId)
					: await getCustomHostname(row.cfHostnameId);
			if (!current) {
				const [forgotten] = await db
					.update(schema.customDomain)
					.set(clearedHostname)
					.where(and(isSameDomain(row), eq(schema.customDomain.cfHostnameId, row.cfHostnameId)))
					.returning();
				return forgotten ?? row;
			}
			return (await recordHostname(row, current, now)) ?? row;
		}
		return (await recordHostname(row, await createCustomHostname(row.hostname), now)) ?? row;
	} catch (error) {
		if (!(error instanceof CloudflareSaasError)) throw error;
		return (await recordFailure(row, error, now)) ?? row;
	}
}
