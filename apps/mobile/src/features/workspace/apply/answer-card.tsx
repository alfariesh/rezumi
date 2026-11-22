// One form question: the autosaving answer, its length in words or characters, the facts behind it, and Draft or
// Tighten from the Profile with a before/after to accept or skip.
import type { Fact } from "../queries";
import type { SaveResult } from "../state";
import type { CountUnit } from "./apply-part";
import type { CareerWorkspace } from "@rezumi/schema/career";
import { plural } from "@lingui/core/macro";
import { useLingui } from "@lingui/react/macro";
import { useLayoutEffect, useState } from "react";
import { Pressable, View } from "react-native";
import { countCharacters, countWords, shortLabel } from "@rezumi/career/workspace";
import { ActionButton, Actions, Block } from "../blocks";
import { useAutosave, useDraft } from "../drafts";
import { useGenerate } from "../queries";
import { SaveError } from "../save-error";
import { useWorking, workingSteps } from "../working";
import { AnswerDiff } from "./answer-diff";
import { AnswerMenu } from "./answer-menu";
import { useHasAIProvider } from "@/features/ai/providers";
import { Chip, Description, Label, Text, TextArea, TextField, Typography, showToast } from "@/ui";

type Answer = CareerWorkspace["answers"][number];

type AnswerCardProps = {
	answer: Answer;
	facts: Fact[] | undefined;
	applicationId: string;
	readOnly: boolean;
	disabled: boolean;
	registerDraft: (id: string, read: () => Answer) => () => void;
	/** Resolves once the server confirmed it, or with why it failed. */
	onSave: (patch: Partial<Answer>) => Promise<SaveResult>;
	/** This answer in a freshly fetched, server-confirmed workspace (undefined when it was removed there). */
	fetchServer: () => Promise<Answer | undefined>;
	onRemove: () => void;
	unit: CountUnit;
	onToggleUnit: () => void;
};

export function AnswerCard(props: AnswerCardProps) {
	const { answer, facts, applicationId, readOnly, disabled, registerDraft, onSave, fetchServer } = props;
	const { t } = useLingui();
	// Typed text stays on the device until the server has it, so a failed save survives leaving the part.
	const draftName = readOnly ? null : `answer:${applicationId}:${answer.id}`;
	const answerDraft = useDraft(draftName && `${draftName}:answer`, answer.answer);
	const questionDraft = useDraft(draftName && `${draftName}:question`, answer.question);
	const text = answerDraft.value;
	const question = questionDraft.value;
	useLayoutEffect(
		() => registerDraft(answer.id, () => ({ ...answer, question, answer: text })),
		[answer, question, text, registerDraft],
	);
	const [editingQuestion, setEditingQuestion] = useState(answer.question === "");
	const [proposal, setProposal] = useState<{ text: string; factIds: string[] } | null>(null);
	const generate = useGenerate(applicationId);
	const provider = useHasAIProvider().defaultProvider;
	const frozen = disabled || readOnly;
	const answerSave = useAutosave(
		frozen ? answer.answer : text,
		answer.answer,
		(value) => onSave({ answer: value }),
		answerDraft,
		() => fetchServer().then((server) => server?.answer ?? ""),
	);
	const questionSave = useAutosave(
		frozen ? answer.question : question,
		answer.question,
		(value) => onSave({ question: value }),
		questionDraft,
		() => fetchServer().then((server) => server?.question ?? ""),
	);
	const empty = !text.trim();
	const aiLabel = useWorking(
		generate.isPending,
		workingSteps(empty ? "answer" : "tighten"),
		empty ? t`Draft` : t`Tighten`,
	);
	const words = countWords(text);
	const characters = countCharacters(text);
	const backing = answer.factIds.flatMap((id) => facts?.find((fact) => fact.id === id) ?? []);
	const ask = async () => {
		const result = await generate.run({ task: "answer", question: question.trim(), answer: text }).catch(() => null);
		if (result?.answer) setProposal(result.answer);
	};
	const accept = (accepted: { text: string; factIds: string[] }) => {
		answerDraft.setValue(accepted.text);
		void onSave({ answer: accepted.text, factIds: accepted.factIds }).then(
			(result) => result.ok && answerDraft.clear(accepted.text),
		);
		setProposal(null);
	};

	return (
		<Block
			title={editingQuestion && !readOnly ? undefined : question}
			trailing={
				<>
					<Pressable
						accessibilityRole="button"
						accessibilityLabel={props.unit === "words" ? t`Count characters` : t`Count words`}
						onPress={props.onToggleUnit}
						hitSlop={12}
					>
						<Text mono size="xs" tone="muted">
							{props.unit === "words"
								? plural(words, { one: "# word", other: "# words" })
								: plural(characters, { one: "# character", other: "# characters" })}
						</Text>
					</Pressable>
					{readOnly ? null : (
						<AnswerMenu disabled={disabled} onEdit={() => setEditingQuestion(true)} onRemove={props.onRemove} />
					)}
				</>
			}
		>
			{editingQuestion && !readOnly ? (
				<TextField isDisabled={disabled}>
					<Label>{t`Question from the form`}</Label>
					<TextArea
						variant="secondary"
						value={question}
						maxLength={2000}
						autoFocus
						accessibilityLabel={t`Question from the form`}
						placeholder={t`Paste the question from the form`}
						onChangeText={questionDraft.setValue}
						onBlur={() => {
							questionSave.flush();
							if (question.trim()) setEditingQuestion(false);
						}}
					/>
				</TextField>
			) : null}
			{proposal ? (
				<AnswerDiff
					before={text}
					proposal={proposal}
					disabled={disabled}
					onAccept={accept}
					onSkip={() => setProposal(null)}
				/>
			) : readOnly ? (
				<Typography type="body-sm" color="muted">
					{text}
				</Typography>
			) : (
				<TextField isDisabled={disabled}>
					<Label>{question || t`Answer`}</Label>
					<TextArea
						variant="secondary"
						value={text}
						maxLength={6000}
						accessibilityLabel={question || t`Answer`}
						onChangeText={answerDraft.setValue}
						onBlur={answerSave.flush}
					/>
					<Description>{t`Write your answer, or draft one from your Profile.`}</Description>
				</TextField>
			)}
			<SaveError autosave={questionSave} />
			<SaveError autosave={answerSave} />
			{backing.length > 0 ? (
				<View className="gap-1">
					<Text size="xs" tone="muted">{t`Backed by`}</Text>
					<Actions>
						{backing.map((fact) => (
							<Chip key={fact.id} size="sm" variant="secondary" onPress={() => showToast({ title: fact.text })}>
								<Chip.Label>{shortLabel(fact.text)}</Chip.Label>
							</Chip>
						))}
					</Actions>
				</View>
			) : null}
			{!readOnly && !proposal && provider ? (
				<ActionButton
					variant="ghost"
					icon="sparkle"
					label={aiLabel}
					busy={generate.isPending}
					disabled={disabled || !question.trim()}
					onPress={() => void ask()}
				/>
			) : null}
		</Block>
	);
}
