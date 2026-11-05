import type { Transaction } from "./account";
import type { DbOrTx } from "@rezumi/db/client";
import type { CreditAllocation, CreditUsageStatus } from "@rezumi/db/schema";
import type { CreditAction, CreditSource } from "@rezumi/schema/billing";
import { ORPCError } from "@orpc/server";
import { and, asc, desc, eq, gt, inArray, isNull, lt, sql } from "drizzle-orm";
import { db } from "@rezumi/db/client";
import * as schema from "@rezumi/db/schema";
import { CREDIT_COSTS, TRIAL_CREDITS } from "@rezumi/schema/billing";
import { generateId } from "@rezumi/utils/string";
import { lockBillingAccount } from "./account";
import { getBillingMode, isBillingActiveFor } from "./entitlements";
import { DAY_MS } from "./timeline";

/**
 * The Rezumi AI credit ledger. Every change to an account's credits goes through here, holding the account's billing
 * lock: grants come in, a reservation takes credits before the AI works, and the reservation is committed when the
 * work gives a usable result or released (credits back to the grants they came from) when it doesn't.
 */

type GrantRow = typeof schema.aiCreditGrant.$inferSelect;
type UsageRow = typeof schema.aiCreditUsage.$inferSelect;

/** How long a reservation may wait for its result before the billing job gives its credits back. */
export const STALE_RESERVATION_MS = 15 * 60 * 1000;

/** The usage action an administrator's correction downward is recorded under. */
export const ADMIN_ADJUSTMENT_ACTION = "admin-adjustment";

// Reservations a billing job run releases at most; the rest wait for the next run.
const STALE_BATCH = 100;

export type CreditBalance = {
	/** Credits that can be spent now: unexpired, unrevoked grants, less what reservations hold. */
	balance: number;
	/** The soonest expiry among those credits, and how many expire then. */
	nextExpiry: { credits: number; at: Date } | null;
	trial: {
		/** Whether the account will get the trial credits the first time it uses Rezumi AI. */
		available: boolean;
		grantedAt: Date | null;
		expiresAt: Date | null;
	};
};

export type CreditReservation = {
	usageId: string;
	credits: number;
	/** The balance once this reservation is taken. */
	balanceAfter: number;
	/** `reserved` for a new reservation; a repeated key returns the first one as it is now. */
	status: CreditUsageStatus;
	/** Whether this call took the credits, rather than finding an earlier reservation with the same key. */
	created: boolean;
};

/** What the AI provider reported for work that gave a usable result. */
export type CreditUsageResult = {
	provider: string;
	model: string;
	inputTokens: number;
	outputTokens: number;
	/** Null when no token prices are configured: the tokens are kept, the cost isn't guessed. */
	costUsdMicros: number | null;
};

export type CreditHistoryEntry =
	| {
			type: "grant";
			id: string;
			at: Date;
			source: CreditSource;
			amount: number;
			remaining: number;
			expiresAt: Date;
			revokedAt: Date | null;
	  }
	| { type: "usage"; id: string; at: Date; action: string; credits: number; status: CreditUsageStatus };

const spendable = (userId: string, now: Date) =>
	and(
		eq(schema.aiCreditGrant.userId, userId),
		isNull(schema.aiCreditGrant.revokedAt),
		gt(schema.aiCreditGrant.expiresAt, now),
		gt(schema.aiCreditGrant.remaining, 0),
	);

const bySoonestExpiry = [asc(schema.aiCreditGrant.expiresAt), asc(schema.aiCreditGrant.id)];

/** Grants the account can spend at `now`, soonest expiry first. Call it holding the billing lock. */
function lockSpendable(tx: Transaction, userId: string, now: Date) {
	return tx
		.select()
		.from(schema.aiCreditGrant)
		.where(spendable(userId, now))
		.orderBy(...bySoonestExpiry)
		.for("update");
}

const total = (grants: readonly { remaining: number }[]) => grants.reduce((sum, grant) => sum + grant.remaining, 0);

/** Takes `credits` from grants in the order given, soonest expiry first. Null when together they hold too few. */
export function allocateCredits(
	grants: readonly { id: string; remaining: number }[],
	credits: number,
): CreditAllocation[] | null {
	const allocations: CreditAllocation[] = [];
	let left = credits;
	for (const grant of grants) {
		if (left <= 0) break;
		const taken = Math.min(grant.remaining, left);
		if (taken <= 0) continue;
		allocations.push({ grantId: grant.id, credits: taken });
		left -= taken;
	}
	return left > 0 ? null : allocations;
}

const plural = (count: number, one: string, other: string) => `${count} ${count === 1 ? one : other}`;

/**
 * Too few credits for a piece of work. The message stays neutral (no prices, no buying, no links) because the apps
 * show it as it is, and names the alternative that needs no credits.
 */
export function insufficientCredits(required: number, balance: number) {
	return new ORPCError("INSUFFICIENT_CREDITS", {
		status: 403,
		message: `This needs ${plural(required, "Rezumi AI credit", "Rezumi AI credits")} and ${balance} ${balance === 1 ? "is" : "are"} left. Your own AI connection works without credits.`,
		data: { required, balance },
	});
}

async function takeFromGrants(tx: Transaction, userId: string, allocations: readonly CreditAllocation[]) {
	for (const allocation of allocations)
		await tx
			.update(schema.aiCreditGrant)
			.set({ remaining: sql`${schema.aiCreditGrant.remaining} - ${allocation.credits}` })
			.where(and(eq(schema.aiCreditGrant.id, allocation.grantId), eq(schema.aiCreditGrant.userId, userId)));
}

/** Adds credits to an account. Runs inside the caller's transaction, for example the one that fulfils a payment. */
export async function grantCredits(
	tx: Transaction,
	input: {
		userId: string;
		source: CreditSource;
		amount: number;
		expiresAt: Date;
		paymentId?: string | null;
		note?: string | null;
		now?: Date;
	},
): Promise<GrantRow> {
	const now = input.now ?? new Date();
	if (!Number.isInteger(input.amount) || input.amount <= 0)
		throw new Error("A credit grant needs a positive whole amount.");
	if (input.expiresAt <= now) throw new Error("A credit grant must expire in the future.");
	await lockBillingAccount(tx, input.userId);
	const [grant] = await tx
		.insert(schema.aiCreditGrant)
		.values({
			userId: input.userId,
			source: input.source,
			amount: input.amount,
			remaining: input.amount,
			expiresAt: input.expiresAt,
			paymentId: input.paymentId ?? null,
			note: input.note ?? null,
			createdAt: now,
		})
		.returning();
	if (!grant) throw new Error("The credit grant was not saved.");
	return grant;
}

/**
 * A month of Pro AI credits for a subscription: at most one grant per subscription per month (its end), whatever
 * orders a plan change or a retried event makes. Null when that month was granted already. Runs inside the caller's
 * transaction, holding the account's billing lock.
 */
export async function grantSubscriptionMonth(
	tx: Transaction,
	input: {
		userId: string;
		subscriptionId: string;
		paymentId: string | null;
		amount: number;
		/** The end of the month the credits are for; they expire then. */
		expiresAt: Date;
		now?: Date;
	},
): Promise<GrantRow | null> {
	const now = input.now ?? new Date();
	if (!Number.isInteger(input.amount) || input.amount <= 0)
		throw new Error("A credit grant needs a positive whole amount.");
	if (input.expiresAt <= now) return null;
	await lockBillingAccount(tx, input.userId);
	const [grant] = await tx
		.insert(schema.aiCreditGrant)
		.values({
			userId: input.userId,
			source: "plan",
			amount: input.amount,
			remaining: input.amount,
			expiresAt: input.expiresAt,
			paymentId: input.paymentId,
			subscriptionId: input.subscriptionId,
			createdAt: now,
		})
		.onConflictDoNothing({ target: [schema.aiCreditGrant.subscriptionId, schema.aiCreditGrant.expiresAt] })
		.returning();
	return grant ?? null;
}

/**
 * Gives the one-time trial credits the first time an account uses Rezumi AI: a registered account with a verified
 * email, while billing applies to it. `billing_account.trial_granted_at` keeps it to once per account, across
 * devices and sign-ins. Returns whether it granted them now. Grants nothing, and reads nothing, while billing is off.
 */
export async function ensureTrialCredits(tx: Transaction, userId: string, now = new Date()): Promise<boolean> {
	const mode = getBillingMode();
	if (mode === "off") return false;
	const [owner] = await tx
		.select({ role: schema.user.role, emailVerified: schema.user.emailVerified, isAnonymous: schema.user.isAnonymous })
		.from(schema.user)
		.where(eq(schema.user.id, userId));
	if (!owner || owner.isAnonymous || !owner.emailVerified || !isBillingActiveFor(owner, mode)) return false;
	const account = await lockBillingAccount(tx, userId);
	if (account.trialGrantedAt) return false;
	await grantCredits(tx, {
		userId,
		source: "trial",
		amount: TRIAL_CREDITS.amount,
		expiresAt: new Date(+now + TRIAL_CREDITS.validDays * DAY_MS),
		now,
	});
	await tx.update(schema.billingAccount).set({ trialGrantedAt: now }).where(eq(schema.billingAccount.userId, userId));
	return true;
}

/**
 * Reserves the credits a piece of Rezumi AI work costs, before it runs, from the soonest-expiring grants. The same
 * `idempotencyKey` for the same action (a double click, a network retry) returns the first reservation instead of
 * taking credits twice. Throws INSUFFICIENT_CREDITS when the balance is too low.
 */
export async function reserveCredits(input: {
	userId: string;
	actionKey: CreditAction;
	idempotencyKey: string;
	now?: Date;
}): Promise<CreditReservation> {
	const credits: number | undefined = CREDIT_COSTS[input.actionKey];
	if (!credits) throw new Error(`Rezumi AI has no action named ${input.actionKey}.`);
	const key = input.idempotencyKey.trim();
	if (!key || key.length > 200)
		throw new ORPCError("BAD_REQUEST", { message: "A request key of 1 to 200 characters is required." });
	const now = input.now ?? new Date();
	const operationKey = `${input.userId}:${input.actionKey}:${key}`;
	// Kept async so the checks above reject like every other failure instead of throwing synchronously.
	return await db.transaction(async (tx) => {
		await lockBillingAccount(tx, input.userId);
		const grants = await lockSpendable(tx, input.userId, now);
		const balance = total(grants);
		const [existing] = await tx
			.select()
			.from(schema.aiCreditUsage)
			.where(eq(schema.aiCreditUsage.operationKey, operationKey));
		if (existing)
			return {
				usageId: existing.id,
				credits: existing.credits,
				balanceAfter: balance,
				status: existing.status,
				created: false,
			};
		const allocations = allocateCredits(grants, credits);
		if (!allocations) throw insufficientCredits(credits, balance);
		await takeFromGrants(tx, input.userId, allocations);
		const [usage] = await tx
			.insert(schema.aiCreditUsage)
			.values({
				userId: input.userId,
				operationKey,
				action: input.actionKey,
				credits,
				status: "reserved",
				allocations,
				createdAt: now,
			})
			.returning();
		if (!usage) throw new Error("The credit reservation was not saved.");
		return { usageId: usage.id, credits, balanceAfter: balance - credits, status: "reserved", created: true };
	});
}

/**
 * Gives a reservation's credits back to the grants they came from. An expired grant takes them back unspendable. What
 * the provider was paid for the failed work, when known, is kept with it.
 */
async function releaseReserved(
	tx: Transaction,
	usage: UsageRow,
	errorCode: string,
	now: Date,
	spent?: CreditUsageResult,
) {
	for (const allocation of usage.allocations)
		await tx
			.update(schema.aiCreditGrant)
			.set({ remaining: sql`${schema.aiCreditGrant.remaining} + ${allocation.credits}` })
			.where(and(eq(schema.aiCreditGrant.id, allocation.grantId), eq(schema.aiCreditGrant.userId, usage.userId)));
	const [released] = await tx
		.update(schema.aiCreditUsage)
		.set({ status: "released", errorCode, settledAt: now, ...spent })
		.where(eq(schema.aiCreditUsage.id, usage.id))
		.returning();
	if (!released) throw new Error("The credit reservation is missing.");
	return released;
}

/** Settles a reservation under the account's lock. Settling one that is no longer reserved changes nothing. */
async function settle(usageId: string, apply: (tx: Transaction, usage: UsageRow) => Promise<UsageRow>) {
	const [owner] = await db
		.select({ userId: schema.aiCreditUsage.userId })
		.from(schema.aiCreditUsage)
		.where(eq(schema.aiCreditUsage.id, usageId));
	if (!owner) throw new ORPCError("NOT_FOUND", { message: "No credit reservation has that ID." });
	const usage = await db.transaction(async (tx) => {
		await lockBillingAccount(tx, owner.userId);
		const [current] = await tx
			.select()
			.from(schema.aiCreditUsage)
			.where(eq(schema.aiCreditUsage.id, usageId))
			.for("update");
		if (!current) throw new ORPCError("NOT_FOUND", { message: "No credit reservation has that ID." });
		return current.status === "reserved" ? apply(tx, current) : current;
	});
	return { usageId: usage.id, credits: usage.credits, status: usage.status };
}

/** Keeps a reservation's credits spent once the work gave a usable result, with what the provider reported. */
export function commitCredits(usageId: string, result: CreditUsageResult, now = new Date()) {
	return settle(usageId, async (tx, usage) => {
		const [committed] = await tx
			.update(schema.aiCreditUsage)
			.set({ status: "committed", settledAt: now, ...result })
			.where(eq(schema.aiCreditUsage.id, usage.id))
			.returning();
		if (!committed) throw new Error("The credit reservation is missing.");
		return committed;
	});
}

/**
 * Gives a reservation's credits back when the work failed or was cancelled before a usable result. `spent` records
 * what the provider still charged for it.
 */
export function releaseCredits(usageId: string, errorCode: string, now = new Date(), spent?: CreditUsageResult) {
	return settle(usageId, (tx, usage) => releaseReserved(tx, usage, errorCode, now, spent));
}

/**
 * Takes credits away by hand, soonest-expiring first, recorded as a committed usage so the history shows it. Runs
 * inside the caller's transaction. Throws when the account holds fewer: a balance never goes below zero.
 */
export async function deductCredits(
	tx: Transaction,
	input: { userId: string; credits: number; now?: Date },
): Promise<{ usageId: string; balanceBefore: number; balanceAfter: number }> {
	if (!Number.isInteger(input.credits) || input.credits <= 0)
		throw new Error("A credit correction needs a positive whole amount.");
	const now = input.now ?? new Date();
	await lockBillingAccount(tx, input.userId);
	const grants = await lockSpendable(tx, input.userId, now);
	const balance = total(grants);
	const allocations = allocateCredits(grants, input.credits);
	if (!allocations)
		throw new ORPCError("BAD_REQUEST", {
			message: `The account has ${plural(balance, "credit", "credits")}, fewer than the ${input.credits} to take away.`,
			data: { balance },
		});
	await takeFromGrants(tx, input.userId, allocations);
	const [usage] = await tx
		.insert(schema.aiCreditUsage)
		.values({
			userId: input.userId,
			operationKey: `${input.userId}:${ADMIN_ADJUSTMENT_ACTION}:${generateId()}`,
			action: ADMIN_ADJUSTMENT_ACTION,
			credits: input.credits,
			status: "committed",
			allocations,
			createdAt: now,
			settledAt: now,
		})
		.returning();
	if (!usage) throw new Error("The credit correction was not saved.");
	return { usageId: usage.id, balanceBefore: balance, balanceAfter: balance - input.credits };
}

/** The account's spendable credits, the soonest expiry among them, and where its trial stands. */
export async function getCreditBalance(
	userId: string,
	now = new Date(),
	database: DbOrTx = db,
): Promise<CreditBalance> {
	// One query after another: `database` may be a transaction, whose single connection runs one query at a time.
	const grants = await database
		.select({ remaining: schema.aiCreditGrant.remaining, expiresAt: schema.aiCreditGrant.expiresAt })
		.from(schema.aiCreditGrant)
		.where(spendable(userId, now))
		.orderBy(...bySoonestExpiry);
	const [owner] = await database
		.select({
			emailVerified: schema.user.emailVerified,
			isAnonymous: schema.user.isAnonymous,
			trialGrantedAt: schema.billingAccount.trialGrantedAt,
		})
		.from(schema.user)
		.leftJoin(schema.billingAccount, eq(schema.billingAccount.userId, schema.user.id))
		.where(eq(schema.user.id, userId));
	const grantedAt = owner?.trialGrantedAt ?? null;
	const [trialGrant] = grantedAt
		? await database
				.select({ expiresAt: schema.aiCreditGrant.expiresAt })
				.from(schema.aiCreditGrant)
				.where(and(eq(schema.aiCreditGrant.userId, userId), eq(schema.aiCreditGrant.source, "trial")))
				.orderBy(asc(schema.aiCreditGrant.createdAt))
				.limit(1)
		: [];
	const soonest = grants[0]?.expiresAt;
	return {
		balance: total(grants),
		nextExpiry: soonest
			? { at: soonest, credits: total(grants.filter((grant) => +grant.expiresAt === +soonest)) }
			: null,
		trial: {
			available: !grantedAt && Boolean(owner?.emailVerified) && !owner?.isAnonymous,
			grantedAt,
			expiresAt: trialGrant?.expiresAt ?? null,
		},
	};
}

/** The account's grants and usages, newest first. */
export async function listCreditHistory(
	userId: string,
	page: { limit: number; offset: number },
): Promise<{ items: CreditHistoryEntry[]; hasMore: boolean }> {
	// Enough of each list to fill the page after merging, and one more to tell whether another page follows.
	const take = page.offset + page.limit + 1;
	const [grants, usages] = await Promise.all([
		db
			.select()
			.from(schema.aiCreditGrant)
			.where(eq(schema.aiCreditGrant.userId, userId))
			.orderBy(desc(schema.aiCreditGrant.createdAt), desc(schema.aiCreditGrant.id))
			.limit(take),
		db
			.select()
			.from(schema.aiCreditUsage)
			.where(eq(schema.aiCreditUsage.userId, userId))
			.orderBy(desc(schema.aiCreditUsage.createdAt), desc(schema.aiCreditUsage.id))
			.limit(take),
	]);
	const entries: CreditHistoryEntry[] = [
		...grants.map((grant) => ({
			type: "grant" as const,
			id: grant.id,
			at: grant.createdAt,
			source: grant.source,
			amount: grant.amount,
			remaining: grant.remaining,
			expiresAt: grant.expiresAt,
			revokedAt: grant.revokedAt,
		})),
		...usages.map((usage) => ({
			type: "usage" as const,
			id: usage.id,
			at: usage.createdAt,
			action: usage.action,
			credits: usage.credits,
			status: usage.status,
		})),
	].toSorted((a, b) => +b.at - +a.at || (a.id < b.id ? 1 : a.id > b.id ? -1 : 0));
	return {
		items: entries.slice(page.offset, page.offset + page.limit),
		hasMore: entries.length > page.offset + page.limit,
	};
}

/**
 * Gives back the credits of reservations still waiting after STALE_RESERVATION_MS, when the work that took them
 * stopped without settling. Safe to run twice at once: an account another run (or a request) is changing is skipped
 * this round, and a reservation settled meanwhile is left alone. Returns how many it released.
 */
export async function releaseStaleReservations(now = new Date()): Promise<number> {
	const cutoff = new Date(+now - STALE_RESERVATION_MS);
	const stale = await db
		.select({ id: schema.aiCreditUsage.id, userId: schema.aiCreditUsage.userId })
		.from(schema.aiCreditUsage)
		.where(and(eq(schema.aiCreditUsage.status, "reserved"), lt(schema.aiCreditUsage.createdAt, cutoff)))
		.orderBy(asc(schema.aiCreditUsage.createdAt))
		.limit(STALE_BATCH);
	const byUser = new Map<string, string[]>();
	for (const usage of stale) byUser.set(usage.userId, [...(byUser.get(usage.userId) ?? []), usage.id]);
	let released = 0;
	for (const [userId, usageIds] of byUser) {
		try {
			released += await db.transaction(async (tx) => {
				// The account lock first, as every credit change takes it, but without waiting for a busy account.
				const [account] = await tx
					.select({ userId: schema.billingAccount.userId })
					.from(schema.billingAccount)
					.where(eq(schema.billingAccount.userId, userId))
					.for("update", { skipLocked: true });
				if (!account) return 0;
				const rows = await tx
					.select()
					.from(schema.aiCreditUsage)
					.where(
						and(
							inArray(schema.aiCreditUsage.id, usageIds),
							eq(schema.aiCreditUsage.status, "reserved"),
							lt(schema.aiCreditUsage.createdAt, cutoff),
						),
					)
					.for("update");
				for (const row of rows) await releaseReserved(tx, row, "stale_reservation", now);
				return rows.length;
			});
		} catch {
			console.error("[billing] Releasing stale credit reservations failed for one account; it retries next run.");
		}
	}
	return released;
}
