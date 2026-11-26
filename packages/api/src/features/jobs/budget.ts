import { eq } from "drizzle-orm";
import { db } from "@rezumi/db/client";
import * as schema from "@rezumi/db/schema";
import { env } from "@rezumi/env/server";

/**
 * The server's daily spending on the job providers (K7, `02-teknis.md` section 23). An administrator sets it on the cost
 * dashboard; it takes effect without a deploy. Without a setting it is `JOB_SEARCH_DAILY_BUDGET_USD` (default $1).
 * Every search reads it, so a Worker keeps the stored value for a minute: a change reaches every Worker within that.
 */

/** The most the dashboard can set, so a typo can't spend the treg balance in a day. */
export const JOB_SEARCH_BUDGET_MAX_USD = 50;
const SETTING_KEY = "daily_budget";
const CACHE_MS = 60_000;

/** The budget from the server's settings, in millionths of a US dollar. */
export const defaultBudgetMicro = () => Math.round((env.JOB_SEARCH_DAILY_BUDGET_USD ?? 1) * 1_000_000);

let stored: { value: number | undefined; readAt: number } | undefined;

/** Forgets the value this Worker kept, so the next read asks the database. */
export function forgetBudgetSetting(): void {
	stored = undefined;
}

async function storedBudgetMicro(now: number): Promise<number | undefined> {
	if (stored && now >= stored.readAt && now - stored.readAt < CACHE_MS) return stored.value;
	try {
		const [row] = await db
			.select({ value: schema.jobSearchSetting.value })
			.from(schema.jobSearchSetting)
			.where(eq(schema.jobSearchSetting.key, SETTING_KEY));
		stored = { value: row?.value, readAt: now };
	} catch (error) {
		// The last value read stays in use; without one, the server's default.
		console.error("[jobs] Reading the job search budget failed", error);
		if (!stored) return undefined;
	}
	return stored.value;
}

/** Today's budget in millionths of a US dollar: the dashboard's setting, else the server's default. */
export async function dailyBudgetMicro(now = Date.now()): Promise<number> {
	return (await storedBudgetMicro(now)) ?? defaultBudgetMicro();
}

export type JobSearchBudget = {
	budgetMicro: number;
	/** `setting`: set on the dashboard. `default`: the server's `JOB_SEARCH_DAILY_BUDGET_USD`. */
	source: "setting" | "default";
	defaultMicro: number;
	maxMicro: number;
	reason: string | null;
	updatedAt: Date | null;
	/** The administrator who set it, by name; null for the default or when the account is gone. */
	updatedBy: string | null;
};

/** The budget as the dashboard shows it, read fresh from the database. */
export async function readJobSearchBudget(): Promise<JobSearchBudget> {
	const [row] = await db
		.select({
			value: schema.jobSearchSetting.value,
			reason: schema.jobSearchSetting.reason,
			updatedAt: schema.jobSearchSetting.updatedAt,
			updatedBy: schema.user.name,
		})
		.from(schema.jobSearchSetting)
		.leftJoin(schema.user, eq(schema.user.id, schema.jobSearchSetting.updatedBy))
		.where(eq(schema.jobSearchSetting.key, SETTING_KEY));
	const defaultMicro = defaultBudgetMicro();
	return {
		budgetMicro: row?.value ?? defaultMicro,
		source: row ? "setting" : "default",
		defaultMicro,
		maxMicro: JOB_SEARCH_BUDGET_MAX_USD * 1_000_000,
		reason: row?.reason ?? null,
		updatedAt: row?.updatedAt ?? null,
		updatedBy: row?.updatedBy ?? null,
	};
}

/**
 * Sets the daily budget, or with `usd: null` goes back to the server's default. $0 stops paid searches: people get
 * saved results only. Written to the audit log with the reason.
 */
export async function setJobSearchBudget(input: {
	usd: number | null;
	reason: string;
	actorUserId: string;
}): Promise<JobSearchBudget> {
	const before = await readJobSearchBudget();
	const value = input.usd === null ? null : Math.round(input.usd * 1_000_000);
	if (value === null) {
		await db.delete(schema.jobSearchSetting).where(eq(schema.jobSearchSetting.key, SETTING_KEY));
	} else {
		await db
			.insert(schema.jobSearchSetting)
			.values({ key: SETTING_KEY, value, reason: input.reason, updatedBy: input.actorUserId })
			.onConflictDoUpdate({
				target: schema.jobSearchSetting.key,
				set: { value, reason: input.reason, updatedBy: input.actorUserId, updatedAt: new Date() },
			});
	}
	await db.insert(schema.billingAuditLog).values({
		actorUserId: input.actorUserId,
		targetUserId: null,
		action: value === null ? "jobs.budget.cleared" : "jobs.budget.set",
		reason: input.reason,
		details: { fromMicro: before.budgetMicro, toMicro: value ?? before.defaultMicro },
	});
	forgetBudgetSetting();
	return readJobSearchBudget();
}
