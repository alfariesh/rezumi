// One stage's column: its name with the stage dot and count, then its cards (50 at a time). A dragged card hovering
// over the column highlights it. Empty columns say what belongs there.
import type { DragHandlers } from "./use-board-drag";
import type { ApplicationSummary } from "@/features/applications/types";
import type { ApplicationStatus } from "@rezumi/schema/applications/data";
import { plural } from "@lingui/core/macro";
import { useLingui } from "@lingui/react/macro";
import { useState } from "react";
import { RefreshControl, ScrollView, View } from "react-native";
import { DraggableCard } from "./draggable-card";
import { getStageLabel } from "@/features/applications/stages";
import { Button, EmptyState, StageLabel, Text, cx, usePullRefresh, useThemeColor } from "@/ui";

const PAGE_SIZE = 50;

type BoardColumnProps = {
	stage: ApplicationStatus;
	applications: readonly ApplicationSummary[];
	/** Card width in points (the column less its padding). */
	cardWidth: number;
	/** A dragged card is over this column and would move here. */
	highlighted: boolean;
	draggingId: string | null;
	handlers: DragHandlers;
	/** Phones show the stage in the pager above, so the column leaves its own header out. */
	header: boolean;
	onOpen: (application: ApplicationSummary) => void;
	onMove: (application: ApplicationSummary, to: ApplicationStatus) => void;
	onRefresh: () => Promise<unknown>;
	className?: string | undefined;
};

export function BoardColumn(props: BoardColumnProps) {
	const { stage, applications, cardWidth, highlighted, draggingId, handlers, header, onOpen, onMove } = props;
	const { t } = useLingui();
	const accent = useThemeColor("accent");
	const pull = usePullRefresh(props.onRefresh);
	const [visible, setVisible] = useState(PAGE_SIZE);
	const remaining = applications.length - visible;
	const label = getStageLabel(stage);
	return (
		<View
			className={cx(
				"rounded-3xl border bg-surface-secondary",
				highlighted ? "border-accent bg-accent-soft" : "border-transparent",
				props.className,
			)}
			testID={`board-column-${stage}`}
		>
			{header ? (
				<View
					accessible
					accessibilityRole="header"
					accessibilityLabel={plural(applications.length, {
						one: `${label}, # application`,
						other: `${label}, # applications`,
					})}
					className="flex-row items-center gap-2 px-4 pt-4 pb-1"
				>
					<StageLabel stage={stage} label={label} className="flex-1" />
					<Text size="xs" tone="muted" tabular>
						{applications.length}
					</Text>
				</View>
			) : null}
			<ScrollView
				alwaysBounceVertical
				refreshControl={<RefreshControl {...pull} tintColor={accent} colors={[accent]} />}
				contentContainerClassName="gap-3 p-3"
			>
				{applications.length === 0 ? (
					<EmptyState
						kind="inline"
						title={t`Nothing in ${label}`}
						description={
							stage === "closed"
								? t`Drop a card here, or use its menu, to close it with a reason.`
								: t`Drag a card here, or use its menu to move it.`
						}
					/>
				) : null}
				{applications.slice(0, visible).map((application) => (
					<DraggableCard
						key={application.id}
						application={application}
						stage={stage}
						width={cardWidth}
						dragging={application.id === draggingId}
						handlers={handlers}
						onOpen={() => onOpen(application)}
						onMove={(to) => onMove(application, to)}
					/>
				))}
				{remaining > 0 ? (
					<Button variant="ghost" size="sm" onPress={() => setVisible((count) => count + PAGE_SIZE)}>
						<Button.Label>{t`Show ${Math.min(remaining, PAGE_SIZE)} more`}</Button.Label>
					</Button>
				) : null}
			</ScrollView>
		</View>
	);
}
