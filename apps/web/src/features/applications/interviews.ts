import type { ApplicationSummary } from "./types";
import type { ScheduledInterview as SharedScheduledInterview } from "@rezumi/career/applications";

export {
	collectInterviews,
	dayKey,
	groupInterviewsByDay as groupByDay,
	interviewKindOf,
	isInterview,
	upcomingInterviews,
} from "@rezumi/career/applications";

export type ScheduledInterview = SharedScheduledInterview<ApplicationSummary>;

// "30 min", "1 hr", "1 hr 30 min" — localized unit names via Intl.
export function formatDuration(minutes: number, locale?: string) {
	const hours = Math.floor(minutes / 60);
	const rest = minutes % 60;
	const unit = (value: number, name: "hour" | "minute") =>
		new Intl.NumberFormat(locale, { style: "unit", unit: name, unitDisplay: "short" }).format(value);
	return [hours > 0 ? unit(hours, "hour") : null, rest > 0 || hours === 0 ? unit(rest, "minute") : null]
		.filter(Boolean)
		.join(" ");
}
