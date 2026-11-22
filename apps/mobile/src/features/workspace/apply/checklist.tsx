// "Before you submit": five ticks kept with the application, copy or share the answers, and Mark as applied, which
// keeps the exact versions sent.
import type { Application } from "@/features/applications/types";
import type { CareerWorkspace } from "@rezumi/schema/career";
import { useLingui } from "@lingui/react/macro";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { View } from "react-native";
import { careerWorkspaceSchema } from "@rezumi/schema/career";
import { ActionButton, Block, Caption, CheckRow } from "../blocks";
import { clearDraft } from "../drafts";
import { useWorkspace, workspaceError } from "../queries";
import { ShareAnswers } from "./share-answers";
import { orpc } from "@/api/client";
import { useInvalidateApplications } from "@/features/applications/queries";
import { ProgressBar, Text, haptics, showToast } from "@/ui";

type Answer = CareerWorkspace["answers"][number];

type ChecklistProps = {
	application: Application;
	answers: Answer[];
	currentAnswers: () => Answer[];
	readOnly: boolean;
	canSubmit: boolean;
	submitting: boolean;
	onSubmittingChange: (value: boolean) => void;
};

export function Checklist(props: ChecklistProps) {
	const { application, answers, currentAnswers, readOnly, canSubmit, submitting, onSubmittingChange } = props;
	const { t } = useLingui();
	const queryClient = useQueryClient();
	const invalidate = useInvalidateApplications();
	const workspace = useWorkspace(application.id);
	const submit = useMutation(orpc.career.submitApplication.mutationOptions());
	const items = [
		t`Review the selected resume and cover letter in their editors.`,
		t`Check every claim, date and result against your experience.`,
		t`Review required form answers and remove unsupported claims.`,
		t`Submit through the employer's application page yourself.`,
		t`Mark the application as applied to keep the versions you sent.`,
	];
	const ticked = workspace.data.checklist;
	const submitted = application.status !== "saved";
	const done = items.filter((_, index) => ticked.includes(index)).length;
	const total = items.length;

	const toggle = (index: number, on: boolean) => {
		const current = workspace.current().checklist;
		void workspace.save({
			checklist: on ? [...new Set([...current, index])] : current.filter((item) => item !== index),
		});
	};

	const markApplied = async () => {
		if (readOnly || submitting) return;
		const answersNow = currentAnswers();
		if (!careerWorkspaceSchema.shape.answers.safeParse(answersNow).success) return;
		onSubmittingChange(true);
		try {
			const currentWorkspace = await workspace.settled();
			await submit.mutateAsync({
				applicationId: application.id,
				answers: answersNow,
				expectedAnswers: currentWorkspace.answers,
			});
			queryClient.setQueryData(workspace.queryKey, { ...currentWorkspace, answers: answersNow });
			// The server confirmed these exact texts, so their device drafts can go (newer edits stay).
			for (const answer of answersNow) {
				clearDraft(`answer:${application.id}:${answer.id}:answer`, answer.answer);
				clearDraft(`answer:${application.id}:${answer.id}:question`, answer.question);
			}
			// The ticks as they are now, not as they were when the button was pressed.
			void workspace.save({ checklist: [...new Set([...workspace.current().checklist, items.length - 1])] });
			haptics.success();
			showToast({ title: t`Marked as applied. The versions you sent are kept.`, variant: "success" });
		} catch (error) {
			showToast({ title: workspaceError(error, t`Couldn't mark it as applied. Try again.`), variant: "danger" });
		} finally {
			onSubmittingChange(false);
			void invalidate();
			void queryClient.invalidateQueries({ queryKey: orpc.career.savedItems.key() });
		}
	};

	return (
		<Block title={t`Before you submit`} trailing={<Text mono size="xs" tone="muted">{t`${done} of ${total}`}</Text>}>
			<ProgressBar value={(done / total) * 100} accessibilityLabel={t`Checklist progress`} />
			<View>
				{items.map((label, index) =>
					!submitted && !readOnly && index === items.length - 1 ? (
						<View key={label} className="pt-2">
							<ActionButton
								full
								size="md"
								variant="primary"
								label={t`Mark as applied`}
								disabled={!canSubmit}
								busy={submitting}
								onPress={() => void markApplied()}
								testID="apply-mark-applied"
							/>
						</View>
					) : (
						<CheckRow
							key={label}
							label={label}
							checked={ticked.includes(index)}
							disabled={readOnly || submitting}
							onChange={(on) => toggle(index, on)}
						/>
					),
				)}
			</View>
			{!canSubmit && !readOnly ? (
				<Text size="xs" tone="danger" accessibilityRole="alert">
					{t`Shorten questions to 2,000 characters and answers to 6,000 characters before marking this applied.`}
				</Text>
			) : null}
			<ShareAnswers
				application={application}
				written={answers.some((answer) => answer.answer.trim())}
				currentAnswers={currentAnswers}
			/>
			<Caption>{t`You submit on the employer's site yourself. Marking it applied keeps the exact versions you sent.`}</Caption>
		</Block>
	);
}
