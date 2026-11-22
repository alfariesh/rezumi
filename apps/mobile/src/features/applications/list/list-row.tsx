// One application in the List (the web's list-view row): role, company and place, the next step on the user's clock,
// tags and a Posting closed marker. A tap opens it, a long press starts selecting, ⋯ opens its menu, and a swipe
// uncovers Move to the next stage, Close and Delete (every one of them is in the menu too).
import type { ApplicationSummary } from "../types";
import type { SwipeAction } from "@/ui";
import type { ApplicationStatus } from "@rezumi/schema/applications/data";
import { plural } from "@lingui/core/macro";
import { useLingui } from "@lingui/react/macro";
import { memo } from "react";
import { Pressable, View } from "react-native";
import { getNextStage } from "@rezumi/career/applications";
import { describeNextStep, getNextStep } from "../next-step";
import { getStageLabel } from "../stages";
import { Icon, IconButton, StageDot, SwipeableRow, Text, cx, haptics } from "@/ui";

/**
 * When the employer took the posting down. The list's summary rows don't carry it yet (only their first details do),
 * so the marker shows where it's known.
 */
export const postingClosedAt = (application: ApplicationSummary): Date | string | null =>
	("postingClosedAt" in application ? (application.postingClosedAt as Date | string | null) : null) ??
	application.initialDetail?.postingClosedAt ??
	null;

export type RowHandlers = {
	onOpen: (application: ApplicationSummary) => void;
	onMenu: (application: ApplicationSummary) => void;
	onSelect: (application: ApplicationSummary) => void;
	onToggle: (application: ApplicationSummary) => void;
	onMove: (application: ApplicationSummary, status: ApplicationStatus) => void;
	onClose: (application: ApplicationSummary) => void;
	onDelete: (application: ApplicationSummary) => void;
};

type ApplicationRowProps = {
	application: ApplicationSummary;
	handlers: RowHandlers;
	selecting: boolean;
	selected: boolean;
	/** Open beside the list on tablets. */
	current: boolean;
	timeZone: string;
	now: Date;
};

export const ApplicationRow = memo(function ApplicationRow(props: ApplicationRowProps) {
	const { application, handlers, selecting, selected, current, timeZone, now } = props;
	const { t, i18n } = useLingui();
	const next = describeNextStep(getNextStep(application, now), application, i18n.locale, timeZone);
	const nextStage = getNextStage(application.status);
	const closed = application.status === "closed";
	const where = [application.company, application.location].filter(Boolean).join(" · ");
	const actions: SwipeAction[] = closed
		? [
				{
					key: "reopen",
					label: t`Reopen`,
					icon: "arrow-counter-clockwise",
					variant: "accent",
					onPress: () => handlers.onMove(application, "applied"),
				},
			]
		: [
				...(nextStage
					? [
							{
								key: "next",
								label: getStageLabel(nextStage),
								icon: "arrow-right",
								variant: "accent",
								onPress: () => handlers.onMove(application, nextStage),
							} satisfies SwipeAction,
						]
					: []),
				{ key: "close", label: t`Close`, icon: "prohibit", onPress: () => handlers.onClose(application) },
			];
	actions.push({
		key: "delete",
		label: t`Delete`,
		icon: "trash",
		variant: "danger",
		onPress: () => handlers.onDelete(application),
	});
	const label = [
		application.role,
		where,
		next.title,
		next.sub,
		postingClosedAt(application) ? t`Posting closed` : null,
		...application.tags,
	]
		.filter(Boolean)
		.join(", ");

	return (
		<SwipeableRow
			key={application.id}
			variant="inline"
			actions={actions}
			isDisabled={selecting}
			className="overflow-hidden rounded-2xl"
			openActionsLabel={t`Show actions`}
			closeActionsLabel={t`Hide actions`}
			testID={`application-row-${application.id}`}
		>
			<View className={cx("flex-row items-center bg-surface pe-1", (selected || current) && "bg-surface-secondary")}>
				<Pressable
					accessibilityRole={selecting ? "checkbox" : "button"}
					accessibilityState={selecting ? { checked: selected } : undefined}
					accessibilityLabel={label}
					accessibilityHint={
						selecting ? t`Selects or clears this application` : t`Opens the application. Long press to select.`
					}
					onPress={() => (selecting ? handlers.onToggle(application) : handlers.onOpen(application))}
					onLongPress={() => {
						haptics.light();
						handlers.onSelect(application);
					}}
					className="min-h-18 flex-1 flex-row items-start gap-3 py-3 ps-4"
					testID={`application-${application.id}`}
				>
					{selecting ? (
						<View className="pt-0.5">
							<Icon name={selected ? "check-square" : "square"} tone={selected ? "accent" : "muted"} />
						</View>
					) : null}
					<View className="min-w-0 flex-1 gap-0.5">
						<Text weight="medium" numberOfLines={1}>
							{application.role}
						</Text>
						<Text size="xs" tone="muted" numberOfLines={1}>
							{where}
						</Text>
						<View className="flex-row items-center gap-1.5 pt-0.5">
							<Icon name={next.icon} size={14} tone={next.tone === "warn" ? "warning" : "muted"} />
							<Text size="xs" tone={next.tone === "warn" ? "warning" : "muted"} numberOfLines={1} className="shrink">
								{next.sub ? `${next.title} · ${next.sub}` : next.title}
							</Text>
						</View>
						<RowMarks application={application} />
					</View>
				</Pressable>
				<IconButton
					icon="dots-three"
					label={t`Options for ${application.role} at ${application.company}`}
					isDisabled={selecting}
					onPress={() => handlers.onMenu(application)}
				/>
			</View>
		</SwipeableRow>
	);
});

type RowMarksProps = { application: ApplicationSummary };

/** Posting closed, then the tags (three, then "+2"). */
function RowMarks({ application }: RowMarksProps) {
	const { t } = useLingui();
	const shown = application.tags.slice(0, 3);
	const more = application.tags.length - shown.length;
	const closedAt = postingClosedAt(application);
	if (!closedAt && shown.length === 0) return null;
	return (
		<View className="flex-row flex-wrap items-center gap-x-2 gap-y-1 pt-1">
			{closedAt ? (
				<Text size="xs" weight="medium" tone="warning">
					{t({ message: "Posting closed", comment: "The employer took down the job posting of this application" })}
				</Text>
			) : null}
			{shown.map((tag) => (
				<Text key={tag} size="xs" tone="muted" numberOfLines={1}>
					{`#${tag}`}
				</Text>
			))}
			{more > 0 ? (
				<Text size="xs" tone="muted">
					{`+${more}`}
				</Text>
			) : null}
		</View>
	);
}

type GroupHeaderProps = {
	status: ApplicationStatus;
	count: number;
	collapsed: boolean;
	onToggle: (status: ApplicationStatus) => void;
};

/** A stage's group: its dot, name and count; a tap folds it away. */
export const GroupHeader = memo(function GroupHeader({ status, count, collapsed, onToggle }: GroupHeaderProps) {
	const label = getStageLabel(status);
	return (
		<Pressable
			accessibilityRole="button"
			accessibilityLabel={plural(count, { one: `${label}, # application`, other: `${label}, # applications` })}
			accessibilityState={{ expanded: !collapsed }}
			onPress={() => onToggle(status)}
			className="min-h-11 flex-row items-center gap-2 px-1 pt-4 pb-1"
			testID={`group-${status}`}
		>
			<StageDot stage={status} />
			<Text weight="semibold" className="flex-1">
				{label}
			</Text>
			<Text tone="muted" tabular>
				{count}
			</Text>
			<Icon name={collapsed ? "caret-right" : "caret-down"} size={16} tone="muted" />
		</Pressable>
	);
});
