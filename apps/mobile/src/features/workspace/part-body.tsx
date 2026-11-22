// The part under the tab row: its loading and failure states, the read-only banner for a saved version, and the part.
import type { WorkspacePartProps } from "./part";
import type { useSavedItems, Workspace } from "./queries";
import type { WorkspaceTab } from "@rezumi/schema/career";
import type { ComponentType } from "react";
import { useLingui } from "@lingui/react/macro";
import { View } from "react-native";
import { ApplyPart } from "./apply/apply-part";
import { NextStepLine } from "./bar";
import { Notice } from "./blocks";
import { DebriefPart } from "./debrief/debrief-part";
import { FitPart } from "./fit/fit-part";
import { MessagesPart } from "./messages/messages-part";
import { archiveKinds } from "./part";
import { PracticePart } from "./practice/practice-part";
import { PreparePart } from "./prepare/prepare-part";
import { SavedPart } from "./saved/saved-part";
import { Button, Screen, Spinner, Text } from "@/ui";

const PARTS: Record<WorkspaceTab, ComponentType<WorkspacePartProps>> = {
	fit: FitPart,
	apply: ApplyPart,
	prepare: PreparePart,
	practise: PracticePart,
	debrief: DebriefPart,
	messages: MessagesPart,
	saved: SavedPart,
};

type PartBodyProps = {
	tab: WorkspaceTab;
	props: WorkspacePartProps;
	saved: ReturnType<typeof useSavedItems>;
	workspace: Workspace;
	/** `?version=` was asked for, even if that saved item is gone. */
	archived: boolean;
	showNextStep: boolean;
	backToCurrent: () => void;
};

export function PartBody({ tab, props, saved, workspace, archived, showNextStep, backToCurrent }: PartBodyProps) {
	const { t } = useLingui();
	const { version } = props;
	const live = !archived && tab !== "saved";
	const unavailable = archived && (!version || version.data.kind !== archiveKinds[tab]);
	const waiting = saved.isPending || (live && workspace.isPending);
	const failed =
		(saved.isError && saved.data === undefined) ||
		(live && workspace.query.isError && workspace.query.data === undefined);
	const Part = PARTS[tab];
	const retry = () => {
		void saved.refetch();
		if (!archived) void workspace.query.refetch();
	};

	return (
		<Screen onRefresh={() => Promise.all([saved.refetch(), workspace.query.refetch()])}>
			{showNextStep && !archived ? <NextStepLine application={props.application} now={props.now} /> : null}
			{waiting ? (
				<View
					accessibilityRole="progressbar"
					className="flex-row items-center gap-2 rounded-2xl bg-surface-secondary p-5"
				>
					<Spinner size="sm" />
					<Text tone="muted">{archived ? t`Loading saved version…` : t`Loading workspace…`}</Text>
				</View>
			) : failed || unavailable ? (
				<View className="gap-3">
					<Notice
						status="danger"
						message={
							failed
								? archived
									? t`This saved version couldn't be loaded.`
									: t`This workspace couldn't be loaded.`
								: version
									? t`This saved version belongs to a different part. Open it from Saved.`
									: t`This saved version is no longer available.`
						}
						{...(failed ? { action: { label: t`Try again`, onPress: retry } } : {})}
					/>
					{archived ? (
						<Button size="sm" variant="secondary" className="self-start" onPress={backToCurrent}>
							<Button.Label>{t`Back to current`}</Button.Label>
						</Button>
					) : null}
				</View>
			) : (
				<>
					{version ? (
						<Notice
							status="default"
							icon="clock-counter-clockwise"
							message={t`You're looking at a saved version. It can't be edited.`}
							action={{ label: t`Back to current`, onPress: backToCurrent }}
							testID="workspace-saved-version"
						/>
					) : null}
					<Part {...props} />
				</>
			)}
		</Screen>
	);
}
