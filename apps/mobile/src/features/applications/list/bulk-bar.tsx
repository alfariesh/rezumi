// Select mode (a long press on a row): how many are picked, Select all, Done, and Move to…, Close… and Delete… for
// all of them at once. A move or close has Undo; Delete asks first (it can't be undone).
import type { ApplicationSummary } from "../types";
import type { ApplicationClosedReason, ApplicationStatus } from "@rezumi/schema/applications/data";
import { plural } from "@lingui/core/macro";
import { useLingui } from "@lingui/react/macro";
import { useState } from "react";
import { View } from "react-native";
import { ReasonChoices, StageChoices } from "./choices";
import { BULK_LIMIT } from "./use-list-state";
import { Alert, Button, ConfirmDialog, Icon, IconButton, Sheet, Text } from "@/ui";

type BulkBarProps = {
	selected: readonly ApplicationSummary[];
	busy: boolean;
	onSelectAll: () => void;
	onDone: () => void;
	onMove: (rows: readonly ApplicationSummary[], status: ApplicationStatus) => void;
	onClose: (rows: readonly ApplicationSummary[], reason: ApplicationClosedReason) => void;
	onDelete: (rows: readonly ApplicationSummary[]) => void;
};

export function BulkBar({ selected, busy, onSelectAll, onDone, onMove, onClose, onDelete }: BulkBarProps) {
	const { t } = useLingui();
	const [sheet, setSheet] = useState<"move" | "close" | null>(null);
	const [confirming, setConfirming] = useState(false);
	const count = selected.length;
	const tooMany = count > BULK_LIMIT;
	const disabled = busy || count === 0 || tooMany;

	return (
		<View className="gap-2 rounded-2xl bg-surface p-3" accessibilityLabel={t`Selection`} testID="bulk-bar">
			<View className="flex-row items-center gap-2">
				<IconButton icon="x" label={t`Done selecting`} onPress={onDone} testID="bulk-done" />
				<Text weight="semibold" className="flex-1" accessibilityLiveRegion="polite">
					{plural(count, { one: "# selected", other: "# selected" })}
				</Text>
				<Button size="sm" variant="ghost" onPress={onSelectAll}>
					<Button.Label>{t`Select all`}</Button.Label>
				</Button>
			</View>
			<View className="flex-row flex-wrap gap-2">
				<Button size="sm" variant="secondary" isDisabled={disabled} onPress={() => setSheet("move")} testID="bulk-move">
					<Icon name="arrow-right" size={16} />
					<Button.Label>{t`Move to…`}</Button.Label>
				</Button>
				<Button
					size="sm"
					variant="secondary"
					isDisabled={disabled}
					onPress={() => setSheet("close")}
					testID="bulk-close"
				>
					<Icon name="prohibit" size={16} />
					<Button.Label>{t`Close…`}</Button.Label>
				</Button>
				<Button
					size="sm"
					variant="danger-soft"
					isDisabled={disabled}
					onPress={() => setConfirming(true)}
					testID="bulk-delete"
				>
					<Icon name="trash" size={16} tone="danger" />
					<Button.Label>{t`Delete…`}</Button.Label>
				</Button>
			</View>
			{tooMany ? (
				<Alert status="warning">
					<Alert.Content>
						<Alert.Title>{t`Choose up to ${BULK_LIMIT} applications at a time.`}</Alert.Title>
					</Alert.Content>
				</Alert>
			) : null}
			<Sheet
				isOpen={sheet !== null}
				onOpenChange={(open) => !open && setSheet(null)}
				title={
					sheet === "close"
						? plural(count, { one: "Close # application", other: "Close # applications" })
						: plural(count, { one: "Move # application to…", other: "Move # applications to…" })
				}
				closeLabel={t`Close`}
			>
				{sheet === "move" ? (
					<StageChoices
						current={null}
						onPick={(status) => {
							setSheet(null);
							onMove(selected, status);
						}}
					/>
				) : null}
				{sheet === "close" ? (
					<ReasonChoices
						onPick={(reason) => {
							setSheet(null);
							onClose(selected, reason);
						}}
					/>
				) : null}
			</Sheet>
			<ConfirmDialog
				isOpen={confirming}
				onOpenChange={setConfirming}
				title={plural(count, { one: "Delete # application?", other: "Delete # applications?" })}
				message={t`They're deleted with their timelines and files. This can't be undone.`}
				confirmLabel={plural(count, { one: "Delete # application", other: "Delete # applications" })}
				cancelLabel={t`Keep them`}
				destructive
				onConfirm={() => onDelete(selected)}
			/>
		</View>
	);
}
