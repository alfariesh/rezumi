import type { ReactNode } from "react";
import { useLingui } from "@lingui/react/macro";
import { Block } from "../blocks";
import { Typography } from "@/ui";

export type Question = { text: string; origin: "simulated" | "recalled" };

type QuestionCardProps = {
	question: Question;
	position: number;
	total: number;
	storyTitle: string | undefined;
	/** Hear it: the question read aloud, when a speech connection is set. */
	hear: ReactNode;
};

/** The question being practised, its place in the session and where it came from. */
export function QuestionCard({ question, position, total, storyTitle, hear }: QuestionCardProps) {
	const { t } = useLingui();
	const origin = question.origin === "recalled" ? t`Recalled` : t`Practice`;
	return (
		<Block title={`${t`Question ${position} of ${total}`} · ${origin}`} trailing={hear} testID="practice-question">
			<Typography.Heading type="h5">{question.text}</Typography.Heading>
			{storyTitle ? (
				<Typography type="body-sm" color="muted">
					{t`Practicing your story: ${storyTitle}`}
				</Typography>
			) : null}
		</Block>
	);
}
