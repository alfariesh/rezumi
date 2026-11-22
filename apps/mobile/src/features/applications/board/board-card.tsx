// One application on the Board: role, company, the next step and a Posting closed marker. Tap opens it; a long press
// lifts it to drag (the column wraps it in the drag gesture). Its menu and screen-reader actions move it without
// dragging: to the previous or next stage, or any stage.
import type { ApplicationSummary } from "@/features/applications/types";
import type { ApplicationStatus } from "@rezumi/schema/applications/data";
import { useLingui } from "@lingui/react/macro";
import { Pressable, View } from "react-native";
import { PIPELINE } from "@rezumi/career/applications";
import { useUserTime } from "@/features/applications/date";
import { describeNextStep, getNextStep } from "@/features/applications/next-step";
import { getStageLabel } from "@/features/applications/stages";
import { Card, Chip, Icon, IconButton, Menu, Text, cx } from "@/ui";

export const BOARD_STAGES: readonly ApplicationStatus[] = [...PIPELINE, "closed"];

/** When the posting closed, where the list row carries it (the summary may not). */
const postingClosedAt = (application: ApplicationSummary) =>
	(application as { postingClosedAt?: Date | string | null }).postingClosedAt ??
	application.initialDetail?.postingClosedAt ??
	null;

export type BoardCardProps = {
	application: ApplicationSummary;
	stage: ApplicationStatus;
	onOpen: () => void;
	onMove: (to: ApplicationStatus) => void;
	/** The lifted copy under the finger: no menu, not pressable. */
	preview?: boolean | undefined;
};

export function BoardCard({ application, stage, onOpen, onMove, preview = false }: BoardCardProps) {
	const { t } = useLingui();
	const { timeZone, locale } = useUserTime();
	const next = describeNextStep(getNextStep(application), application, locale, timeZone);
	const index = BOARD_STAGES.indexOf(stage);
	const previous = index > 0 ? BOARD_STAGES[index - 1] : undefined;
	const following = BOARD_STAGES[index + 1];
	const others = BOARD_STAGES.filter((item) => item !== stage);
	const moveLabel = (to: ApplicationStatus) => (to === "closed" ? t`Close…` : t`Move to ${getStageLabel(to)}`);
	const actions = [
		...(previous ? [{ name: "previous", label: moveLabel(previous) }] : []),
		...(following ? [{ name: "next", label: moveLabel(following) }] : []),
		...others
			.filter((to) => to !== previous && to !== following)
			.map((to) => ({ name: `move:${to}`, label: moveLabel(to) })),
	];
	const closedAt = postingClosedAt(application);

	return (
		<Card className={cx("gap-0 p-0", preview && "shadow-overlay")} testID={`board-card-${application.id}`}>
			<View className="flex-row items-start">
				<Pressable
					onPress={onOpen}
					disabled={preview}
					accessibilityRole="button"
					accessibilityLabel={`${application.role}, ${application.company}. ${next.title}`}
					accessibilityHint={t`Opens the application. Actions move it to another stage.`}
					accessibilityActions={preview ? undefined : actions}
					onAccessibilityAction={({ nativeEvent }) => {
						const name = nativeEvent.actionName;
						if (name === "previous" && previous) onMove(previous);
						else if (name === "next" && following) onMove(following);
						else if (name.startsWith("move:")) onMove(name.slice(5) as ApplicationStatus);
					}}
					className="flex-1 gap-1 py-3 ps-3"
				>
					<Text weight="semibold" numberOfLines={2}>
						{application.role}
					</Text>
					<Text size="xs" tone="muted" numberOfLines={1}>
						{application.location ? `${application.company} · ${application.location}` : application.company}
					</Text>
					<View className="flex-row items-center gap-1.5 pt-1">
						<Icon name={next.icon} size={14} tone={next.tone === "warn" ? "warning" : "muted"} />
						<Text size="xs" tone={next.tone === "warn" ? "warning" : "muted"} numberOfLines={2} className="flex-1">
							{next.sub ? `${next.title} · ${next.sub}` : next.title}
						</Text>
					</View>
					{closedAt ? (
						<Chip size="sm" variant="soft" color="warning" className="mt-1 self-start">
							<Chip.Label>{t`Posting closed`}</Chip.Label>
						</Chip>
					) : null}
				</Pressable>
				{preview ? null : (
					<Menu>
						<Menu.Trigger asChild>
							<IconButton icon="dots-three" size="sm" label={t`Move ${application.role}`} className="m-1" />
						</Menu.Trigger>
						<Menu.Portal>
							<Menu.Overlay />
							<Menu.Content presentation="popover" width={220} testID={`board-menu-${application.id}`}>
								{others.map((to) => (
									<Menu.Item key={to} onPress={() => onMove(to)} testID={`board-move-${application.id}-${to}`}>
										<Menu.ItemTitle>{moveLabel(to)}</Menu.ItemTitle>
									</Menu.Item>
								))}
							</Menu.Content>
						</Menu.Portal>
					</Menu>
				)}
			</View>
		</Card>
	);
}
