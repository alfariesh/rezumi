// An application's menu, opened from its ⋯ button or a swipe's Close, as a sheet: Open, Open workspace, Move to…,
// Close… (with a reason) or Reopen, Select, then Delete…. Move to and Close open as a step inside the same sheet.
// Every swipe action is here too.
import type { ApplicationSummary } from "../types";
import type { IconName } from "@/ui";
import type { ApplicationClosedReason, ApplicationStatus } from "@rezumi/schema/applications/data";
import { useLingui } from "@lingui/react/macro";
import { useState } from "react";
import { View } from "react-native";
import { ReasonChoices, StageChoices } from "./choices";
import { ListRow, ListSection, Sheet } from "@/ui";

export type RowMenuStep = "menu" | "move" | "close";
export type RowMenuTarget = { application: ApplicationSummary; step: RowMenuStep };

type RowMenuProps = {
	target: RowMenuTarget | null;
	onDismiss: () => void;
	onOpen: (application: ApplicationSummary) => void;
	onWorkspace: (application: ApplicationSummary) => void;
	onMove: (application: ApplicationSummary, status: ApplicationStatus) => void;
	onCloseWith: (application: ApplicationSummary, reason: ApplicationClosedReason) => void;
	onSelect: (application: ApplicationSummary) => void;
	onDelete: (application: ApplicationSummary) => void;
};

type Entry = { key: string; icon: IconName; label: string; onPress: () => void; danger?: boolean; step?: boolean };

export function RowMenu({ target, onDismiss, ...actions }: RowMenuProps) {
	const { t } = useLingui();
	const [shown, setShown] = useState(target);
	const [requested, setRequested] = useState(target);
	const [step, setStep] = useState<RowMenuStep>(target?.step ?? "menu");
	// The sheet keeps the last application while it slides away, and opens on the step it was asked for.
	if (target !== requested) {
		setRequested(target);
		if (target) {
			setShown(target);
			setStep(target.step);
		}
	}
	// What opens another screen or dialog waits until the sheet has gone: iOS drops a presentation made over it.
	const [after, setAfter] = useState<(() => void) | null>(null);
	const thenClose = (run: () => void) => () => {
		setAfter(() => run);
		onDismiss();
	};
	const now = (run: () => void) => () => {
		run();
		onDismiss();
	};
	const application = shown?.application;
	const closed = application?.status === "closed";
	const entries = (item: ApplicationSummary): Entry[] => [
		{ key: "open", icon: "arrow-square-out", label: t`Open`, onPress: thenClose(() => actions.onOpen(item)) },
		{
			key: "workspace",
			icon: "briefcase",
			label: t`Open workspace`,
			onPress: thenClose(() => actions.onWorkspace(item)),
		},
		{ key: "move", icon: "arrow-right", label: t`Move to…`, step: true, onPress: () => setStep("move") },
		closed
			? {
					key: "reopen",
					icon: "arrow-counter-clockwise",
					label: t`Reopen`,
					onPress: now(() => actions.onMove(item, "applied")),
				}
			: { key: "close", icon: "prohibit", label: t`Close…`, step: true, onPress: () => setStep("close") },
		{ key: "select", icon: "check-square", label: t`Select`, onPress: now(() => actions.onSelect(item)) },
		{ key: "delete", icon: "trash", label: t`Delete…`, danger: true, onPress: thenClose(() => actions.onDelete(item)) },
	];
	const list = application ? entries(application) : [];
	const titles: Record<RowMenuStep, string> = {
		menu: application ? `${application.role} · ${application.company}` : "",
		move: t`Move to…`,
		close: t`Close this application`,
	};

	return (
		<Sheet
			isOpen={target !== null}
			onOpenChange={(open) => !open && onDismiss()}
			title={titles[step]}
			closeLabel={t`Close`}
			onDidDismiss={() => {
				const run = after;
				setAfter(null);
				run?.();
			}}
			testID="application-menu"
		>
			{application && step === "menu" ? (
				<View className="gap-4">
					<ListSection>
						{list
							.filter((entry) => !entry.danger)
							.map((entry) => (
								<ListRow
									key={entry.key}
									icon={entry.icon}
									title={entry.label}
									chevron={entry.step ?? false}
									onPress={entry.onPress}
									testID={`application-menu-${entry.key}`}
								/>
							))}
					</ListSection>
					<ListSection>
						{list
							.filter((entry) => entry.danger)
							.map((entry) => (
								<ListRow
									key={entry.key}
									icon={entry.icon}
									title={entry.label}
									tone="danger"
									onPress={entry.onPress}
									testID={`application-menu-${entry.key}`}
								/>
							))}
					</ListSection>
				</View>
			) : null}
			{application && step === "move" ? (
				<StageChoices
					current={application.status}
					onPick={(status) => now(() => actions.onMove(application, status))()}
				/>
			) : null}
			{application && step === "close" ? (
				<ReasonChoices onPick={(reason) => now(() => actions.onCloseWith(application, reason))()} />
			) : null}
		</Sheet>
	);
}
