// Apply (web workspace/apply.tsx, W4–W5): the written answers for the employer's form, Draft/Tighten, and the
// checklist before submitting there yourself.
import type { WorkspacePartProps } from "../part";
import type { CareerWorkspace } from "@rezumi/schema/career";
import { useLingui } from "@lingui/react/macro";
import { randomUUID } from "expo-crypto";
import { useCallback, useRef, useState } from "react";
import { View } from "react-native";
import { careerWorkspaceSchema } from "@rezumi/schema/career";
import { AiNotice } from "../ai-notice";
import { ActionButton, Caption, Notice } from "../blocks";
import { latest, useFacts, useSavedItems, useWorkspace } from "../queries";
import { dispatchForOrigin } from "../state";
import { AnswerCard } from "./answer-card";
import { Checklist } from "./checklist";
import { getDraftScope } from "@/draft";
import { useUserTime } from "@/features/applications/date";
import { withUndo } from "@/features/career/undo";
import { Skeleton } from "@/ui";

type Answer = CareerWorkspace["answers"][number];
export type CountUnit = "words" | "characters";

export function ApplyPart({ application, version }: WorkspacePartProps) {
	const { t } = useLingui();
	const { day } = useUserTime();
	const saved = useSavedItems(application.id);
	const workspace = useWorkspace(application.id);
	const facts = useFacts(application.id);
	const readOnlyVersion = version?.data.kind === "answers" ? version.data : undefined;
	const sentItem = latest(saved.data, "answers");
	// Removed questions wait out their Undo here; the workspace drops them when the toast closes.
	const [removed, setRemoved] = useState<string[]>([]);
	const [unit, setUnit] = useState<CountUnit>("words");
	const [submitting, setSubmitting] = useState(false);
	const [canSubmit, setCanSubmit] = useState(true);
	const drafts = useRef(new Map<string, () => Answer>());
	const registerDraft = useCallback((id: string, read: () => Answer) => {
		drafts.current.set(id, read);
		const updateValidity = () =>
			setCanSubmit(
				careerWorkspaceSchema.shape.answers.safeParse([...drafts.current.values()].map((value) => value())).success,
			);
		updateValidity();
		return () => {
			drafts.current.delete(id);
			updateValidity();
		};
	}, []);

	if (workspace.isPending || saved.isPending) return <Skeleton variant="none" className="h-60 rounded-2xl" />;

	const live = workspace.data.answers;
	// Stored answers that aren't in the workspace (a saved version, or what was sent before this part existed).
	const stored = readOnlyVersion ?? (live.length === 0 ? sentItem?.data : undefined);
	const shown: Answer[] = stored
		? stored.answers.map((answer, index) => ({ ...answer, id: `stored-${index}`, factIds: [] }))
		: live.filter((answer) => !removed.includes(answer.id));

	const saveAnswer = (id: string, patch: Partial<Answer>) =>
		workspace.save({
			answers: workspace.current().answers.map((answer) => (answer.id === id ? { ...answer, ...patch } : answer)),
		});
	const currentAnswers = () => shown.map((answer) => drafts.current.get(answer.id)?.() ?? answer);
	const removeAnswer = (id: string) => {
		setRemoved((ids) => [...ids, id]);
		const origin = getDraftScope();
		withUndo({
			message: t`Question removed`,
			// Dropped if another account is signed in when the Undo window ends; a failed save shows it again.
			commit: () =>
				dispatchForOrigin(origin, getDraftScope, async () => {
					const result = await workspace.save({
						answers: workspace.current().answers.filter((answer) => answer.id !== id),
					});
					if (!result.ok) throw new Error("Not removed");
				}),
			restore: () => setRemoved((ids) => ids.filter((item) => item !== id)),
			failed: () => undefined,
		});
	};
	const company = application.company;
	const appliedOn = day(application.appliedAt);

	return (
		<View className="gap-4">
			{application.status !== "saved" ? (
				<Notice
					icon="check-circle"
					title={t`Submitted on ${appliedOn}.`}
					message={t`The versions you sent are kept in Saved. Edits here don't change what ${company} received.`}
				/>
			) : null}
			{stored && !readOnlyVersion ? (
				<Notice
					status="default"
					message={t`These are the answers saved when you applied.`}
					action={{
						label: t`Use these answers`,
						onPress: () =>
							void workspace.save({
								answers: stored.answers.map((answer) => ({ ...answer, id: randomUUID(), factIds: [] })),
							}),
					}}
				/>
			) : null}

			{shown.map((answer) => (
				<AnswerCard
					key={stored ? `${version?.id ?? sentItem?.id}:${answer.id}` : answer.id}
					answer={answer}
					facts={facts.data}
					applicationId={application.id}
					readOnly={stored !== undefined}
					disabled={submitting}
					registerDraft={registerDraft}
					onSave={(patch) => saveAnswer(answer.id, patch)}
					fetchServer={() =>
						workspace.fetchConfirmed().then((data) => data.answers.find((item) => item.id === answer.id))
					}
					onRemove={() => removeAnswer(answer.id)}
					unit={unit}
					onToggleUnit={() => setUnit(unit === "words" ? "characters" : "words")}
				/>
			))}

			{stored ? null : (
				<View className="gap-2">
					{shown.length > 0 ? <AiNotice /> : null}
					<ActionButton
						full
						size="md"
						icon="plus"
						label={t`Add a question from the form`}
						disabled={submitting || live.length >= 30}
						onPress={() =>
							void workspace.save({
								answers: [...workspace.current().answers, { id: randomUUID(), question: "", answer: "", factIds: [] }],
							})
						}
						testID="apply-add-question"
					/>
					{live.length >= 30 ? <Caption>{t`You can keep up to 30 application questions.`}</Caption> : null}
				</View>
			)}

			<Checklist
				application={application}
				answers={shown}
				currentAnswers={currentAnswers}
				readOnly={!!readOnlyVersion}
				canSubmit={canSubmit}
				submitting={submitting}
				onSubmittingChange={setSubmitting}
			/>
		</View>
	);
}
