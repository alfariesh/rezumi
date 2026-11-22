// What they asked, what the person said and how it landed, kept on the device (server + account) until it's
// reviewed, across parts and restarts; Review my answer sends it to the coach.
import type { Review } from "./review-card";
import type { Application } from "@/features/applications/types";
import type { InterviewKind, InterviewTimelineEntry } from "@rezumi/schema/applications/data";
import { useLingui } from "@lingui/react/macro";
import { View } from "react-native";
import { AiNotice, PrivacyLine } from "../ai-notice";
import { ActionButton, Block, Caption } from "../blocks";
import { useDraft } from "../drafts";
import { useGenerate } from "../queries";
import { useWorking, workingSteps } from "../working";
import { useHasAIProvider } from "@/features/ai/providers";
import { useUserTime } from "@/features/applications/date";
import { Chip, Input, Label, Text, TextArea, TextField } from "@/ui";

type Landed = Review["data"]["landed"];
type Draft = { question: string; answer: string; landed: Landed | null };

type DebriefFormProps = {
	application: Application;
	round: InterviewTimelineEntry | undefined;
	/** A saved debrief to start from: the one opened from Saved, or this round's last review. */
	from: Review | undefined;
	readOnly: boolean;
	onReviewed: (review: Review) => void;
};

export function DebriefForm({ application, round, from, readOnly, onReviewed }: DebriefFormProps) {
	const { t } = useLingui();
	const { day } = useUserTime();
	const generate = useGenerate(application.id);
	const provider = useHasAIProvider().defaultProvider;
	const reviewLabel = useWorking(generate.isPending, workingSteps("debrief"), t`Review my answer`);
	const initial: Draft = from
		? { question: from.data.question, answer: from.data.answer, landed: from.data.landed }
		: { question: "", answer: "", landed: null };
	const draft = useDraft<Draft>(readOnly ? null : `debrief:${application.id}:${round?.id ?? "none"}`, initial);
	const value = readOnly ? initial : draft.value;
	const change = (patch: Partial<Draft>) => {
		if (!readOnly) draft.setValue((current) => ({ ...current, ...patch }));
	};
	const submit = () => {
		if (!value.landed) return;
		// Edits made while the review runs are a newer revision; only this one is cleared when it lands.
		const submitted = value;
		generate
			.run({
				task: "debrief",
				interviewId: round?.id ?? null,
				question: value.question.trim(),
				answer: value.answer.trim(),
				landed: value.landed,
			})
			.then(({ item }) => {
				if (item?.data.kind !== "debrief") return;
				onReviewed(item as Review);
				draft.clear(submitted);
			})
			.catch(() => undefined);
	};
	const ready = value.question.trim() !== "" && value.answer.trim() !== "" && value.landed !== null;
	const providerName = provider?.label ?? t`your AI connection`;
	const afterRound = {
		screening: t`After the screening`,
		technical: t`After the technical interview`,
		behavioral: t`After the behavioral interview`,
		onsite: t`After the onsite`,
		other: t`After the interview`,
	} satisfies Record<InterviewKind, string>;
	const title =
		(readOnly && !round ? from?.data.round || t`Interview debrief` : afterRound[round?.kind ?? "other"]) +
		(round ? ` · ${day(round.at)}` : "");
	const landed = [
		{ value: "well", label: t`Went well` },
		{ value: "mixed", label: t`Mixed` },
		{ value: "not", label: t`Didn't land` },
	] as const;

	return (
		<Block title={title}>
			<Caption>{t`Write it down while it's fresh`}</Caption>
			<TextField isDisabled={readOnly}>
				<Label>{t`What did they ask?`}</Label>
				<Input
					variant="secondary"
					value={value.question}
					maxLength={500}
					accessibilityLabel={t`What did they ask?`}
					onChangeText={(question) => change({ question })}
				/>
			</TextField>
			<TextField isDisabled={readOnly}>
				<Label>{t`What did you say, as close as you remember?`}</Label>
				<TextArea
					variant="secondary"
					value={value.answer}
					maxLength={6000}
					accessibilityLabel={t`What did you say, as close as you remember?`}
					onChangeText={(answer) => change({ answer })}
				/>
			</TextField>
			<View className="gap-1.5" accessibilityRole="radiogroup" accessibilityLabel={t`How did it land?`}>
				<Text tone="muted">{t`How did it land?`}</Text>
				<View className="flex-row flex-wrap gap-2">
					{landed.map((option) => {
						const selected = value.landed === option.value;
						return (
							<Chip
								key={option.value}
								variant={selected ? "primary" : "secondary"}
								color={selected ? "accent" : "default"}
								accessibilityRole="radio"
								accessibilityState={{ checked: selected, disabled: readOnly }}
								disabled={readOnly}
								onPress={() => change({ landed: selected ? null : option.value })}
								testID={`debrief-landed-${option.value}`}
							>
								<Chip.Label>{option.label}</Chip.Label>
							</Chip>
						);
					})}
				</View>
			</View>
			{readOnly ? null : (
				<View className="gap-2">
					<ActionButton
						full
						size="md"
						variant="primary"
						label={reviewLabel}
						disabled={!ready || !provider}
						busy={generate.isPending}
						onPress={submit}
						testID="debrief-review"
					/>
					{provider ? (
						<PrivacyLine>
							{t`Review my answer sends the question, what you said, this posting and your Profile to ${providerName}.`}
						</PrivacyLine>
					) : (
						<>
							<PrivacyLine>{t`Reviewing needs an AI connection. What you write here stays on this device until then.`}</PrivacyLine>
							<AiNotice />
						</>
					)}
				</View>
			)}
		</Block>
	);
}
