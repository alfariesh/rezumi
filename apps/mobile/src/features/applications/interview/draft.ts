// The interview form's state: a draft on the interview's own wall clock (date, time and its time zone), read back as
// the instant and details the API takes. No React here.
import type { InterviewKind, InterviewTimelineEntry } from "@rezumi/schema/applications/data";
import { isTimeZone, zonedParts } from "@rezumi/career/time";
import { interviewDetailsSchema } from "@rezumi/schema/applications/data";
import { generateId } from "@rezumi/utils/string";
import { fromZonedDateTime } from "@rezumi/utils/timezone";

export const INTERVIEW_KIND_ORDER: readonly InterviewKind[] = [
	"screening",
	"technical",
	"behavioral",
	"onsite",
	"other",
];
export const LENGTHS: readonly number[] = [30, 45, 60, 90];
export const MAX_PEOPLE = 20;

export type Participant = { id: string; name: string; role: string; profileUrl: string };

export type InterviewDraft = {
	kind: InterviewKind;
	/** "2026-10-19" on the interview's clock. */
	date: string;
	/** "16:00" on the interview's clock. */
	time: string;
	durationMinutes: number;
	location: string;
	notes: string;
	/** Not shown (as on the web); kept so saving doesn't reset it. */
	audience: InterviewTimelineEntry["audience"];
	timezone: string;
	participants: Participant[];
};

/**
 * A new interview: the slot tapped on the calendar, else tomorrow at 09:00 in `timeZone`, or the next full hour when
 * that has passed.
 */
export function emptyDraft(
	timeZone: string,
	initial?: { date: string; time: string },
	now = new Date(),
): InterviewDraft {
	const tomorrow = zonedParts(new Date(now.getTime() + 86_400_000), timeZone).date;
	let at = fromZonedDateTime(tomorrow, "09:00", timeZone) ?? now;
	if (at <= now) at = new Date(Math.ceil(now.getTime() / 3_600_000) * 3_600_000);
	return {
		kind: "screening",
		...(initial ?? zonedParts(at, timeZone)),
		durationMinutes: 60,
		location: "",
		notes: "",
		audience: "other",
		timezone: timeZone,
		participants: [],
	};
}

/** The draft of a saved interview, on its own time zone (the user's when it has none or an unknown one). */
export function draftFrom(interview: InterviewTimelineEntry, fallbackZone: string): InterviewDraft {
	const timezone = interview.timezone && isTimeZone(interview.timezone) ? interview.timezone : fallbackZone;
	return {
		kind: interview.kind,
		...zonedParts(interview.at, timezone),
		durationMinutes: interview.durationMinutes,
		location: interview.location,
		notes: interview.notes,
		audience: interview.audience ?? "other",
		timezone,
		participants: (interview.participants ?? []).map((person) => ({
			id: generateId(),
			name: person.name,
			role: person.role,
			profileUrl: person.profileUrl ?? "",
		})),
	};
}

/**
 * The instant the draft starts, or null when that wall-clock time doesn't exist (a DST gap). An unchanged clock keeps
 * the stored instant exactly, including inside a DST overlap.
 */
export function draftStart(draft: InterviewDraft, interview: InterviewTimelineEntry | null | undefined) {
	if (interview) {
		const original = zonedParts(interview.at, draft.timezone);
		if (original.date === draft.date && original.time === draft.time) return new Date(interview.at);
	}
	return fromZonedDateTime(draft.date, draft.time, draft.timezone);
}

/** The details the API takes, checked by the shared schema; people without a name are left out. */
export const draftDetails = (draft: InterviewDraft) =>
	interviewDetailsSchema.safeParse({
		...draft,
		participants: draft.participants
			.filter(({ name }) => name.trim())
			.map(({ name, role, profileUrl }) => ({
				name,
				role,
				...(profileUrl.trim() ? { profileUrl: profileUrl.trim() } : {}),
			})),
	});

/** The length choices, with the interview's own length added when it is not one of them. */
export const lengthChoices = (current: number) =>
	LENGTHS.includes(current) ? LENGTHS : [...LENGTHS, current].toSorted((a, b) => a - b);

export const newParticipant = (): Participant => ({ id: generateId(), name: "", role: "", profileUrl: "" });
