// The top of an application's detail (the web's detail sheet header): role, company and place, the Posting closed
// marker with its date, View posting, and the options menu (Edit details, Delete); then the stage: the stepper, how
// long it has been there, Move to the next stage (Mark as applied from Saved), Close with a reason, or Reopen.
import type { Application } from "../types";
import type { ApplicationStatus } from "@rezumi/schema/applications/data";
import { plural } from "@lingui/core/macro";
import { useLingui } from "@lingui/react/macro";
import { Pressable, View } from "react-native";
import { PIPELINE, daysInStage, getNextStage } from "@rezumi/career/applications";
import { useNow, useUserTime } from "../date";
import { getClosedReasonLabel, getStageLabel } from "../stages";
import { Button, Icon, IconButton, Menu, StageLabel, Text, Typography, cx } from "@/ui";

type DetailHeaderProps = {
	application: Application;
	/** The pane shows the role itself; the sheet has it in its title row. */
	showTitle: boolean;
	onViewPosting: (() => void) | null;
	onEdit: () => void;
	onDelete: () => void;
};

export function DetailHeader({ application, showTitle, onViewPosting, onEdit, onDelete }: DetailHeaderProps) {
	const { t } = useLingui();
	const { date } = useUserTime();
	const where = [application.company, application.location].filter(Boolean).join(" · ");
	return (
		<View className="flex-row items-start gap-2">
			<View className="min-w-0 flex-1 gap-1">
				{showTitle ? (
					<Typography.Heading type="h4" accessibilityRole="header">
						{application.role}
					</Typography.Heading>
				) : null}
				<Text tone="muted">{where}</Text>
				{application.postingClosedAt ? (
					<View className="flex-row items-center gap-1.5" testID="posting-closed">
						<Icon name="warning-circle" size={16} tone="warning" />
						<Text size="sm" weight="medium" tone="warning">
							{t({
								message: `Posting closed ${date(application.postingClosedAt)}`,
								comment: "The employer took down the job posting of this application, on that date",
							})}
						</Text>
					</View>
				) : null}
				{onViewPosting ? (
					<Button size="sm" variant="ghost" className="self-start px-0" onPress={onViewPosting}>
						<Button.Label>{t`View posting`}</Button.Label>
					</Button>
				) : null}
			</View>
			<Menu>
				<Menu.Trigger asChild>
					<IconButton icon="dots-three" label={t`Application options`} testID="detail-options" />
				</Menu.Trigger>
				<Menu.Portal>
					<Menu.Overlay />
					<Menu.Content presentation="popover" width={220}>
						<Menu.Item id="edit" onPress={onEdit}>
							<Icon name="pencil-simple" size={16} />
							<Menu.ItemTitle>{t`Edit details…`}</Menu.ItemTitle>
						</Menu.Item>
						<Menu.Item id="delete" variant="danger" onPress={onDelete}>
							<Icon name="trash" size={16} tone="danger" />
							<Menu.ItemTitle>{t`Delete…`}</Menu.ItemTitle>
						</Menu.Item>
					</Menu.Content>
				</Menu.Portal>
			</Menu>
		</View>
	);
}

type StageSectionProps = {
	application: Application;
	onMove: (status: ApplicationStatus) => void;
	onMarkApplied: () => void;
	onClose: () => void;
};

/** Where it stands: the stepper (each stage can be tapped), how long, and the next move. */
export function StageSection({ application, onMove, onMarkApplied, onClose }: StageSectionProps) {
	const { t } = useLingui();
	const now = useNow();
	const status = application.status;
	const closed = status === "closed";
	const next = getNextStage(status);
	const reached = PIPELINE.indexOf(status);
	const days = daysInStage(application, now);
	const pick = (stage: ApplicationStatus) => {
		if (stage === status) return;
		if (status === "saved" && stage === "applied") onMarkApplied();
		else onMove(stage);
	};
	return (
		<View className="gap-3">
			<View className="flex-row gap-1" accessibilityLabel={t`Stages`}>
				{PIPELINE.map((stage, index) => (
					<Pressable
						key={stage}
						accessibilityRole="button"
						accessibilityLabel={
							stage === status ? t`${getStageLabel(stage)}, current stage` : t`Move to ${getStageLabel(stage)}`
						}
						accessibilityState={{ selected: stage === status, disabled: closed }}
						disabled={closed}
						onPress={() => pick(stage)}
						className="min-h-11 flex-1 justify-center gap-1 active:opacity-70"
						testID={`stepper-${stage}`}
					>
						<View className={cx("h-1.5 rounded-full", !closed && index <= reached ? "bg-accent" : "bg-default")} />
						<Text size="xs" tone={stage === status ? "default" : "muted"} numberOfLines={1}>
							{getStageLabel(stage)}
						</Text>
					</Pressable>
				))}
			</View>
			<View className="flex-row flex-wrap items-center gap-2">
				<StageLabel stage={status} label={getStageLabel(status)} />
				<Text tone="muted" className="flex-1">
					{closed
						? application.closedReason
							? `· ${getClosedReasonLabel(application.closedReason)}`
							: ""
						: plural(days, { 0: "· since today", one: "· for # day", other: "· for # days" })}
				</Text>
			</View>
			<View className="flex-row flex-wrap gap-2">
				{closed ? (
					<Button size="sm" variant="secondary" onPress={() => onMove("applied")} testID="detail-reopen">
						<Icon name="arrow-counter-clockwise" size={16} />
						<Button.Label>{t`Reopen`}</Button.Label>
					</Button>
				) : (
					<>
						{next ? (
							<Button
								size="sm"
								variant="secondary"
								onPress={() => (status === "saved" ? onMarkApplied() : onMove(next))}
								testID="detail-next-stage"
							>
								<Button.Label>
									{status === "saved" ? t`Mark as applied` : t`Move to ${getStageLabel(next)}`}
								</Button.Label>
								<Icon name="arrow-right" size={16} />
							</Button>
						) : null}
						<Button size="sm" variant="ghost" onPress={onClose} testID="detail-close">
							<Icon name="prohibit" size={16} />
							<Button.Label>{t`Close…`}</Button.Label>
						</Button>
					</>
				)}
			</View>
		</View>
	);
}
