// The builder's Check pane (plans/mobile Phase 07 step 7; web: resume/editor/check/check-panel.tsx): the score over
// the live checks, then Issues (numbered cards pinned to the page), Job match and Writing. The checks themselves are
// `@rezumi/resume/check`, shared with the web.
import type { PageLens } from "./check-page";
import type { CheckIssue } from "./messages";
import { useLingui } from "@lingui/react/macro";
import { useNetworkState } from "expo-network";
import { useMemo, useState } from "react";
import { View } from "react-native";
import { useCheckActions } from "./actions";
import { CheckPageSheet } from "./check-page";
import { IssuesTab } from "./issues-tab";
import { JobMatchTab } from "./job-match";
import { ScoreCard } from "./score-card";
import { useCheck, useCheckDraft } from "./use-check";
import { useWritingReview } from "./use-writing-review";
import { WritingTab } from "./writing-tab";
import { useResumeStore } from "@/draft";
import { useBuilderChrome } from "@/shell/builder-chrome";
import { Alert, EmptyState, Screen, Segment, Skeleton } from "@/ui";

type CheckTab = "issues" | "match" | "writing";
type CheckPaneProps = { id: string };

export function CheckPane({ id }: CheckPaneProps) {
	const { t } = useLingui();
	const draft = useCheckDraft(id);
	const check = useCheck(draft.data);
	const network = useNetworkState();
	const offline = draft.status === "offline" || network.isConnected === false || network.isInternetReachable === false;
	const open = check?.issues.length ?? 0;
	useBuilderChrome(useMemo(() => ({ badges: { check: open } }), [open]));

	if (!check && draft.status === "error")
		return (
			<Screen testID="check-error">
				<EmptyState
					kind="page"
					icon="warning-circle"
					title={t`Couldn't open this resume`}
					description={t`Check your connection and try again.`}
					action={{
						label: t`Retry`,
						onPress: () =>
							void useResumeStore
								.getState()
								.open(id)
								.catch(() => {}),
					}}
				/>
			</Screen>
		);
	if (!check) return <CheckSkeleton />;

	return (
		<Screen testID="check-pane">
			{offline ? (
				<Notice
					status="accent"
					message={t`You're offline. Issues and Job match still work; reconnect for Writing and PDF checks.`}
				/>
			) : null}
			{draft.locked ? (
				<Notice status="warning" message={t`This resume is locked. Checks are available; editing is disabled.`} />
			) : null}
			<CheckBody id={id} check={check} locked={draft.locked} offline={offline} applicationId={draft.applicationId} />
		</Screen>
	);
}

type CheckBodyProps = {
	id: string;
	check: NonNullable<ReturnType<typeof useCheck>>;
	locked: boolean;
	offline: boolean;
	applicationId: string | null;
};

function CheckBody({ id, check, locked, offline, applicationId }: CheckBodyProps) {
	const { t } = useLingui();
	const actions = useCheckActions(id);
	const writing = useWritingReview(check.data, check.issues);
	const [tab, setTab] = useState<CheckTab>("issues");
	const [selected, setSelected] = useState<string | null>(null);
	const [page, setPage] = useState<PageLens | null>(null);
	const [highlightTerm, setHighlightTerm] = useState<string | null>(null);
	const [pasted, setPasted] = useState("");

	const showOnPage = (issue: CheckIssue) => {
		setSelected(issue.key);
		setPage("person");
	};
	const fix = (issue: CheckIssue) => {
		actions.fix(issue);
		// Writing opens on top; one-step fixes keep the page open on the next issue.
		if (issue.fix.kind === "write") setPage(null);
		else setSelected(null);
	};

	return (
		<View className="gap-4">
			<ScoreCard report={check.report} />
			<Segment
				accessibilityLabel={t`Check views`}
				value={tab}
				onValueChange={setTab}
				options={[
					{ value: "issues", label: `${t`Issues`} ${check.issues.length}` },
					{ value: "match", label: t`Job match` },
					{ value: "writing", label: t`Writing` },
				]}
			/>
			{tab === "match" ? (
				<JobMatchTab
					id={id}
					data={check.data}
					applicationId={applicationId}
					locked={locked}
					offline={offline}
					pasted={pasted}
					onPaste={setPasted}
					highlightTerm={highlightTerm}
					onHighlight={(term) => {
						setHighlightTerm(term);
						if (term) {
							setSelected(null);
							setPage("person");
						}
					}}
				/>
			) : tab === "writing" ? (
				<WritingTab id={id} data={check.data} locked={locked} offline={offline} writing={writing} />
			) : (
				<IssuesTab
					check={check}
					selected={selected}
					locked={locked}
					onFix={fix}
					onShowOnPage={showOnPage}
					onIgnore={actions.ignore}
					onRestoreIgnored={actions.restoreIgnored}
					onCheckPdf={() => {
						setSelected(null);
						setPage("parser");
					}}
				/>
			)}
			<CheckPageSheet
				isOpen={page !== null}
				onOpenChange={(open) => (open ? undefined : setPage(null))}
				check={check}
				lens={page ?? "person"}
				onLensChange={setPage}
				selected={selected}
				onSelect={setSelected}
				highlightTerm={tab === "match" ? highlightTerm : null}
				locked={locked}
				offline={offline}
				onFix={fix}
			/>
		</View>
	);
}

type NoticeProps = { status: "accent" | "warning"; message: string };

function Notice({ status, message }: NoticeProps) {
	return (
		<Alert status={status}>
			<Alert.Indicator />
			<Alert.Content>
				<Alert.Description>{message}</Alert.Description>
			</Alert.Content>
		</Alert>
	);
}

/** Loading, in the shape of the score card, the segment and two issue cards. */
function CheckSkeleton() {
	const { t } = useLingui();
	return (
		<Screen testID="check-loading">
			<View className="gap-4" accessibilityLabel={t`Loading`}>
				<Skeleton variant="none" className="h-28 w-full rounded-2xl" />
				<Skeleton variant="none" className="h-11 w-full rounded-full" />
				<Skeleton variant="none" className="h-36 w-full rounded-2xl" />
				<Skeleton variant="none" className="h-36 w-full rounded-2xl" />
			</View>
		</Screen>
	);
}
