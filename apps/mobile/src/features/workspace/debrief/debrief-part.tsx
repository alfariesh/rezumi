// Debrief (web workspace/debrief.tsx): write the interview down while it's fresh, review it against the Profile,
// choose what to remember, and a light practice plan for the week.
import type { WorkspacePartProps } from "../part";
import type { Review } from "./review-card";
import { useLingui } from "@lingui/react/macro";
import { useState } from "react";
import { View } from "react-native";
import { isInterview } from "@rezumi/career/applications";
import { debriefRound } from "@rezumi/career/workspace";
import { latest, useSavedItems } from "../queries";
import { DebriefForm } from "./debrief-form";
import { ReviewCard, isDebrief } from "./review-card";
import { WeekPlan } from "./week-plan";
import { EmptyState, Skeleton } from "@/ui";

export function DebriefPart({ application, version, now }: WorkspacePartProps) {
	const { t } = useLingui();
	const saved = useSavedItems(application.id);
	const [fresh, setFresh] = useState<Review | null>(null);
	const viewing = isDebrief(version) ? version : undefined;
	const round = viewing
		? application.activity.filter(isInterview).find((entry) => entry.id === viewing.interviewId)
		: debriefRound(application.activity, now);
	const forRound = latest(saved.data, "debrief", round?.id ?? null);
	const review = viewing ?? fresh ?? forRound;
	const plan = viewing ?? fresh ?? latest(saved.data, "debrief");

	return (
		<View className="gap-4">
			{saved.isPending ? (
				<Skeleton variant="none" className="h-72 rounded-2xl" />
			) : (
				<DebriefForm
					key={`form:${viewing?.id ?? round?.id ?? "none"}`}
					application={application}
					round={round}
					from={viewing ?? forRound}
					readOnly={viewing !== undefined}
					onReviewed={setFresh}
				/>
			)}
			{review ? (
				<ReviewCard key={`review:${review.id}`} application={application} review={review} readOnly={!!viewing} />
			) : null}
			{plan ? (
				<WeekPlan key={plan.id} application={application} review={plan} now={now} readOnly={!!viewing} />
			) : (
				<EmptyState kind="inline" title={t`After your first review, a light plan for this week appears here.`} />
			)}
		</View>
	);
}
