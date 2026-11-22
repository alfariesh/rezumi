import { plural } from "@lingui/core/macro";
import { useLingui } from "@lingui/react/macro";
import { ActionButton, FirstRun } from "../blocks";

type SessionSummaryProps = { answered: number; total: number; onRestart: () => void };

/** The end of the questions: how many got feedback, where the attempts are, and Start again. */
export function SessionSummary({ answered, total, onRestart }: SessionSummaryProps) {
	const { t } = useLingui();
	return (
		<FirstRun
			title={t`That's every question`}
			description={`${plural(answered, {
				one: "You got feedback on # answer",
				other: "You got feedback on # answers",
			})} ${plural(total, { one: "out of # question.", other: "out of # questions." })} ${t`Each attempt is kept under Your attempts.`}`}
			testID="practice-finished"
		>
			<ActionButton
				variant="primary"
				size="md"
				icon="arrow-counter-clockwise"
				label={t`Start again`}
				onPress={onRestart}
			/>
		</FirstRun>
	);
}
