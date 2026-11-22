// Each source on its own line while it's read: a spinner, then what it found, or why it failed with Retry when trying
// again can help. One source failing never holds up the others. Each line is a live region, so a screen reader hears
// each source finish.
import type { SourceId, SourceRun, SourceRuns } from "@rezumi/resume/profile-sources";
import { useLingui } from "@lingui/react/macro";
import { View } from "react-native";
import { canRetrySource, SOURCE_IDS } from "@rezumi/resume/profile-sources";
import {
	describeFindings,
	isDeclined,
	SOURCE_ICONS,
	sourceErrorMessage,
	sourceLabel,
	sourceNoteMessage,
} from "./messages";
import { Button, Icon, Spinner, Text, Typography } from "@/ui";

type SourceProgressProps = { runs: SourceRuns; onRetry: (id: SourceId) => void };

export function SourceProgress({ runs, onRetry }: SourceProgressProps) {
	const { t } = useLingui();
	const shown = SOURCE_IDS.flatMap((id) => {
		const run = runs[id];
		return run ? [{ id, run }] : [];
	});
	if (shown.length === 0) return null;

	return (
		<View className="gap-4" accessibilityLabel={t`Your sources`} testID="source-progress">
			{shown.map(({ id, run }) => (
				<View key={id} className="flex-row items-start gap-3">
					<View className="size-10 items-center justify-center rounded-lg bg-surface-secondary">
						<Icon name={SOURCE_ICONS[id]} tone="muted" />
					</View>
					<View className="min-w-0 flex-1 gap-0.5 pt-0.5">
						<View className="flex-row items-center gap-2">
							<Text weight="medium">{sourceLabel(id)}</Text>
							<RunIcon run={run} />
						</View>
						<RunStatus id={id} run={run} />
					</View>
					{run.status === "failed" && (canRetrySource(run.error) || isDeclined(run.error)) ? (
						<Button size="sm" variant="secondary" onPress={() => onRetry(id)} testID={`retry-${id}`}>
							<Button.Label>{t`Retry`}</Button.Label>
						</Button>
					) : null}
				</View>
			))}
		</View>
	);
}

function RunIcon({ run }: { run: SourceRun }) {
	if (run.status === "loading") return <Spinner size="sm" />;
	if (run.status === "done") return <Icon name="check-circle" size={18} tone="success" />;
	return <Icon name="warning-circle" size={18} tone="danger" />;
}

function RunStatus({ id, run }: { id: SourceId; run: SourceRun }) {
	const { t } = useLingui();
	if (run.status === "loading")
		return (
			<Typography type="body-sm" color="muted" accessibilityLiveRegion="polite">
				{id === "linkedin" ? t`Reading your profile…` : id === "file" ? t`Reading the file…` : t`Reading…`}
			</Typography>
		);
	if (run.status === "failed")
		return (
			<Typography type="body-sm" className="text-danger" accessibilityLiveRegion="polite">
				{sourceErrorMessage(id, run.error)}
			</Typography>
		);
	const notes = run.result.notes.flatMap((note) => sourceNoteMessage(note) ?? []);
	return (
		<View className="gap-0.5" accessibilityLiveRegion="polite">
			<Typography type="body-sm" color="muted">
				{describeFindings(run.result.data)}
			</Typography>
			{notes.map((note) => (
				<Typography key={note} type="body-xs" color="muted">
					{note}
				</Typography>
			))}
		</View>
	);
}
