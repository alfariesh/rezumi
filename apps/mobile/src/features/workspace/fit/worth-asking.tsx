import type { SavedData } from "../queries";
import { useLingui } from "@lingui/react/macro";
import { ActionButton, Block } from "../blocks";
import { useWorkspace } from "../queries";
import { Typography } from "@/ui";

type WorthAskingProps = { ask: NonNullable<SavedData<"fit">["ask"]>; applicationId: string; readOnly: boolean };

/** A question for the interviewer that the check surfaced, one tap from Prepare's questions. */
export function WorthAsking({ ask, applicationId, readOnly }: WorthAskingProps) {
	const { t } = useLingui();
	const workspace = useWorkspace(applicationId);
	const added = workspace.data.questions.some((question) => question.text === ask.text);
	const person = ask.person;
	return (
		<Block title={person ? t`Worth asking ${person}` : t`Worth asking`}>
			<Typography type="body-sm" color="muted">
				{ask.text}
			</Typography>
			{readOnly ? null : (
				<ActionButton
					icon={added ? "check" : "plus"}
					label={added ? t`Added to Prepare` : t`Add to questions`}
					disabled={added}
					onPress={() =>
						void workspace.save({
							questions: [...workspace.current().questions, { text: ask.text, origin: t`From Fit` }],
						})
					}
				/>
			)}
		</Block>
	);
}
