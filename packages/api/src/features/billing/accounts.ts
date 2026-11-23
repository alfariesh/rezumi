import type { ReportRange } from "./reports";
import type { PaidPlanId } from "@rezumi/schema/billing";
import { and, count, desc, eq, gt, gte, inArray, isNotNull, isNull, lt, notInArray, or, sql } from "drizzle-orm";
import { db } from "@rezumi/db/client";
import * as schema from "@rezumi/db/schema";
import { resolveEntitlements } from "./entitlements";
import { formatWibTime, previousRange } from "./reports";
import { LIVE_SUBSCRIPTION_STATUSES, subscriptionState } from "./subscriptions";

/**
 * Every account for the admin, with a few numbers: how many there are, sign-ups, who used the app lately, and who has a
 * paid plan now. Names, email addresses and dates only; nothing from resumes, letters or the Profile. Guest accounts
 * (anonymous) are counted but not listed.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

export type AccountPlanFilter = "all" | "free" | PaidPlanId;

/**
 * The paid plan of every account that has one now, as the account would have it with plans on: unrevoked periods and
 * live subscriptions, resolved like `getEntitlements`. Only paying accounts have such rows, so this stays small.
 */
async function paidPlans(now: Date): Promise<Map<string, PaidPlanId>> {
	const [periods, subscriptions] = await Promise.all([
		db
			.select({
				userId: schema.membershipPeriod.userId,
				planId: schema.membershipPeriod.planId,
				startsAt: schema.membershipPeriod.startsAt,
				endsAt: schema.membershipPeriod.endsAt,
			})
			.from(schema.membershipPeriod)
			.where(
				and(
					isNull(schema.membershipPeriod.revokedAt),
					lt(schema.membershipPeriod.startsAt, now),
					gt(schema.membershipPeriod.endsAt, now),
				),
			),
		db
			.select()
			.from(schema.billingSubscription)
			.where(
				and(
					isNotNull(schema.billingSubscription.userId),
					inArray(schema.billingSubscription.status, [...LIVE_SUBSCRIPTION_STATUSES]),
				),
			),
	]);
	const userIds = new Set([...periods.map((row) => row.userId), ...subscriptions.flatMap((row) => row.userId ?? [])]);
	const plans = new Map<string, PaidPlanId>();
	for (const userId of userIds) {
		const { planId } = resolveEntitlements(
			periods.filter((row) => row.userId === userId),
			now,
			subscriptions.filter((row) => row.userId === userId).map(subscriptionState),
		);
		if (planId !== "free") plans.set(userId, planId);
	}
	return plans;
}

/** The last time the account's sign-in was used, read from its sessions (refreshed about once a day while in use). */
// Written out with table names: Drizzle leaves columns unqualified in a one-table select, which would read them from
// the subquery's own table.
const lastSeen = sql<Date | null>`(select max("session"."updated_at") from "session" where "session"."user_id" = "user"."id")`;

/** Accounts whose sign-in was used since `since`. */
const activeSince = (since: Date) =>
	db
		.select({ total: sql<number>`count(distinct ${schema.session.userId})` })
		.from(schema.session)
		.innerJoin(schema.user, eq(schema.user.id, schema.session.userId))
		.where(and(gte(schema.session.updatedAt, since), eq(schema.user.isAnonymous, false)));

/** Sign-ups per WIB day of the period, empty days as zeros. */
async function dailySignups(range: ReportRange) {
	const user = schema.user;
	const days = new Map<string, number>();
	for (let at = +range.from; at < +range.to; at += DAY_MS) days.set(formatWibTime(new Date(at)).slice(0, 10), 0);
	const rows = await db
		.select({ day: sql<string>`to_char(${user.createdAt} at time zone 'Asia/Jakarta', 'YYYY-MM-DD')`, total: count() })
		.from(user)
		.where(and(gte(user.createdAt, range.from), lt(user.createdAt, range.to), eq(user.isAnonymous, false)))
		.groupBy(sql`1`);
	for (const row of rows) if (days.has(row.day)) days.set(row.day, Number(row.total));
	return [...days].map(([day, signups]) => ({ day, signups }));
}

/** The headline numbers: accounts now, sign-ups in the period against the one before, activity and paid plans now. */
export async function accountMetrics(range: ReportRange, now = new Date()) {
	const user = schema.user;
	const signupsIn = (period: ReportRange) =>
		db
			.select({
				total: count(),
				verified: sql<number>`count(*) filter (where ${user.emailVerified})`,
			})
			.from(user)
			.where(and(gte(user.createdAt, period.from), lt(user.createdAt, period.to), eq(user.isAnonymous, false)));

	const [[totals], [current], [previous], [week], [month], plans, daily] = await Promise.all([
		db
			.select({
				accounts: sql<number>`count(*) filter (where not ${user.isAnonymous})`,
				verified: sql<number>`count(*) filter (where not ${user.isAnonymous} and ${user.emailVerified})`,
				guests: sql<number>`count(*) filter (where ${user.isAnonymous})`,
			})
			.from(user),
		signupsIn(range),
		signupsIn(previousRange(range)),
		activeSince(new Date(+now - 7 * DAY_MS)),
		activeSince(new Date(+now - 30 * DAY_MS)),
		paidPlans(now),
		dailySignups(range),
	]);
	const paid = [...plans.values()];
	return {
		accounts: Number(totals?.accounts ?? 0),
		verified: Number(totals?.verified ?? 0),
		guests: Number(totals?.guests ?? 0),
		signups: {
			total: Number(current?.total ?? 0),
			verified: Number(current?.verified ?? 0),
			previous: Number(previous?.total ?? 0),
			daily,
		},
		active: { week: Number(week?.total ?? 0), month: Number(month?.total ?? 0) },
		paying: {
			total: paid.length,
			plus: paid.filter((planId) => planId === "plus").length,
			proAi: paid.filter((planId) => planId === "pro-ai").length,
		},
	};
}

/**
 * One page of accounts, newest first: name, email, username, plan now, when they joined and were last seen. `query`
 * matches part of the email, name or username; `plan` keeps one plan.
 */
export async function listAccounts(input: {
	query?: string | undefined;
	plan?: AccountPlanFilter | undefined;
	limit: number;
	offset: number;
}) {
	const now = new Date();
	const user = schema.user;
	const plans = await paidPlans(now);
	const plan = input.plan ?? "all";
	const paidIds = (planId: PaidPlanId) => [...plans].flatMap(([userId, id]) => (id === planId ? [userId] : []));

	const filters = [eq(user.isAnonymous, false)];
	const query = input.query?.trim().toLowerCase();
	if (query) {
		const pattern = `%${query.replaceAll(/[\\%_]/g, (match) => `\\${match}`)}%`;
		const match = or(
			sql`lower(${user.email}) like ${pattern}`,
			sql`lower(${user.name}) like ${pattern}`,
			sql`lower(${user.username}) like ${pattern}`,
			eq(user.id, query),
		);
		if (match) filters.push(match);
	}
	if (plan === "free" && plans.size > 0) filters.push(notInArray(user.id, [...plans.keys()]));
	if (plan === "plus" || plan === "pro-ai") {
		const ids = paidIds(plan);
		if (ids.length === 0) return { total: 0, accounts: [] };
		filters.push(inArray(user.id, ids));
	}
	const where = and(...filters);

	const [[counted], rows] = await Promise.all([
		db.select({ total: count() }).from(user).where(where),
		db
			.select({
				id: user.id,
				name: user.name,
				email: user.email,
				username: user.displayUsername,
				emailVerified: user.emailVerified,
				role: user.role,
				banned: user.banned,
				createdAt: user.createdAt,
				lastSeenAt: lastSeen,
			})
			.from(user)
			.where(where)
			.orderBy(desc(user.createdAt), desc(user.id))
			.limit(input.limit)
			.offset(input.offset),
	]);
	return {
		total: Number(counted?.total ?? 0),
		accounts: rows.map((row) => ({
			...row,
			admin: row.role === "admin",
			banned: Boolean(row.banned),
			// Postgres hands back the subquery's timestamp as text.
			lastSeenAt: row.lastSeenAt ? new Date(row.lastSeenAt) : null,
			planId: plans.get(row.id) ?? ("free" as const),
		})),
	};
}
