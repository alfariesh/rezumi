// The application's interviews, soonest first, on the user's clock; a tap edits one, Schedule adds one. The sheet
// itself is the shared InterviewSheet (it keeps device reminders in step).
import type { Application } from "../types";
import type { InterviewTimelineEntry } from "@rezumi/schema/applications/data";
import { useLingui } from "@lingui/react/macro";
import { isInterview, interviewEnd } from "@rezumi/career/applications";
import { useNow, useUserTime } from "../date";
import { getInterviewKindLabel } from "../stages";
import { DetailSection } from "./section";
import { Button, EmptyState, Icon, ListRow, ListSection } from "@/ui";

type InterviewsProps = {
	application: Application;
	onOpen: (interview: InterviewTimelineEntry | null) => void;
};

export function Interviews({ application, onOpen }: InterviewsProps) {
	const { t } = useLingui();
	const now = useNow();
	const { when, time } = useUserTime();
	const interviews = application.activity
		.filter(isInterview)
		.toSorted((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
	const closed = application.status === "closed";
	const schedule = closed ? null : (
		<Button size="sm" variant="ghost" onPress={() => onOpen(null)} testID="interview-schedule">
			<Icon name="plus" size={16} />
			<Button.Label>{t`Schedule interview`}</Button.Label>
		</Button>
	);
	return (
		<DetailSection title={t`Interviews`} action={schedule} testID="interviews">
			{interviews.length === 0 ? (
				<EmptyState kind="inline" title={t`No interviews yet`} description={t`Schedule one when they invite you.`} />
			) : (
				<ListSection>
					{interviews.map((interview) => {
						const past = interviewEnd(interview).getTime() < now.getTime();
						const kind = getInterviewKindLabel(interview.kind);
						return (
							<ListRow
								key={interview.id}
								icon={past ? "check-circle" : "calendar-dot"}
								title={t`${kind} interview`}
								description={[`${when(interview.at)}–${time(interviewEnd(interview))}`, interview.location]
									.filter(Boolean)
									.join(" · ")}
								accessibilityHint={t`Edits the interview`}
								onPress={() => onOpen(interview)}
								testID={`interview-${interview.id}`}
							/>
						);
					})}
				</ListSection>
			)}
		</DetailSection>
	);
}
