import type { JobCounters } from "./counters";
import type { Ratelimiter } from "@orpc/experimental-ratelimit";
import type { PlanId } from "@rezumi/schema/billing";
import { eq } from "drizzle-orm";
import { db } from "@rezumi/db/client";
import * as schema from "@rezumi/db/schema";
import { env } from "@rezumi/env/server";
import { PLANS } from "@rezumi/schema/billing";
import { rateLimitConfig } from "@rezumi/utils/rate-limit";
import { createRateLimiter } from "../../redis";
import { raiseBillingAlertQuietly } from "../billing/alerts";
import { getEntitlements } from "../billing/entitlements";
import { activeLimitOverride } from "../billing/limit-overrides";
import { dayInTimeZone, startOfDayInTimeZone } from "../portfolio/traffic";

/**
 * What limits job searching (`02-teknis.md` section 8): a short burst limit per account, the plan's searches per day
 * (K2) and the server's daily spending on the providers (K7). Quota and budget live in the shared counters, so every
 * Worker sees the same numbers.
 */

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const utcDay = (now: Date) => now.toISOString().slice(0, 10);
/** Until a little past the next UTC midnight. */
const budgetWindow = (now: Date) => Date.parse(`${utcDay(now)}T00:00:00Z`) + DAY_MS - now.getTime() + HOUR_MS;

// ---- Burst limit -------------------------------------------------------------------------------------------------

type BurstLimiter = { limit: (options: { key: string }) => Promise<{ success: boolean }> };

let readBinding: (() => BurstLimiter | undefined) | undefined;

/** Workers passes its `JOB_SEARCH_LIMITER` binding, which answers inside the colo without a network call. */
export function configureJobSearchLimiter(read: () => BurstLimiter | undefined): void {
	readBinding = read;
}

let fallback: Ratelimiter | undefined;

/** Whether the account may search again now. A limiter that fails lets the search through. */
export async function jobSearchBurstAllowed(userId: string): Promise<boolean> {
	if (env.FLAG_DISABLE_API_RATE_LIMIT) return true;
	try {
		const binding = readBinding?.();
		if (binding) return (await binding.limit({ key: userId })).success;
		fallback ??= createRateLimiter("jobSearchLimiter", rateLimitConfig.orpc.jobSearch);
		return (await fallback.limit(userId)).success;
	} catch {
		return true;
	}
}

// ---- Daily quota (K2) --------------------------------------------------------------------------------------------

export type QuotaDay = {
	max: number;
	planId: PlanId;
	/** The account's calendar day, `YYYY-MM-DD`. */
	day: string;
	/** Midnight after `day` in the account's time zone. */
	resetsAt: Date;
};

/**
 * The plan's searches a day; while plans don't apply to the account, Pro AI's. A number an administrator set for the
 * account replaces either while it lasts.
 */
export async function quotaDay(userId: string, now: Date): Promise<QuotaDay> {
	const [entitlements, [owner], override] = await Promise.all([
		getEntitlements(userId, now),
		db.select({ timezone: schema.user.timezone }).from(schema.user).where(eq(schema.user.id, userId)),
		activeLimitOverride(userId, "jobSearchesPerDay", now),
	]);
	const timeZone = owner?.timezone ?? "UTC";
	const day = dayInTimeZone(now, timeZone);
	const next = new Date(Date.parse(`${day}T00:00:00Z`) + DAY_MS).toISOString().slice(0, 10);
	const planMax = entitlements.enabled
		? (entitlements.limits.jobSearchesPerDay ?? PLANS["pro-ai"].limits.jobSearchesPerDay)
		: PLANS["pro-ai"].limits.jobSearchesPerDay;
	const max = override ?? planMax;
	return { max, planId: entitlements.planId, day, resetsAt: startOfDayInTimeZone(next, timeZone) };
}

/** The counter lives a little past the account's midnight; its key names the day, so days never share it. */
const quotaWindow = (quota: QuotaDay, now: Date) => Math.max(1, quota.resetsAt.getTime() - now.getTime()) + HOUR_MS;
const quotaKey = (userId: string, quota: QuotaDay) => `quota:${userId}:${quota.day}`;
const seenKey = (userId: string, quota: QuotaDay, pageKey: string) => `seen:${userId}:${quota.day}:${pageKey}`;

/**
 * The same searches counted per UTC day, so changing the account's time zone can't start new days over and over. An
 * account's day overlaps two UTC days, so a UTC day holds at most two days' searches; past that the day's are used up.
 */
const utcQuotaKey = (userId: string, now: Date) => `quota-utc:${userId}:${utcDay(now)}`;

/** Searches counted today: the account's day, or more when its UTC days already hold two days' worth. */
export async function quotaUsed(counters: JobCounters, userId: string, quota: QuotaDay, now: Date): Promise<number> {
	const [day, utc] = await Promise.all([
		counters.add(quotaKey(userId, quota), 0, { window: quotaWindow(quota, now) }),
		counters.add(utcQuotaKey(userId, now), 0, { window: budgetWindow(now) }),
	]);
	return Math.max(day.total, utc.total - quota.max);
}

/** Whether the account opened this page of results already today; opening it again isn't counted (section 7). */
export async function pageSeenToday(
	counters: JobCounters,
	userId: string,
	quota: QuotaDay,
	pageKey: string,
	now: Date,
): Promise<boolean> {
	return (await counters.add(seenKey(userId, quota, pageKey), 0, { window: quotaWindow(quota, now) })).total > 0;
}

/**
 * Counts one search and remembers the page as opened today. Refused, and nothing counted, when the day's searches are
 * used up; answers the count after.
 */
export async function countSearch(
	counters: JobCounters,
	userId: string,
	quota: QuotaDay,
	pageKey: string,
	now: Date,
): Promise<{ allowed: boolean; used: number }> {
	const window = quotaWindow(quota, now);
	const utc = await counters.add(utcQuotaKey(userId, now), 1, { window: budgetWindow(now), max: quota.max * 2 });
	if (!utc.allowed) return { allowed: false, used: quota.max };
	const result = await counters.add(quotaKey(userId, quota), 1, { window, max: quota.max });
	if (result.allowed) await counters.add(seenKey(userId, quota, pageKey), 1, { window });
	return { allowed: result.allowed, used: result.total };
}

// ---- Server budget (K7) ------------------------------------------------------------------------------------------

/** Share of the budget after which a warning is logged once. */
const WARN_SHARE = 0.8;

const budgetKey = (now: Date) => `budget:${utcDay(now)}`;

/** Today's budget in millionths of a US dollar (`JOB_SEARCH_DAILY_BUDGET_USD`, default $1). */
export const dailyBudgetMicro = () => Math.round((env.JOB_SEARCH_DAILY_BUDGET_USD ?? 1) * 1_000_000);

/** What the providers cost so far this UTC day, in millionths of a US dollar. */
export async function spentToday(counters: JobCounters, now: Date): Promise<number> {
	return (await counters.add(budgetKey(now), 0, { window: budgetWindow(now) })).total;
}

/** Whether today's budget still allows asking a provider. */
export async function budgetLeft(counters: JobCounters, now: Date): Promise<boolean> {
	return (await spentToday(counters, now)) < dailyBudgetMicro();
}

/**
 * Adds what a provider call cost to today's total. Once the total passes 80% of the budget it logs a warning and raises
 * the owner's alert (emailed with the billing alerts), once: only the call that crosses the line does.
 */
export async function recordSpend(counters: JobCounters, costMicro: number, now: Date): Promise<void> {
	const amount = Math.max(0, Math.round(costMicro));
	if (amount === 0) return;
	const { total } = await counters.add(budgetKey(now), amount, { window: budgetWindow(now) });
	const warnAt = dailyBudgetMicro() * WARN_SHARE;
	if (total >= warnAt && total - amount < warnAt) {
		console.warn(
			`[jobs] Job search spending passed ${WARN_SHARE * 100}% of today's budget: $${(total / 1e6).toFixed(4)} of $${(dailyBudgetMicro() / 1e6).toFixed(2)}.`,
		);
		await raiseBillingAlertQuietly({ kind: "job_search_budget", now });
	}
}
