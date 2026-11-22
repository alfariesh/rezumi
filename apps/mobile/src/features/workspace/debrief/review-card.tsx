// The review: what the evidence supports versus what was only observed, what to do in the next round, and one thing
// worth remembering for this job only (saved to the Profile, private to this application).
import type { SavedData, SavedItem } from "../queries";
import type { Application } from "@/features/applications/types";
import { useLingui } from "@lingui/react/macro";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import Storage from "expo-sqlite/kv-store";
import { useState } from "react";
import { View } from "react-native";
import { AiNotice } from "../ai-notice";
import { ActionButton, Actions, Block, Notice, Pill } from "../blocks";
import { useFacts, workspaceError } from "../queries";
import { orpc } from "@/api/client";
import { Text, Typography, showToast } from "@/ui";

type Debrief = SavedData<"debrief">;
export type Review = Pick<SavedItem, "id" | "interviewId" | "evidence"> & { data: Debrief };

export const isDebrief = (item: SavedItem | undefined): item is SavedItem & { data: Debrief } =>
	item?.data.kind === "debrief";

const dismissKey = (id: string) => `rezumi:career-memory-dismissed:${id}`;

type ReviewCardProps = { application: Application; review: Review; readOnly: boolean };

export function ReviewCard({ application, review, readOnly }: ReviewCardProps) {
	const { t } = useLingui();
	const queryClient = useQueryClient();
	const { data } = review;
	const facts = useFacts(application.id);
	const [dismissed, setDismissed] = useState(() => Storage.getItemSync(dismissKey(review.id)) === "1");
	const save = useMutation({
		...orpc.career.saveFact.mutationOptions(),
		onSuccess: (fact) => {
			void queryClient.invalidateQueries({ queryKey: orpc.career.facts.key() });
			if (!fact) {
				showToast({ title: t`You forgot this before, so it wasn't saved again.` });
				setDismissed(true);
			}
		},
		onError: (error) =>
			showToast({ title: workspaceError(error, t`Couldn't save that to your Profile. Try again.`), variant: "danger" }),
	});
	const remembered =
		Boolean(save.data) ||
		(facts.data?.some((fact) => fact.source.kind === "debrief" && fact.source.id === review.id) ?? false);
	// Fact ids the model left in its text read as "your Profile".
	const readable = (text: string) =>
		[...new Set([...review.evidence.factIds, ...(facts.data ?? []).map((fact) => fact.id)])]
			.filter(Boolean)
			.reduce((value, id) => value.split(id).join(t`your Profile`), text);
	const company = application.company;

	return (
		<Block title={data.title} testID="debrief-review-card">
			{data.verdicts.map((verdict) => (
				<View key={verdict.text} className="gap-1">
					<Pill
						tone={verdict.tag === "supported" ? "success" : "warning"}
						label={verdict.tag === "supported" ? t`Supported` : t`Observation`}
					/>
					<Typography type="body-sm">{readable(verdict.text)}</Typography>
				</View>
			))}
			{data.nextRound ? <Labelled label={t`For the next round:`} text={readable(data.nextRound)} /> : null}
			{data.priority ? <Labelled label={t`Practice priority:`} text={readable(data.priority)} /> : null}
			{data.remember && !readOnly && !dismissed ? (
				remembered ? (
					<Notice
						status="success"
						icon="check-circle"
						message={t`Saved to your Profile, private to this application.`}
					/>
				) : (
					<View className="gap-2">
						<Notice icon="bookmark-simple" title={t`Remember for ${company} only?`} message={data.remember} />
						<Actions>
							<ActionButton
								label={t`Remember`}
								busy={save.isPending}
								onPress={() => {
									if (!data.remember) return;
									save.mutate({
										applicationId: application.id,
										category: "experience",
										text: data.remember,
										source: { kind: "debrief", id: review.id, quote: data.remember },
									});
								}}
							/>
							<ActionButton
								variant="ghost"
								label={t`Not now`}
								onPress={() => {
									setDismissed(true);
									Storage.setItemSync(dismissKey(review.id), "1");
								}}
							/>
						</Actions>
					</View>
				)
			) : null}
			{readOnly ? null : <AiNotice report={data.verdicts.map((verdict) => verdict.text).join("\n")} />}
		</Block>
	);
}

function Labelled({ label, text }: { label: string; text: string }) {
	return (
		<Typography type="body-sm">
			<Text weight="semibold">{label}</Text> {text}
		</Typography>
	);
}
