// Application rules shared by the web and the native app: stages, what an application needs next, interviews, the
// list's filter and grouping, and the Board's pending drop. No words: each app translates the labels itself.
import type {
	ApplicationClosedReason,
	ApplicationStatus,
	ApplicationTimelineEntry,
	Contact,
	InterviewKind,
	InterviewTimelineEntry,
} from "@rezumi/schema/applications/data";
import { INTERVIEW_KINDS } from "@rezumi/schema/applications/data";

/** The fields of an application these rules read; the API's application summary satisfies it. */
export type ApplicationRecord = {
	id: string;
	role: string;
	company: string;
	status: ApplicationStatus;
	closedReason: ApplicationClosedReason | null;
	activity: readonly ApplicationTimelineEntry[];
	appliedAt: Date | string;
	updatedAt: Date | string;
	followUpAt: Date | string | null;
	followUpNote: string | null;
	tags: readonly string[];
	contacts: readonly Pick<Contact, "name" | "email">[];
	resumeId: string | null;
	source: string | null;
};

const DAY_MS = 86_400_000;

// ---- Stages ----

/** The stages an application moves through; closed ends it from any of them. */
export const PIPELINE: readonly ApplicationStatus[] = ["saved", "applied", "screening", "interview", "offer"];

/** The list's group order: what needs you first, closed last. */
export const LIST_ORDER: readonly ApplicationStatus[] = [
	"interview",
	"offer",
	"screening",
	"applied",
	"saved",
	"closed",
];

export const CLOSED_REASONS: readonly ApplicationClosedReason[] = [
	"accepted",
	"not-selected",
	"withdrew",
	"accepted-other",
	"no-response",
];

/** The stage after this one in the pipeline, or null at Offer and for closed applications. */
export function getNextStage(status: ApplicationStatus): ApplicationStatus | null {
	const index = PIPELINE.indexOf(status);
	return index === -1 ? null : (PIPELINE[index + 1] ?? null);
}

// ---- Interviews ----

export const interviewKindOf = (kind: InterviewKind) => INTERVIEW_KINDS.find((item) => item.value === kind);

export const isInterview = (entry: ApplicationTimelineEntry): entry is InterviewTimelineEntry =>
	entry.type === "interview";

/** When an interview ends: its start plus its length. */
export const interviewEnd = (interview: Pick<InterviewTimelineEntry, "at" | "durationMinutes">) =>
	new Date(new Date(interview.at).getTime() + interview.durationMinutes * 60_000);

export type ScheduledInterview<T> = { application: T; interview: InterviewTimelineEntry; start: Date; end: Date };

/** Every interview across the given applications, soonest first. */
export function collectInterviews<T extends Pick<ApplicationRecord, "activity">>(
	applications: readonly T[],
): ScheduledInterview<T>[] {
	return applications
		.flatMap((application) =>
			application.activity.filter(isInterview).map((interview) => ({
				application,
				interview,
				start: new Date(interview.at),
				end: interviewEnd(interview),
			})),
		)
		.sort((a, b) => a.start.getTime() - b.start.getTime());
}

/** Interviews that haven't finished yet, soonest first. */
export const upcomingInterviews = <T>(interviews: readonly ScheduledInterview<T>[], now = new Date()) =>
	interviews.filter((item) => item.end.getTime() >= now.getTime());

const pad = (value: number) => String(value).padStart(2, "0");

/** The device's calendar day (YYYY-MM-DD) of a date: the web buckets interviews by the viewer's clock. */
export const dayKey = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

/** Interviews by the device's calendar day. */
export function groupInterviewsByDay<T>(interviews: readonly ScheduledInterview<T>[]) {
	const map = new Map<string, ScheduledInterview<T>[]>();
	for (const item of interviews) {
		const key = dayKey(item.start);
		map.set(key, [...(map.get(key) ?? []), item]);
	}
	return map;
}

/** Value for a date-and-time field on the device's clock (`2026-10-19T09:30`). */
export function toDateTimeLocal(value: Date | string) {
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return "";
	return `${dayKey(date)}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** A date-and-time field's value read on the device's clock, sent as an absolute ISO timestamp. */
export function fromDateTimeLocal(value: string) {
	if (!value) return null;
	const date = new Date(value);
	return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/** Whether an interview has ended. */
export const interviewEnded = (interview: InterviewTimelineEntry | undefined, now: Date) =>
	interview !== undefined && interviewEnd(interview).getTime() < now.getTime();

// ---- What an application needs next ----

/** Days without a reply after applying before a follow-up is suggested. */
export const FOLLOW_UP_AFTER_DAYS = 10;

type NextStepSource = Pick<ApplicationRecord, "status" | "activity" | "followUpAt" | "followUpNote" | "appliedAt">;

/**
 * What an application needs next, derived rather than stored: the earliest interview still to come, else the
 * follow-up date, else how long it has been waiting. Closed applications need nothing.
 */
export type NextStep =
	| { kind: "interview"; interview: InterviewTimelineEntry; at: Date }
	| { kind: "follow-up"; at: Date; note: string; overdue: boolean }
	| { kind: "no-reply"; days: number }
	| { kind: "waiting"; days: number }
	| { kind: "not-applied" }
	| { kind: "closed" };

/** When the application entered its current stage (its latest entry for that stage), or when it was added. */
function stageSince(application: Pick<ApplicationRecord, "status" | "activity" | "appliedAt">): Date {
	const entries = application.activity
		.filter((entry) => entry.type === "stage" && entry.stage === application.status)
		.map((entry) => new Date(entry.at).getTime());
	return new Date(entries.length > 0 ? Math.max(...entries) : new Date(application.appliedAt).getTime());
}

const daysBetween = (from: Date, to: Date) => Math.max(0, Math.floor((to.getTime() - from.getTime()) / DAY_MS));

/** Whole days the application has spent in its current stage. */
export const daysInStage = (
	application: Pick<ApplicationRecord, "status" | "activity" | "appliedAt">,
	now = new Date(),
) => daysBetween(stageSince(application), now);

export function getNextStep(application: NextStepSource, now = new Date()): NextStep {
	if (application.status === "closed") return { kind: "closed" };

	const upcoming = application.activity
		.filter(isInterview)
		.map((interview) => ({ interview, at: new Date(interview.at) }))
		.filter(({ interview, at }) => at.getTime() + interview.durationMinutes * 60_000 >= now.getTime())
		.sort((a, b) => a.at.getTime() - b.at.getTime())[0];
	if (upcoming) return { kind: "interview", ...upcoming };

	if (application.followUpAt) {
		const at = new Date(application.followUpAt);
		return { kind: "follow-up", at, note: application.followUpNote ?? "", overdue: at.getTime() < now.getTime() };
	}

	if (application.status === "saved") return { kind: "not-applied" };

	const days = daysInStage(application, now);
	if (application.status === "applied" && days >= FOLLOW_UP_AFTER_DAYS) return { kind: "no-reply", days };
	return { kind: "waiting", days };
}

// ---- The list ----

export type ApplicationSort = "updated" | "role" | "next";
export type ApplicationFilters = { search: string; tag: string; showClosed: boolean; stage?: ApplicationStatus | null };

type ListSource = Pick<ApplicationRecord, "id" | "role" | "company" | "status" | "tags" | "contacts">;

/** The applications a search (role, company, contact name or email), tag, stage and the closed switch keep. */
export function filterApplications<T extends ListSource>(applications: readonly T[], filters: ApplicationFilters) {
	const search = filters.search.trim().toLocaleLowerCase();
	return applications.filter(
		(application) =>
			(filters.showClosed || filters.stage === "closed" || application.status !== "closed") &&
			(!filters.stage || application.status === filters.stage) &&
			(!filters.tag || application.tags.includes(filters.tag)) &&
			(!search ||
				[
					application.role,
					application.company,
					...application.contacts.flatMap((contact) => [contact.name, contact.email]),
				].some((value) => value.toLocaleLowerCase().includes(search))),
	);
}

/** The list's groups in `LIST_ORDER`, each sorted by `sort`; empty groups are left out. */
export function groupApplications<T extends ListSource & NextStepSource & Pick<ApplicationRecord, "updatedAt">>(
	applications: readonly T[],
	sort: ApplicationSort,
	direction: "asc" | "desc",
	now = new Date(),
) {
	const nextTime = (application: T) => {
		const step = getNextStep(application, now);
		return step.kind === "interview" || step.kind === "follow-up" ? step.at.getTime() : Infinity;
	};
	const compare = (a: T, b: T) => {
		const left = sort === "next" ? nextTime(a) : new Date(a.updatedAt).getTime();
		const right = sort === "next" ? nextTime(b) : new Date(b.updatedAt).getTime();
		const order =
			sort === "role"
				? a.role.localeCompare(b.role) || a.company.localeCompare(b.company)
				: left === right
					? 0
					: left < right
						? -1
						: 1;
		return (direction === "asc" ? order : -order) || a.id.localeCompare(b.id);
	};
	return LIST_ORDER.map((status) => ({
		status,
		data: applications.filter((application) => application.status === status).toSorted(compare),
	})).filter((group) => group.data.length > 0);
}

/** Hidden or collapsed rows never stay selected for a bulk action. */
export function visibleSelection<T extends { id: string }>(
	groups: readonly { status: ApplicationStatus; data: readonly T[] }[],
	collapsed: ReadonlySet<ApplicationStatus>,
	selected: ReadonlySet<string>,
) {
	return groups.flatMap((group) =>
		collapsed.has(group.status) ? [] : group.data.filter((item) => selected.has(item.id)).map((item) => item.id),
	);
}

/** Every tag used across the applications, sorted. */
export const applicationTags = (applications: readonly Pick<ApplicationRecord, "tags">[]) =>
	[...new Set(applications.flatMap((application) => application.tags))].toSorted((a, b) => a.localeCompare(b));

// ---- The Board ----

/** A dropped card shown in its new column until the list's optimistic update lands. */
export type PendingMove = { id: string; from: ApplicationStatus; to: ApplicationStatus };

/** Drops the override once the list no longer shows the card at its old stage (moved, rolled back past, or gone). */
export const keepPending = (pending: PendingMove | null, applications: readonly { id: string; status: string }[]) =>
	pending && applications.find((application) => application.id === pending.id)?.status === pending.from
		? pending
		: null;

/**
 * A failed move clears its own override. Without this, a failure that rolls back before the optimistic update
 * renders leaves the list at `from` and the override showing the failed stage forever.
 */
export const pendingAfterError = (pending: PendingMove | null, id: string, to: ApplicationStatus) =>
	pending?.id === id && pending.to === to ? null : pending;

/** The Board's columns: every stage, each card at its pending stage while a drop is saving. */
export function boardColumns<T extends Pick<ApplicationRecord, "id" | "status">>(
	applications: readonly T[],
	pending: PendingMove | null,
) {
	const stageOf = (application: T) => (pending?.id === application.id ? pending.to : application.status);
	return [...PIPELINE, "closed" as const].map((status) => ({
		status,
		data: applications.filter((application) => stageOf(application) === status),
	}));
}
