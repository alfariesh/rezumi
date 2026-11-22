// Prepare (web workspace/prepare.tsx, W6/W7/W21): before the call, a timed plan from the briefing; from 10 minutes
// before until it ends, a short checklist that works without AI; afterwards, a nudge to Debrief.
import type { WorkspacePartProps } from "../part";
import type { Briefing } from "./briefing";
import type { InterviewTimelineEntry } from "@rezumi/schema/applications/data";
import { useLingui } from "@lingui/react/macro";
import { preparePhase } from "@rezumi/career/workspace";
import { AiNotice, PrivacyLine } from "../ai-notice";
import { ActionButton, FirstRun } from "../blocks";
import { latest, useGenerate, useSavedItems } from "../queries";
import { useWorking, workingSteps } from "../working";
import { isBriefing } from "./briefing";
import { Plan } from "./plan";
import { Soon } from "./soon";
import { useHasAIProvider } from "@/features/ai/providers";
import { Skeleton } from "@/ui";

export function PreparePart({ application, version, interview, now, go, addInterview }: WorkspacePartProps) {
	const { t } = useLingui();
	const saved = useSavedItems(application.id);
	const viewing = isBriefing(version) ? version : undefined;

	if (!interview && !viewing)
		return (
			<FirstRun
				title={t`Add an interview to plan for it`}
				description={t`Once a round is scheduled, Prepare builds a timed plan, your opening and the questions to ask.`}
				testID="prepare-no-interview"
			>
				<ActionButton size="md" icon="calendar-dot" label={t`Add an interview`} onPress={addInterview} />
			</FirstRun>
		);

	const briefing: Briefing | undefined = viewing ?? latest(saved.data, "briefing", interview?.id ?? null);

	if (interview && !viewing) {
		const phase = preparePhase(interview, now);
		if (phase === "after")
			return (
				<FirstRun
					title={t`How did it go?`}
					description={t`Write down what they asked while it's fresh. The coach compares your answers with your stories.`}
				>
					<ActionButton variant="primary" size="md" label={t`Start a debrief`} onPress={() => go("debrief")} />
				</FirstRun>
			);
		if (phase === "soon")
			return <Soon application={application} interview={interview} briefing={briefing} now={now} go={go} />;
	}

	if (!briefing) {
		if (saved.isPending) return <Skeleton variant="none" className="h-60 rounded-2xl" />;
		return interview ? <PlanEmpty applicationId={application.id} interview={interview} /> : null;
	}

	return <Plan application={application} interview={interview} briefing={briefing} readOnly={!!viewing} go={go} />;
}

type PlanEmptyProps = { applicationId: string; interview: InterviewTimelineEntry };

function PlanEmpty({ applicationId, interview }: PlanEmptyProps) {
	const { t } = useLingui();
	const provider = useHasAIProvider().defaultProvider;
	const generate = useGenerate(applicationId);
	const label = useWorking(generate.isPending, workingSteps("briefing"), t`Plan my preparation`);
	const name = provider?.label ?? "";
	return (
		<FirstRun
			title={t`A focused plan for this round`}
			description={t`A timed plan, your opening, the stories to bring and questions to ask. It becomes your checklist 10 minutes before the call.`}
		>
			{provider ? (
				<>
					<ActionButton
						variant="primary"
						size="md"
						label={label}
						busy={generate.isPending}
						onPress={() => void generate.run({ task: "briefing", interviewId: interview.id }).catch(() => undefined)}
						testID="prepare-plan"
					/>
					<PrivacyLine centered>
						{t`Sends this application (posting, notes, interview details) and your Profile, if switched on, to ${name}.`}
					</PrivacyLine>
				</>
			) : (
				<AiNotice centered />
			)}
		</FirstRun>
	);
}
