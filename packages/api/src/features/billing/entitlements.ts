import type { SubscriptionState } from "./polar/mapping";
import type { DbOrTx } from "@rezumi/db/client";
import type { PaidPlanId, PlanFeatures, PlanId } from "@rezumi/schema/billing";
import { and, asc, eq, gt, isNull } from "drizzle-orm";
import { db } from "@rezumi/db/client";
import * as schema from "@rezumi/db/schema";
import { env } from "@rezumi/env/server";
import { PLANS } from "@rezumi/schema/billing";
import { subscriptionAccess } from "./polar/mapping";
import { liveSubscriptions, subscriptionState } from "./subscriptions";

export type BillingMode = "off" | "admins" | "on";

/** A stretch of one plan; back-to-back periods of the same plan read as one. */
export type PlanStretch = { planId: PaidPlanId; startsAt: Date; endsAt: Date };

export type Entitlements = {
	/** Whether plans apply to this account. When false it's unlimited, as before plans existed, and planId means nothing. */
	enabled: boolean;
	planId: PlanId;
	features: PlanFeatures;
	/** Null when unlimited. */
	limits: {
		activeResumes: number | null;
		activeCoverLetters: number | null;
		portfolioWorks: number | null;
		portfolioStorageBytes: number | null;
	};
	/**
	 * When the current plan's access ends (or renews), counting back-to-back periods of the same plan. Null on free.
	 */
	currentPeriodEndsAt: Date | null;
	/** Where the current plan comes from: a subscription, or a period granted outside one (admin, promo, old pass). */
	source: "subscription" | "period" | null;
	/** Whether the current plan renews on its own at currentPeriodEndsAt: a subscription not set to cancel. */
	renews: boolean;
	/** Granted periods waiting after the current one, in order. */
	upcoming: PlanStretch[];
};

const unlimited = (): Entitlements => ({
	enabled: false,
	planId: "free",
	features: {
		premiumTemplates: true,
		brandLogos: true,
		wordOdtExport: true,
		customStyles: true,
		customFonts: true,
		automationApi: true,
		premiumPortfolioThemes: true,
		premiumHeroEffects: true,
		hidePortfolioCredit: true,
		customDomain: true,
		detailedPortfolioStats: true,
	},
	limits: { activeResumes: null, activeCoverLetters: null, portfolioWorks: null, portfolioStorageBytes: null },
	currentPeriodEndsAt: null,
	source: null,
	renews: false,
	upcoming: [],
});

export function getBillingMode(): BillingMode {
	// The env schema defaults it; a missing value (a partial env in tests) still means off.
	return env.BILLING_MODE ?? "off";
}

/** Whether plans apply to an account: everyone when on, only admins while testing, nobody when off. */
export function isBillingActiveFor(account: { role?: string | null | undefined }, mode = getBillingMode()): boolean {
	if (mode === "on") return true;
	if (mode === "admins") return account.role === "admin";
	return false;
}

/**
 * The account's plan at `now`: the higher of what its unrevoked periods and its subscriptions give. Periods queue
 * without overlapping (admin grants, promotions, passes from before subscriptions); a subscription runs beside them.
 */
export function resolveEntitlements(
	periods: readonly PlanStretch[],
	now: Date,
	subscriptions: readonly SubscriptionState[] = [],
): Entitlements {
	const stretches: PlanStretch[] = [];
	for (const period of periods.filter((item) => item.endsAt > now).toSorted((a, b) => +a.startsAt - +b.startsAt)) {
		const last = stretches.at(-1);
		if (last && last.planId === period.planId && +last.endsAt === +period.startsAt) last.endsAt = period.endsAt;
		else stretches.push({ ...period });
	}
	const granted = stretches[0] && stretches[0].startsAt <= now ? stretches[0] : null;
	let current: { planId: PaidPlanId; endsAt: Date; source: "subscription" | "period"; renews: boolean } | null = granted
		? { planId: granted.planId, endsAt: granted.endsAt, source: "period", renews: false }
		: null;
	for (const subscription of subscriptions) {
		const access = subscriptionAccess(subscription, now);
		if (!access) continue;
		const rank = PLANS[access.planId].rank;
		const currentRank = current ? PLANS[current.planId].rank : -1;
		// The higher plan wins; on the same plan the subscription does, since it is what renews.
		if (rank > currentRank || (rank === currentRank && current?.source === "period"))
			current = { planId: access.planId, endsAt: access.endsAt, source: "subscription", renews: access.renews };
	}
	const plan = PLANS[current?.planId ?? "free"];
	return {
		enabled: true,
		planId: plan.id,
		features: { ...plan.features },
		limits: { ...plan.limits },
		currentPeriodEndsAt: current?.endsAt ?? null,
		source: current?.source ?? null,
		renews: current?.renews ?? false,
		upcoming: granted ? stretches.slice(1) : stretches,
	};
}

/**
 * Whether billing applies to an account, reading its role from the database rather than the session. Touches no table
 * when billing is off or on for everyone.
 */
export async function isBillingAppliedTo(userId: string, database: DbOrTx = db): Promise<boolean> {
	const mode = getBillingMode();
	if (mode !== "admins") return mode === "on";
	const [account] = await database
		.select({ role: schema.user.role })
		.from(schema.user)
		.where(eq(schema.user.id, userId));
	return Boolean(account && isBillingActiveFor(account, mode));
}

/**
 * What the account may do right now. Read it from the database on every request that enforces it; never cache it as
 * the source of truth. While billing doesn't apply to the account this touches no table and grants everything.
 */
export async function getEntitlements(userId: string, now = new Date(), database: DbOrTx = db): Promise<Entitlements> {
	if (!(await isBillingAppliedTo(userId, database))) return unlimited();
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
	const subscriptions = await liveSubscriptions(userId, database);
	return resolveEntitlements(periods, now, subscriptions.map(subscriptionState));
}
