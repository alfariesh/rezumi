import type { DbOrTx } from "@rezumi/db/client";
import type { PaidPlanId, PlanFeatures, PlanId } from "@rezumi/schema/billing";
import { and, asc, eq, gt, isNull } from "drizzle-orm";
import { db } from "@rezumi/db/client";
import * as schema from "@rezumi/db/schema";
import { env } from "@rezumi/env/server";
import { PLANS } from "@rezumi/schema/billing";

export type BillingMode = "off" | "admins" | "on";

/** A stretch of one plan; back-to-back periods of the same plan read as one. */
export type PlanStretch = { planId: PaidPlanId; startsAt: Date; endsAt: Date };

export type Entitlements = {
	/** Whether plans apply to this account. When false it's unlimited, as before plans existed, and planId means nothing. */
	enabled: boolean;
	planId: PlanId;
	features: PlanFeatures;
	/** Null when unlimited. */
	limits: { activeResumes: number | null; activeCoverLetters: number | null };
	/** When the current plan's access ends, counting back-to-back passes of the same plan. Null on free. */
	currentPeriodEndsAt: Date | null;
	/** Passes waiting after the current one, in order. */
	upcoming: PlanStretch[];
};

const unlimited = (): Entitlements => ({
	enabled: false,
	planId: "free",
	features: { premiumTemplates: true, wordOdtExport: true, customStyles: true, customFonts: true, automationApi: true },
	limits: { activeResumes: null, activeCoverLetters: null },
	currentPeriodEndsAt: null,
	upcoming: [],
});

export function getBillingMode(): BillingMode {
	return env.BILLING_MODE;
}

/** Whether plans apply to an account: everyone when on, only admins while testing, nobody when off. */
export function isBillingActiveFor(account: { role?: string | null | undefined }, mode = getBillingMode()): boolean {
	if (mode === "on") return true;
	if (mode === "admins") return account.role === "admin";
	return false;
}

/** The account's plan at `now`, from its unrevoked periods. */
export function resolveEntitlements(periods: readonly PlanStretch[], now: Date): Entitlements {
	const stretches: PlanStretch[] = [];
	for (const period of periods.filter((item) => item.endsAt > now).toSorted((a, b) => +a.startsAt - +b.startsAt)) {
		const last = stretches.at(-1);
		if (last && last.planId === period.planId && +last.endsAt === +period.startsAt) last.endsAt = period.endsAt;
		else stretches.push({ ...period });
	}
	const current = stretches[0] && stretches[0].startsAt <= now ? stretches[0] : null;
	const plan = PLANS[current?.planId ?? "free"];
	return {
		enabled: true,
		planId: plan.id,
		features: { ...plan.features },
		limits: { ...plan.limits },
		currentPeriodEndsAt: current?.endsAt ?? null,
		upcoming: current ? stretches.slice(1) : stretches,
	};
}

/**
 * What the account may do right now. Read it from the database on every request that enforces it; never cache it as
 * the source of truth. While billing doesn't apply to the account this touches no table and grants everything.
 */
export async function getEntitlements(userId: string, now = new Date(), database: DbOrTx = db): Promise<Entitlements> {
	const mode = getBillingMode();
	if (mode === "off") return unlimited();
	if (mode === "admins") {
		const [account] = await database
			.select({ role: schema.user.role })
			.from(schema.user)
			.where(eq(schema.user.id, userId));
		if (!account || !isBillingActiveFor(account, mode)) return unlimited();
	}
	const periods = await database
		.select({
			planId: schema.membershipPeriod.planId,
			startsAt: schema.membershipPeriod.startsAt,
			endsAt: schema.membershipPeriod.endsAt,
		})
		.from(schema.membershipPeriod)
		.where(
			and(
				eq(schema.membershipPeriod.userId, userId),
				isNull(schema.membershipPeriod.revokedAt),
				gt(schema.membershipPeriod.endsAt, now),
			),
		)
		.orderBy(asc(schema.membershipPeriod.startsAt));
	return resolveEntitlements(periods, now);
}
