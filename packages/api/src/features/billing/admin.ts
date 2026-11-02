import type { PaidPlanId } from "@rezumi/schema/billing";
import { ORPCError } from "@orpc/server";
import { eq, sql } from "drizzle-orm";
import { db } from "@rezumi/db/client";
import * as schema from "@rezumi/db/schema";
import { lockBillingAccount } from "./account";
import { deductCredits, getCreditBalance, grantCredits } from "./credits";
import { grantMembershipPeriod, revokeMembershipPeriod } from "./periods";
import { DAY_MS } from "./timeline";

/** Billing tools for the owner: web sessions of accounts with the admin role only. */
export async function assertBillingAdmin(authentication: { user: { id: string }; method: string } | null | undefined) {
	if (authentication?.method !== "session")
		throw new ORPCError("FORBIDDEN", { message: "Billing tools are only available in a web browser." });
	const [account] = await db
		.select({ role: schema.user.role })
		.from(schema.user)
		.where(eq(schema.user.id, authentication.user.id));
	if (account?.role !== "admin") throw new ORPCError("FORBIDDEN", { message: "Only administrators can do this." });
}

async function findUserId(target: { userId?: string | undefined; email?: string | undefined }) {
	const [account] = await db
		.select({ id: schema.user.id })
		.from(schema.user)
		.where(
			target.userId
				? eq(schema.user.id, target.userId)
				: sql`lower(${schema.user.email}) = lower(${target.email ?? ""})`,
		);
	if (!account) throw new ORPCError("NOT_FOUND", { message: "No account matches that user." });
	return account.id;
}

const periodSummary = (period: typeof schema.membershipPeriod.$inferSelect) => ({
	id: period.id,
	userId: period.userId,
	planId: period.planId,
	startsAt: period.startsAt,
	endsAt: period.endsAt,
});

export const billingAdmin = {
	/** Gives an account a pass by hand, queued like a purchase. For support and testing before payments exist. */
	grantPeriod: async (input: {
		actorUserId: string;
		userId?: string | undefined;
		email?: string | undefined;
		planId: PaidPlanId;
		days: number;
		reason: string;
	}) => {
		const userId = await findUserId(input);
		return db.transaction(async (tx) => {
			const period = await grantMembershipPeriod(tx, {
				userId,
				planId: input.planId,
				durationMs: input.days * DAY_MS,
				source: "admin",
				grantedBy: input.actorUserId,
			});
			await tx.insert(schema.billingAuditLog).values({
				actorUserId: input.actorUserId,
				targetUserId: userId,
				action: "period.granted",
				reason: input.reason,
				details: {
					periodId: period.id,
					planId: period.planId,
					days: input.days,
					startsAt: period.startsAt.toISOString(),
					endsAt: period.endsAt.toISOString(),
				},
			});
			return periodSummary(period);
		});
	},

	/**
	 * Corrects an account's Rezumi AI credits: a positive amount grants new credits that expire after `expiresInDays`;
	 * a negative one takes credits away, soonest-expiring first, never below zero. Recorded with its reason.
	 */
	adjustCredits: async (input: {
		actorUserId: string;
		userId?: string | undefined;
		email?: string | undefined;
		amount: number;
		expiresInDays?: number | undefined;
		reason: string;
	}) => {
		const userId = await findUserId(input);
		const now = new Date();
		const expiresInDays = input.expiresInDays;
		if (input.amount > 0 && !expiresInDays)
			throw new ORPCError("BAD_REQUEST", { message: "Say in how many days the credits expire." });
		return db.transaction(async (tx) => {
			await lockBillingAccount(tx, userId);
			const balanceBefore = (await getCreditBalance(userId, now, tx)).balance;
			let change: { grantId: string; expiresAt: Date } | { usageId: string };
			if (input.amount > 0 && expiresInDays) {
				const grant = await grantCredits(tx, {
					userId,
					source: "admin",
					amount: input.amount,
					expiresAt: new Date(+now + expiresInDays * DAY_MS),
					note: input.reason,
					now,
				});
				change = { grantId: grant.id, expiresAt: grant.expiresAt };
			} else {
				change = { usageId: (await deductCredits(tx, { userId, credits: -input.amount, now })).usageId };
			}
			const balance = balanceBefore + input.amount;
			const expiresAt = "expiresAt" in change ? change.expiresAt : null;
			await tx.insert(schema.billingAuditLog).values({
				actorUserId: input.actorUserId,
				targetUserId: userId,
				action: "credits.adjusted",
				reason: input.reason,
				details: {
					amount: input.amount,
					...change,
					...(expiresAt && { expiresAt: expiresAt.toISOString() }),
					balanceBefore,
					balanceAfter: balance,
				},
			});
			return { userId, amount: input.amount, balance, expiresAt };
		});
	},

	/** Takes a pass away: a running one ends now, a queued one is dropped, and later passes move up. */
	revokePeriod: async (input: { actorUserId: string; periodId: string; reason: string }) => {
		const [owner] = await db
			.select({ userId: schema.membershipPeriod.userId })
			.from(schema.membershipPeriod)
			.where(eq(schema.membershipPeriod.id, input.periodId));
		if (!owner) throw new ORPCError("NOT_FOUND", { message: "No membership period has that ID." });
		return db.transaction(async (tx) => {
			const result = await revokeMembershipPeriod(tx, {
				userId: owner.userId,
				periodId: input.periodId,
				reason: input.reason,
			});
			if (!result)
				throw new ORPCError("BAD_REQUEST", { message: "This membership period has already ended or been revoked." });
			await tx.insert(schema.billingAuditLog).values({
				actorUserId: input.actorUserId,
				targetUserId: owner.userId,
				action: "period.revoked",
				reason: input.reason,
				details: {
					periodId: result.before.id,
					planId: result.before.planId,
					startsAt: result.before.startsAt.toISOString(),
					endsAt: result.before.endsAt.toISOString(),
					endedAt: result.after.endsAt.toISOString(),
				},
			});
			return periodSummary(result.after);
		});
	},
};
