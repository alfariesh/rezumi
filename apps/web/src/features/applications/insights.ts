import type { ApplicationRecord } from "@rezumi/career/applications";
import { computeTimeline as weeklyTimeline } from "@rezumi/career/insights";

export { computeInsights, computeOutcomes } from "@rezumi/career/insights";
export type { StageCount } from "@rezumi/career/insights";

export type TimelineBucket = { label: string; count: number };

type TimelineSource = Pick<ApplicationRecord, "status" | "closedReason" | "activity" | "appliedAt" | "resumeId">;

// Applications sent in each of the last `weeks` Sunday-started weeks on the viewer's clock, labelled "month/day".
export function computeTimeline(
	applications: readonly TimelineSource[],
	weeks = 8,
	now = new Date(),
): TimelineBucket[] {
	const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
	return weeklyTimeline(applications, { now, timeZone, weekStartsOn: 0, weeks }).map(({ start, count }) => {
		const [, month = "", day = ""] = start.split("-");
		return { label: `${Number(month)}/${Number(day)}`, count };
	});
}
