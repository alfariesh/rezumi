import type { careerScheduleInputSchema } from "@rezumi/schema/career";
import type { JobListing } from "@rezumi/schema/jobs/listing";
import type { JobListingCard, JobSearchCriteria } from "@rezumi/schema/jobs/search";
import type z from "zod";
import { ORPCError } from "@orpc/client";
import { and, asc, desc, eq, inArray, isNull, lte, notInArray, or, sql } from "drizzle-orm";
import { db } from "@rezumi/db/client";
import * as tables from "@rezumi/db/schema";
import { sendCareerNotification } from "@rezumi/email/transport";
import { env } from "@rezumi/env/server";
import { jobSearchCriteriaSchema } from "@rezumi/schema/jobs/search";
import { generateId } from "@rezumi/utils/string";
import { STALE_AGENT_RUN_TTL_MS } from "../agent/runs";
import { aiProvidersService } from "../ai-providers/service";
import { applicationService } from "../applications/service";
import { getEntitlements } from "../billing/entitlements";
import { jobAlertLimitReached } from "../billing/limits";
import { lockUser } from "../documents/ownership";
import { documentsService } from "../documents/service";
import { checkJobAlert, JobAlertPostponed } from "../jobs/alerts";
import { hiddenListingIds } from "../jobs/cache";
import { stableJson } from "../jobs/search-key";
import { toJobListing, toJobListingCard, upsertListings } from "../jobs/store";
import { listingKey } from "../jobs/track";
import { isTregConfigured } from "../jobs/treg";
import { generateCareer } from "./generate";
import { matchPosting } from "./matching";
import { noticeText } from "./notices";
import { isCareerSchedulingEnabled } from "./runner";
import { canonicalOpportunityUrl, nextFutureCareerRun, plainSnippet, prepareRunAt } from "./scheduling";
import { careerService, requireCareerApplication } from "./service";

/** New roles Home lists at most, newest first; older ones are dismissed by the daily upkeep after 30 days. */
const MAX_OPPORTUNITIES_SHOWN = 100;

const CAREER_URL = "/dashboard/career";
const workspaceUrl = (applicationId: string | null, tab?: string) =>
	applicationId ? `/dashboard/applications/${encodeURIComponent(applicationId)}${tab ? `/${tab}` : ""}` : CAREER_URL;

function assertRunner() {
	if (!isCareerSchedulingEnabled())
		throw new ORPCError("PRECONDITION_FAILED", {
			message: "Schedules aren't available on this server. Ask the server administrator to set CRON_SECRET.",
		});
}

// Enough for a discovery search per field plus briefings and follow-ups for a busy search.
const MAX_SCHEDULES_PER_USER = 100;
const READ_NOTIFICATION_TTL_MS = 90 * 24 * 60 * 60 * 1000;
// Due jobs inspected per claim; owners that are busy or locked are skipped, not waited on.
const CLAIM_CANDIDATES = 20;

export const careerJobs = {
	list: (userId: string) =>
		db
			.select()
			.from(tables.careerSchedule)
			.where(eq(tables.careerSchedule.userId, userId))
			.orderBy(desc(tables.careerSchedule.createdAt)),
	save: async (userId: string, input: z.infer<typeof careerScheduleInputSchema> & { id?: string | undefined }) => {
		if (input.enabled) assertRunner();
		const application = await requireCareerApplication({ userId, ...input });
		// A briefing's run time follows its interview, so rescheduling the interview and saving again moves it.
		const interview = application?.activity.find(
			(entry) => entry.type === "interview" && entry.id === input.interviewId,
		);
		if (input.kind === "prepare" && interview?.type === "interview")
			input.nextRunAt = prepareRunAt(new Date(interview.at), input.lead ?? "24h", input.timezone);
		if (input.kind !== "discovery" && !input.applicationId)
			throw new ORPCError("BAD_REQUEST", { message: "Choose an application." });
		if (input.kind === "prepare" && !input.interviewId)
			throw new ORPCError("BAD_REQUEST", { message: "Choose an interview round." });
		if (input.kind === "prepare" && input.enabled) {
			if (!input.aiProviderId)
				throw new ORPCError("BAD_REQUEST", { message: "Choose a tested AI provider for scheduled preparation." });
			// Scheduled work runs unattended, so it never spends Rezumi AI credits.
			if (
				aiProvidersService.isManagedId({ userId, id: input.aiProviderId }) &&
				(await aiProvidersService.offersChoice(userId))
			)
				throw new ORPCError("BAD_REQUEST", {
					message: "Scheduled preparation runs on your own AI connection. Choose one of yours.",
				});
			await aiProvidersService.getRunnableById({ userId, id: input.aiProviderId });
		} else if (input.aiProviderId) {
			// Any other schedule may name a connection too; it still has to be one of the account's own.
			const [provider] = await db
				.select({ id: tables.aiProvider.id })
				.from(tables.aiProvider)
				.where(and(eq(tables.aiProvider.id, input.aiProviderId), eq(tables.aiProvider.userId, userId)));
			if (!provider)
				throw new ORPCError("NOT_FOUND", { message: "That AI provider no longer exists. Choose another provider." });
		}
		if (input.email) {
			const [owner] = await db
				.select({ verified: tables.user.emailVerified })
				.from(tables.user)
				.where(eq(tables.user.id, userId));
			if (!owner?.verified || !env.SMTP_HOST || !env.SMTP_USER || !env.SMTP_PASS || !env.SMTP_FROM)
				throw new ORPCError("PRECONDITION_FAILED", {
					message:
						"Email reminders need a verified email address and email delivery on this server. Verify your email, or turn off email reminders.",
				});
		}
		if (input.kind === "discovery" && input.enabled && !isTregConfigured())
			throw new ORPCError("PRECONDITION_FAILED", {
				message: "Job alerts aren't available on this server. Ask the server administrator to set up job search.",
			});
		const { id, search: requested, ...rest } = input;
		let keepQueuedAt: Date | null = null;
		return db.transaction(async (tx) => {
			// Serializes this user's creates and job alerts so the caps hold under concurrent requests.
			if (!id || (input.kind === "discovery" && input.enabled)) await lockUser(tx, userId);
			let previous: typeof tables.careerSchedule.$inferSelect | undefined;
			if (id) {
				const [owned] = await tx
					.select()
					.from(tables.careerSchedule)
					.where(and(eq(tables.careerSchedule.id, id), eq(tables.careerSchedule.userId, userId)))
					.for("update");
				if (!owned) throw new ORPCError("NOT_FOUND");
				previous = owned;
				const ran = owned.lastQueuedAt && input.nextRunAt <= owned.lastQueuedAt ? owned.lastQueuedAt : null;
				// A briefing's time comes from its interview: one that already ran for that time stays done when switched
				// back on. Other schedules need a new time.
				if (input.kind === "prepare") keepQueuedAt = ran;
				else if (input.enabled && ran)
					throw new ORPCError("BAD_REQUEST", {
						message: "Choose a new run time when rescheduling completed or canceled work.",
					});
				await tx
					.update(tables.careerJob)
					.set({ status: "canceled", lease: null, leaseUntil: null })
					.where(and(eq(tables.careerJob.scheduleId, id), sql`${tables.careerJob.status} in ('queued', 'running')`));
			}
			const search = input.kind === "discovery" ? alertSearch(requested, previous, input.query) : null;
			if (input.kind === "discovery" && !search)
				throw new ORPCError("BAD_REQUEST", { message: "Enter a role to look for." });
			if (input.kind === "discovery" && input.enabled) await assertJobAlertRoom(tx, userId, id);
			const values = {
				...rest,
				search,
				query: search?.query ?? "",
				// A changed search starts over: its first check reaches one interval back.
				discoveryState:
					previous && search && previous.search && stableJson(previous.search) === stableJson(search)
						? previous.discoveryState
						: null,
			};
			if (!id) {
				const [count] = await tx
					.select({ total: sql<number>`count(*)::int` })
					.from(tables.careerSchedule)
					.where(eq(tables.careerSchedule.userId, userId));
				if ((count?.total ?? 0) >= MAX_SCHEDULES_PER_USER)
					throw new ORPCError("BAD_REQUEST", {
						message: `You can keep up to ${MAX_SCHEDULES_PER_USER} schedules. Delete one you no longer need first.`,
					});
			}
			const [row] = id
				? await tx
						.update(tables.careerSchedule)
						.set({ ...values, lastQueuedAt: keepQueuedAt })
						.where(and(eq(tables.careerSchedule.id, id), eq(tables.careerSchedule.userId, userId)))
						.returning()
				: await tx
						.insert(tables.careerSchedule)
						.values({ userId, ...values })
						.returning();
			if (!row) throw new ORPCError("NOT_FOUND");
			return row;
		});
	},
	delete: async (userId: string, id: string) => {
		await db
			.delete(tables.careerSchedule)
			.where(and(eq(tables.careerSchedule.id, id), eq(tables.careerSchedule.userId, userId)));
	},
	notifications: async (userId: string) => {
		const rows = await db
			.select()
			.from(tables.careerNotification)
			.where(eq(tables.careerNotification.userId, userId))
			.orderBy(desc(tables.careerNotification.createdAt));
		return rows.map((row) => ({ ...row, ...noticeText(row.notice) }));
	},
	markRead: async (userId: string, id: string) => {
		await db
			.update(tables.careerNotification)
			.set({ readAt: new Date() })
			.where(and(eq(tables.careerNotification.id, id), eq(tables.careerNotification.userId, userId)));
	},
	/**
	 * Each role with the preferences its posting matches and what it leaves out; the posting text stays here. A role from
	 * a job listing carries the listing's card (pay, arrangement, logo); one whose listing has closed is left out.
	 */
	opportunities: async (userId: string) => {
		const [rows, profile] = await Promise.all([
			db
				.select({ opportunity: tables.careerOpportunity, listing: tables.jobListing })
				.from(tables.careerOpportunity)
				.leftJoin(tables.jobListing, eq(tables.careerOpportunity.listingId, tables.jobListing.id))
				.where(and(eq(tables.careerOpportunity.userId, userId), isNull(tables.careerOpportunity.dismissedAt)))
				.orderBy(desc(tables.careerOpportunity.lastSeenAt))
				.limit(MAX_OPPORTUNITIES_SHOWN),
			careerService.profile(userId),
		]);
		return rows
			.filter(({ listing }) => !listing?.closedAt)
			.map(({ opportunity: { description, ...row }, listing }) => {
				const card = listing ? toJobListingCard(toJobListing(listing)) : null;
				const match = matchPosting({ ...row, description }, profile);
				return { ...row, ...match, ...(card ? { unknowns: listingUnknowns(card) } : {}), listing: card };
			});
	},
	dismissOpportunity: async (userId: string, id: string) => {
		await db
			.update(tables.careerOpportunity)
			.set({ dismissedAt: new Date() })
			.where(and(eq(tables.careerOpportunity.id, id), eq(tables.careerOpportunity.userId, userId)));
	},
};

/**
 * The job search a discovery schedule repeats: the one sent, else the one it has (with the role changed when only
 * `query` was sent, as MCP does), else its `query` as the role with the search defaults. Null without a role.
 */
function alertSearch(
	requested: JobSearchCriteria | null | undefined,
	previous: { search: JobSearchCriteria | null; query: string } | undefined,
	query: string,
): JobSearchCriteria | null {
	if (requested) return requested;
	if (requested === undefined && previous?.search) {
		const role = query.trim().slice(0, 200);
		if (role.length < 2 || role === previous.search.query) return previous.search;
		return { ...previous.search, query: role };
	}
	const parsed = jobSearchCriteriaSchema.safeParse({ query: (query || previous?.query || "").slice(0, 200) });
	return parsed.success ? parsed.data : null;
}

/**
 * Whether the plan still covers this alert: after a move to a smaller plan, only the oldest alerts that fit its limit
 * run; the rest wait (switched on, but not checked) until there is room again.
 */
async function alertWithinPlan(userId: string, scheduleId: string): Promise<boolean> {
	const entitlements = await getEntitlements(userId, new Date());
	const max = entitlements.enabled ? entitlements.limits.jobAlerts : null;
	if (max === null) return true;
	const covered = await db
		.select({ id: tables.careerSchedule.id })
		.from(tables.careerSchedule)
		.where(
			and(
				eq(tables.careerSchedule.userId, userId),
				eq(tables.careerSchedule.kind, "discovery"),
				eq(tables.careerSchedule.enabled, true),
			),
		)
		.orderBy(asc(tables.careerSchedule.createdAt), asc(tables.careerSchedule.id))
		.limit(max);
	return covered.some((row) => row.id === scheduleId);
}

/** Throws PLAN_LIMIT_REACHED when switching on another job alert would pass the plan's limit. */
async function assertJobAlertRoom(tx: Parameters<typeof lockUser>[0], userId: string, id: string | undefined) {
	const entitlements = await getEntitlements(userId, new Date(), tx);
	const max = entitlements.enabled ? entitlements.limits.jobAlerts : null;
	if (max === null) return;
	const [row] = await tx
		.select({ total: sql<number>`count(*)::int` })
		.from(tables.careerSchedule)
		.where(
			and(
				eq(tables.careerSchedule.userId, userId),
				eq(tables.careerSchedule.kind, "discovery"),
				eq(tables.careerSchedule.enabled, true),
				id ? sql`${tables.careerSchedule.id} <> ${id}` : undefined,
			),
		);
	const used = row?.total ?? 0;
	if (used >= max) throw jobAlertLimitReached({ max, used, planId: entitlements.planId });
}

/** What a listing doesn't say, from its own fields rather than its text. */
const listingUnknowns = (listing: JobListingCard) => [
	...(listing.salary ? [] : (["salary"] as const)),
	...(listing.workArrangement ? [] : (["office"] as const)),
];

/** A found listing as a role to review; the listing's own columns are copied in case the listing goes. */
function opportunityValues(userId: string, listing: JobListing) {
	return {
		userId,
		url: canonicalOpportunityUrl(listing.postingUrl) ?? listing.postingUrl,
		role: listing.title.slice(0, 200),
		company: listing.company.name.slice(0, 200),
		location: listing.location.text.slice(0, 200),
		snippet: plainSnippet(listing.requirementsSummary || listing.description),
		description: listing.description,
		listingId: listing.id,
	};
}

/**
 * Checks a discovery schedule's search for listings that appeared since its last run (`../jobs/alerts.ts`), stores
 * them in the shared listings, and answers the ones this person hasn't hidden or tracked, as roles to offer. Posting
 * pages aren't opened: the providers' listings already hold the posting.
 */
async function discover(userId: string, schedule: typeof tables.careerSchedule.$inferSelect) {
	const search = alertSearch(schedule.search, undefined, schedule.query);
	if (!search || !(await alertWithinPlan(userId, schedule.id))) return { roles: [], state: schedule.discoveryState };
	const now = new Date();
	const check = await checkJobAlert(search, schedule.discoveryState, {
		now,
		intervalDays: schedule.intervalDays ?? 1,
		signal: AbortSignal.timeout(60_000),
	});
	const stored = await upsertListings(check.returned, now);
	const byProviderId = new Map(stored.map((listing) => [`${listing.provider}:${listing.externalId}`, listing]));
	const offered = check.listings.flatMap(
		(listing) => byProviderId.get(`${listing.provider}:${listing.externalId}`) ?? [],
	);
	const [hidden, tracked] = await Promise.all([
		hiddenListingIds(
			userId,
			offered.map((listing) => listing.id),
		),
		applicationService.findIdsBySourceKeys({
			userId,
			keys: offered.flatMap((listing) => listingKey(listing) ?? []),
		}),
	]);
	const roles = offered
		.filter((listing) => !hidden.has(listing.id) && !tracked.has(listingKey(listing) ?? ""))
		.map((listing) => opportunityValues(userId, listing));
	return { roles, state: check.state };
}

async function enqueue() {
	const now = new Date();
	await db.transaction(async (tx) => {
		const due = await tx
			.select()
			.from(tables.careerSchedule)
			.where(
				and(
					eq(tables.careerSchedule.enabled, true),
					lte(tables.careerSchedule.nextRunAt, now),
					or(
						isNull(tables.careerSchedule.lastQueuedAt),
						sql`${tables.careerSchedule.nextRunAt} > ${tables.careerSchedule.lastQueuedAt}`,
					),
				),
			)
			.orderBy(asc(tables.careerSchedule.nextRunAt))
			.limit(20)
			.for("update", { skipLocked: true });
		for (const schedule of due) {
			// A schedule switched back on for a time that already ran gets a fresh job; finished ones stay as history.
			await tx
				.delete(tables.careerJob)
				.where(
					and(
						eq(tables.careerJob.scheduleId, schedule.id),
						eq(tables.careerJob.dueAt, schedule.nextRunAt),
						sql`${tables.careerJob.status} in ('completed', 'canceled', 'failed')`,
					),
				);
			await tx
				.insert(tables.careerJob)
				.values({ userId: schedule.userId, scheduleId: schedule.id, dueAt: schedule.nextRunAt })
				.onConflictDoNothing();
			// Coalesce missed ticks into one job, rather than charging for an outage's backlog, keeping the wall time.
			const nextRunAt = schedule.intervalDays
				? nextFutureCareerRun(schedule.nextRunAt, schedule.intervalDays, schedule.timezone, now)
				: schedule.nextRunAt;
			await tx
				.update(tables.careerSchedule)
				.set({ lastQueuedAt: schedule.nextRunAt, nextRunAt })
				.where(eq(tables.careerSchedule.id, schedule.id));
		}
	});
}

/**
 * Claims the oldest due job whose owner has no other job running and hasn't been served this tick, so one account's
 * backlog can't hold up everyone else's schedules. Jobs of banned accounts are canceled.
 */
function claim(servedUsers: ReadonlySet<string>) {
	return db.transaction(async (tx) => {
		const now = new Date();
		const candidates = await tx
			.select()
			.from(tables.careerJob)
			.where(
				and(
					lte(tables.careerJob.dueAt, now),
					sql`${tables.careerJob.attempts} < 3`,
					or(
						and(
							eq(tables.careerJob.status, "queued"),
							or(isNull(tables.careerJob.leaseUntil), lte(tables.careerJob.leaseUntil, now)),
						),
						and(eq(tables.careerJob.status, "running"), lte(tables.careerJob.leaseUntil, now)),
					),
					servedUsers.size ? notInArray(tables.careerJob.userId, [...servedUsers]) : undefined,
					sql`not exists (select 1 from career_job as running_job where running_job.user_id = ${tables.careerJob.userId} and running_job.status = 'running' and running_job.id <> ${tables.careerJob.id} and running_job.lease_until > ${now})`,
				),
			)
			.orderBy(asc(tables.careerJob.dueAt))
			.limit(CLAIM_CANDIDATES)
			.for("update", { skipLocked: true });
		for (const job of candidates) {
			// Publication takes the user mutex before its job lock; never wait for that mutex in reverse order.
			const [owner] = await tx
				.select({ id: tables.user.id, banned: tables.user.banned, banExpires: tables.user.banExpires })
				.from(tables.user)
				.where(eq(tables.user.id, job.userId))
				.for("no key update", { skipLocked: true });
			if (!owner) continue;
			if (owner.banned && (!owner.banExpires || owner.banExpires > now)) {
				await tx
					.update(tables.careerJob)
					.set({ status: "canceled", lease: null, leaseUntil: null })
					.where(eq(tables.careerJob.id, job.id));
				continue;
			}
			// Checked again under the owner's lock: another worker may have claimed this owner's job since the select.
			const [running] = await tx
				.select({ id: tables.careerJob.id })
				.from(tables.careerJob)
				.where(
					and(
						eq(tables.careerJob.userId, job.userId),
						eq(tables.careerJob.status, "running"),
						sql`${tables.careerJob.id} <> ${job.id}`,
						sql`${tables.careerJob.leaseUntil} > ${now}`,
					),
				)
				.limit(1);
			if (running) continue;
			const [claimed] = await tx
				.update(tables.careerJob)
				.set({
					status: "running",
					attempts: job.attempts + 1,
					lease: generateId(),
					leaseUntil: new Date(Date.now() + STALE_AGENT_RUN_TTL_MS + 60_000),
				})
				.where(eq(tables.careerJob.id, job.id))
				.returning();
			if (claimed) return claimed;
		}
		return null;
	});
}

async function execute(job: typeof tables.careerJob.$inferSelect) {
	const [schedule] = await db
		.select()
		.from(tables.careerSchedule)
		.where(
			and(
				eq(tables.careerSchedule.id, job.scheduleId),
				eq(tables.careerSchedule.userId, job.userId),
				eq(tables.careerSchedule.enabled, true),
			),
		);
	if (!schedule || !job.lease) {
		await db
			.update(tables.careerJob)
			.set({ status: "canceled", lease: null, leaseUntil: null })
			.where(and(eq(tables.careerJob.id, job.id), eq(tables.careerJob.status, "running")));
		return;
	}
	const application = await requireCareerApplication({
		userId: job.userId,
		applicationId: schedule.applicationId,
		interviewId: schedule.interviewId,
	});
	const found = schedule.kind === "discovery" ? await discover(job.userId, schedule) : null;
	if (schedule.kind === "prepare") {
		if (!application || !schedule.interviewId) throw new Error("Preparation application unavailable.");
		const [saved] = await db
			.select({ id: tables.careerArtifact.id })
			.from(tables.careerArtifact)
			.where(eq(tables.careerArtifact.jobId, job.id));
		if (!saved)
			await generateCareer({
				userId: job.userId,
				applicationId: application.id,
				locale: schedule.locale,
				task: { task: "briefing", interviewId: schedule.interviewId },
				...(schedule.aiProviderId ? { providerId: schedule.aiProviderId } : {}),
				jobId: job.id,
				jobLease: job.lease,
				signal: AbortSignal.timeout(120_000),
			});
	}
	await db.transaction(async (tx) => {
		// Interview edits/deletion lock the application before touching its jobs.
		if (schedule.applicationId) {
			const [owned] = await tx
				.select({ id: tables.application.id })
				.from(tables.application)
				.where(and(eq(tables.application.id, schedule.applicationId), eq(tables.application.userId, job.userId)))
				.for("update");
			if (!owned) return;
		}
		const [current] = await tx
			.select()
			.from(tables.careerJob)
			.where(
				and(
					eq(tables.careerJob.id, job.id),
					eq(tables.careerJob.lease, job.lease ?? ""),
					eq(tables.careerJob.status, "running"),
				),
			)
			.for("update");
		if (!current || !current.leaseUntil || current.leaseUntil < new Date()) return;
		let changed = 0;
		if (found) {
			const urls = found.roles.map((role) => role.url);
			// Roles seen before stay as they are (dismissed ones stay dismissed); only new ones are offered.
			const known = new Set(
				urls.length
					? (
							await tx
								.select({ url: tables.careerOpportunity.url })
								.from(tables.careerOpportunity)
								.where(
									and(eq(tables.careerOpportunity.userId, job.userId), inArray(tables.careerOpportunity.url, urls)),
								)
						).map((row) => row.url)
					: [],
			);
			const fresh = [...new Map(found.roles.map((role) => [role.url, role])).values()].filter(
				(role) => !known.has(role.url),
			);
			if (known.size)
				await tx
					.update(tables.careerOpportunity)
					.set({ lastSeenAt: new Date(), updatedAt: sql`${tables.careerOpportunity.updatedAt}` })
					.where(
						and(eq(tables.careerOpportunity.userId, job.userId), inArray(tables.careerOpportunity.url, [...known])),
					);
			if (fresh.length)
				changed = (
					await tx
						.insert(tables.careerOpportunity)
						.values(fresh)
						.onConflictDoNothing()
						.returning({ id: tables.careerOpportunity.id })
				).length;
			await tx
				.update(tables.careerSchedule)
				.set({ discoveryState: found.state })
				.where(eq(tables.careerSchedule.id, schedule.id));
		}
		// New roles all wait in one list, so the newest "new roles" notice replaces older unread ones.
		if (schedule.kind === "discovery" && changed)
			await tx
				.update(tables.careerNotification)
				.set({ readAt: new Date() })
				.where(
					and(
						eq(tables.careerNotification.userId, job.userId),
						sql`${tables.careerNotification.notice}->>'type' = 'opportunities'`,
						isNull(tables.careerNotification.readAt),
					),
				);
		if (schedule.kind !== "discovery" || changed)
			await tx
				.insert(tables.careerNotification)
				.values({
					userId: job.userId,
					applicationId: schedule.applicationId,
					key: job.id,
					notice:
						schedule.kind === "discovery"
							? { type: "opportunities", count: changed, query: schedule.query }
							: {
									type: schedule.kind === "prepare" ? "briefing" : "followup",
									company: application?.company ?? "",
									role: application?.role ?? "",
								},
					url: workspaceUrl(schedule.applicationId, schedule.kind === "prepare" ? "prepare" : undefined),
				})
				.onConflictDoNothing();
		await tx
			.update(tables.careerJob)
			.set({ status: "completed", lease: null, leaseUntil: null, error: null })
			.where(eq(tables.careerJob.id, job.id));
	});
}

async function sendPendingEmail() {
	// Claim independently of job completion so a crash before SMTP can recover on the next tick.
	for (let i = 0; i < 2; i++) {
		const notification = await db.transaction(async (tx) => {
			const [row] = await tx
				.select({ notification: tables.careerNotification })
				.from(tables.careerNotification)
				.innerJoin(tables.careerJob, eq(tables.careerNotification.key, tables.careerJob.id))
				.innerJoin(tables.careerSchedule, eq(tables.careerJob.scheduleId, tables.careerSchedule.id))
				.where(
					and(
						eq(tables.careerJob.status, "completed"),
						eq(tables.careerSchedule.email, true),
						eq(tables.careerSchedule.enabled, true),
						isNull(tables.careerNotification.emailedAt),
						or(
							isNull(tables.careerNotification.emailAttemptedAt),
							lte(tables.careerNotification.emailAttemptedAt, new Date(Date.now() - 10 * 60_000)),
						),
						sql`not exists (select 1 from career_notification failed where failed.key = 'email-failed:' || ${tables.careerNotification.key} and failed.user_id = ${tables.careerNotification.userId})`,
					),
				)
				.orderBy(asc(tables.careerNotification.createdAt))
				.limit(1)
				.for("update", { skipLocked: true, of: tables.careerNotification });
			if (!row) return null;
			await tx
				.update(tables.careerNotification)
				.set({ emailAttemptedAt: new Date() })
				.where(eq(tables.careerNotification.id, row.notification.id));
			return row.notification;
		});
		if (!notification) break;
		const [owner] = await db
			.select({
				email: tables.user.email,
				verified: tables.user.emailVerified,
				banned: tables.user.banned,
				banExpires: tables.user.banExpires,
			})
			.from(tables.user)
			.where(eq(tables.user.id, notification.userId));
		const banned = owner?.banned && (!owner.banExpires || owner.banExpires > new Date());
		if (notification && owner?.verified && !banned) {
			try {
				const sent = await sendCareerNotification({
					to: owner.email,
					subject: noticeText(notification.notice).title,
					text: "You have a career update in Rezumi.",
					url: new URL(notification.url ?? CAREER_URL, env.APP_URL).toString(),
					key: notification.key,
				});
				if (!sent) throw new Error("SMTP unavailable");
				await db
					.update(tables.careerNotification)
					.set({ emailedAt: new Date() })
					.where(eq(tables.careerNotification.id, notification.id));
			} catch {
				await db
					.insert(tables.careerNotification)
					.values({
						userId: notification.userId,
						key: `email-failed:${notification.key}`,
						notice: { type: "email-failed" },
						url: CAREER_URL,
					})
					.onConflictDoNothing();
			}
		}
	}
}

// The most messages one tick sends; a message that finds nothing left to claim does nothing.
const MAX_DISPATCH = 20;

/** Accounts with a due job a runner could claim now (one job per account runs at a time). */
async function countWaitingAccounts() {
	const now = new Date();
	const [row] = await db
		.select({ count: sql<number>`count(distinct ${tables.careerJob.userId})::int` })
		.from(tables.careerJob)
		.where(
			and(
				lte(tables.careerJob.dueAt, now),
				sql`${tables.careerJob.attempts} < 3`,
				or(
					and(
						eq(tables.careerJob.status, "queued"),
						or(isNull(tables.careerJob.leaseUntil), lte(tables.careerJob.leaseUntil, now)),
					),
					and(eq(tables.careerJob.status, "running"), lte(tables.careerJob.leaseUntil, now)),
				),
			),
		);
	return Math.min(row?.count ?? 0, MAX_DISPATCH);
}

/**
 * Claims and runs the oldest due job of an account not in `servedUsers`; answers its owner, or `null` when nothing was
 * waiting. A failed run goes back to the queue (or fails for good after three attempts) and notifies its owner.
 */
export async function runNextCareerJob(servedUsers: ReadonlySet<string> = new Set()): Promise<string | null> {
	const job = await claim(servedUsers);
	if (!job) return null;
	try {
		await execute(job);
	} catch (error) {
		// The day's job search budget is spent: run again once it resets, without using up an attempt.
		if (error instanceof JobAlertPostponed) {
			await db
				.update(tables.careerJob)
				.set({ status: "queued", attempts: Math.max(0, job.attempts - 1), lease: null, leaseUntil: error.until })
				.where(
					and(
						eq(tables.careerJob.id, job.id),
						eq(tables.careerJob.lease, job.lease ?? ""),
						eq(tables.careerJob.status, "running"),
					),
				);
			return job.userId;
		}
		const [failed] = await db
			.update(tables.careerJob)
			.set({
				status: job.attempts >= 3 ? "failed" : "queued",
				lease: null,
				leaseUntil: new Date(Date.now() + 300_000),
				error: "This schedule failed. Check the selected provider and application, then review the schedule.",
			})
			.where(
				and(
					eq(tables.careerJob.id, job.id),
					eq(tables.careerJob.lease, job.lease ?? ""),
					eq(tables.careerJob.status, "running"),
				),
			)
			.returning();
		if (failed?.status === "failed")
			await db
				.insert(tables.careerNotification)
				.values({
					userId: job.userId,
					key: `failed:${job.id}`,
					notice: { type: "schedule-failed", reason: "failed" },
					url: `${CAREER_URL}?schedule=${encodeURIComponent(job.scheduleId)}`,
				})
				.onConflictDoNothing();
	}
	return job.userId;
}

/**
 * One bounded scheduler tick. No work continues after this promise resolves. By default the tick runs up to two due
 * jobs itself. With `dispatch` (Cloudflare, through a Queue) it only says how many accounts have a job waiting, and
 * each message then runs one job in its own invocation with `runNextCareerJob`, so jobs run side by side.
 */
export async function runCareerJobs(options: { dispatch?: (count: number) => Promise<void> } = {}) {
	const exhausted = await db
		.update(tables.careerJob)
		.set({
			status: "failed",
			lease: null,
			leaseUntil: null,
			error: "The worker stopped repeatedly; review this schedule.",
		})
		.where(
			and(
				eq(tables.careerJob.status, "running"),
				sql`${tables.careerJob.attempts} >= 3`,
				lte(tables.careerJob.leaseUntil, new Date()),
			),
		)
		.returning();
	for (const job of exhausted)
		await db
			.insert(tables.careerNotification)
			.values({
				userId: job.userId,
				key: `failed:${job.id}`,
				notice: { type: "schedule-failed", reason: "stopped" },
				url: `${CAREER_URL}?schedule=${encodeURIComponent(job.scheduleId)}`,
			})
			.onConflictDoNothing();
	await enqueue();
	let processed = 0;
	if (options.dispatch) {
		const waiting = await countWaitingAccounts();
		if (waiting) await options.dispatch(waiting);
	} else {
		const servedUsers = new Set<string>();
		for (let i = 0; i < 2; i++) {
			const userId = await runNextCareerJob(servedUsers);
			if (!userId) break;
			servedUsers.add(userId);
			processed++;
		}
	}
	await sendPendingEmail();
	// The scheduler tick is the one periodic job every platform runs; Trash expiry rides on it.
	await documentsService
		.purgeExpiredTrash()
		.catch((error: unknown) => console.error("[documents] Expired Trash purge failed", error));
	// Released usernames are reserved for 30 days; older rows no longer matter.
	await db
		.delete(tables.releasedUsername)
		.where(lte(tables.releasedUsername.releasedAt, new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)))
		.catch((error: unknown) => console.error("[auth] Released username cleanup failed", error));
	// Read notifications go after 90 days, so the list every dashboard page loads stops growing. Unread ones stay.
	await db
		.delete(tables.careerNotification)
		.where(lte(tables.careerNotification.readAt, new Date(Date.now() - READ_NOTIFICATION_TTL_MS)))
		.catch((error: unknown) => console.error("[career] Read notification cleanup failed", error));
	return { processed };
}
