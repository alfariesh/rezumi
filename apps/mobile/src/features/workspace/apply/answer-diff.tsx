import { useLingui } from "@lingui/react/macro";
import { View } from "react-native";
import { diffWords } from "@rezumi/career/workspace";
import { ActionButton, Actions } from "../blocks";
import { Typography, cx } from "@/ui";

type Proposal = { text: string; factIds: string[] };

type AnswerDiffProps = {
	before: string;
	proposal: Proposal;
	disabled: boolean;
	onAccept: (proposal: Proposal) => void;
	onSkip: () => void;
};

/** The coach's version against the person's, word by word: removed words struck through, added ones marked. */
export function AnswerDiff({ before, proposal, disabled, onAccept, onSkip }: AnswerDiffProps) {
	const { t } = useLingui();
	const parts = diffWords(before, proposal.text);
	return (
		<View className="gap-2">
			<Typography
				type="body-sm"
				className="rounded-xl bg-surface-secondary p-3"
				accessibilityLabel={t`Suggested answer: ${proposal.text}`}
			>
				{parts.map((part, index) => (
					<Typography
						key={index}
						type="body-sm"
						className={cx(
							part.type === "removed" && "text-muted line-through",
							part.type === "added" && "bg-accent-soft text-accent-soft-foreground",
						)}
					>
						{`${part.text} `}
					</Typography>
				))}
			</Typography>
			<Actions>
				<ActionButton icon="check" label={t`Accept`} disabled={disabled} onPress={() => onAccept(proposal)} />
				<ActionButton variant="ghost" label={t`Skip`} onPress={onSkip} />
			</Actions>
		</View>
	);
}
