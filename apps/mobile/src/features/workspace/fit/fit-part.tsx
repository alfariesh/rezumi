// Fit (web workspace/fit.tsx, W1–W3): each requirement from the posting against the person's evidence, with gaps
// closed in place by saving a fact to the Profile.
import type { WorkspacePartProps } from "../part";
import type { SavedData, SavedItem } from "../queries";
import type { EvidenceStatus } from "./requirement-card";
import { useLingui } from "@lingui/react/macro";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { View } from "react-native";
import { AiNotice } from "../ai-notice";
import { ActionButton, Block, FirstRun } from "../blocks";
import { latest, useFacts, useGenerate, useSavedItems, useWorkspace } from "../queries";
import { useWorking, workingSteps } from "../working";
import { CheckLine, RequirementCard } from "./requirement-card";
import { WorthAsking } from "./worth-asking";
import { orpc } from "@/api/client";
import { useHasAIProvider } from "@/features/ai/providers";
import { Skeleton, Text, Typography, showToast } from "@/ui";

type FitItem = SavedItem & { data: SavedData<"fit"> };
type Requirement = SavedData<"fit">["requirements"][number];

export function FitPart({ application, version }: WorkspacePartProps) {
	const { t } = useLingui();
	const queryClient = useQueryClient();
	const saved = useSavedItems(application.id);
	const workspace = useWorkspace(application.id);
	const generate = useGenerate(application.id);
	const provider = useHasAIProvider().defaultProvider;
	const facts = useFacts(application.id);
	const forget = useMutation(orpc.career.forgetFact.mutationOptions());
	const readOnly = version?.data.kind === "fit";
	const item = (readOnly ? version : latest(saved.data, "fit")) as FitItem | undefined;
	const checkLabel = useWorking(generate.isPending, workingSteps("fit"), item ? t`Check again` : t`Check fit`);

	if (saved.isPending) return <Skeleton variant="none" className="h-72 rounded-2xl" />;

	const check = () => void generate.run({ task: "fit" }).catch(() => undefined);

	if (!item)
		return (
			<FirstRun
				title={t`Check this role against your evidence`}
				description={t`Each requirement in the posting is checked against the facts and stories in your Profile. Gaps show as missing evidence, never missing ability.`}
			>
				<AiNotice centered />
				{provider ? (
					<ActionButton
						variant="primary"
						size="md"
						icon="list-checks"
						label={checkLabel}
						busy={generate.isPending}
						onPress={check}
						testID="fit-check"
					/>
				) : null}
			</FirstRun>
		);

	const evidence = readOnly ? {} : workspace.data.evidence;
	const factText = (id: string) => facts.data?.find((fact) => fact.id === id)?.text;
	// A requirement closed with "Add evidence" counts as supported while its fact exists.
	const added = (requirement: Requirement) => {
		const id = evidence[requirement.text];
		return id && facts.data?.some((fact) => fact.id === id) ? id : undefined;
	};
	const statusOf = (requirement: Requirement): EvidenceStatus => (added(requirement) ? "added" : requirement.status);
	const statuses = item.data.requirements.map(statusOf);
	const supported = statuses.filter((status) => status === "supported" || status === "added").length;
	const partial = statuses.filter((status) => status === "partial").length;
	const missing = statuses.filter((status) => status === "missing").length;

	const evidenceNow = () => workspace.current().evidence;
	const onSaved = (requirement: Requirement, factId: string) => {
		// Called after the fact saves, so the evidence is read fresh rather than from this render.
		void workspace.save({ evidence: { ...evidenceNow(), [requirement.text]: factId } });
		void queryClient.invalidateQueries({ queryKey: orpc.career.facts.key() });
		// The fact is already saved, so Undo forgets it and reopens the gap.
		showToast({
			title: t`Saved to your Profile as a fact`,
			variant: "success",
			undo: {
				label: t`Undo`,
				onUndo: () => {
					const { [requirement.text]: _removed, ...rest } = evidenceNow();
					void workspace.save({ evidence: rest });
					forget.mutate(
						{ id: factId },
						{ onSettled: () => void queryClient.invalidateQueries({ queryKey: orpc.career.facts.key() }) },
					);
				},
			},
		});
	};

	return (
		<View className="gap-4">
			<View className="gap-1">
				<Typography.Heading type="h4">{item.data.headline}</Typography.Heading>
				<Typography type="body-sm" color="muted">
					{item.data.summary}
				</Typography>
				<Text mono tone="muted">{t`${supported} supported · ${partial} partly · ${missing} missing`}</Text>
			</View>
			{item.outdated && !readOnly ? (
				<View className="gap-2">
					<Typography type="body-xs" color="muted">
						{t`Your Profile or the posting changed since this check. Checking again uses AI again.`}
					</Typography>
					{provider ? <ActionButton label={checkLabel} busy={generate.isPending} onPress={check} /> : null}
					<AiNotice />
				</View>
			) : null}

			<View accessibilityLabel={t`Requirements and your evidence`} className="gap-3">
				{item.data.requirements.map((requirement) => {
					const factId = added(requirement);
					return (
						<RequirementCard
							key={requirement.text}
							requirement={requirement}
							status={statusOf(requirement)}
							evidence={factId ? (factText(factId) ?? requirement.evidence) : requirement.evidence}
							readOnly={readOnly}
							onSaved={(id) => onSaved(requirement, id)}
						/>
					);
				})}
			</View>

			{item.data.checks.length > 0 ? (
				<Block title={t`Against your requirements`}>
					{item.data.checks.map((entry) => (
						<CheckLine key={entry.label} met={entry.met} label={entry.label} text={entry.text} />
					))}
				</Block>
			) : null}
			{item.data.ask ? <WorthAsking ask={item.data.ask} applicationId={application.id} readOnly={readOnly} /> : null}
			{readOnly ? null : <AiNotice report={`${item.data.headline}\n${item.data.summary}`} />}
		</View>
	);
}
