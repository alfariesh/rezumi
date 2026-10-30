import type { ApplicationSummary } from "../types";
import type { ApplicationStatus } from "@rezumi/schema/applications/data";
import type { DropItem, DropTarget } from "react-aria-components";
import { Kanban, useKanbanCardPlaceholder } from "@heroui-pro/react";
import { Button, Modal } from "@heroui/react";
import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { useId, useRef, useState } from "react";
import { isTextDropItem, useDragAndDrop } from "react-aria-components";
import { CLOSED_REASONS, getClosedReasonLabel, getStageColor, getStageLabel, PIPELINE } from "../stages";
import { useApplicationActions } from "../use-application-actions";
import { ApplicationCard } from "./application-card";

type BoardProps = {
	applications: ApplicationSummary[];
	showClosed: boolean;
	onOpen: (application: ApplicationSummary) => void;
};

// Every column accepts this one type, carrying the dragged application's id.
const DRAG_TYPE = "application/x-rezumi-application-id";

/**
 * A column per stage (Closed only when shown). Dropping a card on a column moves it, with the same toast as the
 * other ways to change stage; dropping it on Closed asks for the reason first. Each card's menu has Move to… for the
 * keyboard, and its drag handle starts a keyboard drag. Ordering inside a column isn't stored. Desktop and tablet only.
 */
export function ApplicationBoard({ applications, showClosed, onOpen }: BoardProps) {
	const { moveTo, close } = useApplicationActions();
	const closeDescriptionId = useId();
	const [closing, setClosing] = useState<ApplicationSummary | null>(null);
	// The stage a drag started in, so that column refuses the drop (there's nothing to move).
	const dragSource = useRef<ApplicationStatus | null>(null);
	// The list query publishes the optimistic move a task after the drop (TanStack Query notifies on a timeout), so
	// until it does the board shows the dropped card in its new column itself. Otherwise the card blinks back to its
	// old column for a frame.
	const [pendingMove, setPendingMove] = useState<{ id: string; from: ApplicationStatus; to: ApplicationStatus } | null>(
		null,
	);
	// Sizes every column's drop placeholder (a CSS variable) to the dragged card.
	useKanbanCardPlaceholder({ renderIndicator: renderDropIndicator });

	// The query caught up, rolled back, or the card went away: the override has done its job.
	if (
		pendingMove &&
		applications.find((application) => application.id === pendingMove.id)?.status !== pendingMove.from
	) {
		setPendingMove(null);
	}
	const statusOf = (application: ApplicationSummary) =>
		pendingMove?.id === application.id ? pendingMove.to : application.status;

	const stages: ApplicationStatus[] = showClosed ? [...PIPELINE, "closed"] : [...PIPELINE];

	const byStage = new Map<ApplicationStatus, ApplicationSummary[]>(stages.map((stage) => [stage, []]));
	for (const application of applications) byStage.get(statusOf(application))?.push(application);

	const onDragSourceChange = (stage: ApplicationStatus | null) => {
		dragSource.current = stage;
	};
	const isDragSource = (stage: ApplicationStatus) => dragSource.current === stage;

	const onDrop = (id: string, target: ApplicationStatus) => {
		const application = applications.find((item) => item.id === id);
		if (!application || statusOf(application) === target) return;
		if (target === "closed") {
			setClosing(application);
			return;
		}
		setPendingMove({ id: application.id, from: application.status, to: target });
		moveTo(application, target);
	};

	return (
		<>
			<Kanban className="h-full auto-rows-[minmax(0,1fr)] pb-4">
				{stages.map((stage) => (
					<Column
						key={stage}
						stage={stage}
						applications={byStage.get(stage) ?? []}
						isDragSource={isDragSource}
						onDragSourceChange={onDragSourceChange}
						onDrop={onDrop}
						onOpen={onOpen}
					/>
				))}
			</Kanban>
			<Modal.Backdrop isOpen={Boolean(closing)} onOpenChange={(open) => !open && setClosing(null)}>
				<Modal.Container size="sm">
					<Modal.Dialog aria-describedby={closeDescriptionId}>
						<Modal.CloseTrigger aria-label={t`Close`} />
						<Modal.Header>
							<Modal.Heading>
								<Trans>Close application</Trans>
							</Modal.Heading>
							<p id={closeDescriptionId} className="text-sm text-muted">
								{closing?.role} · {closing?.company}
							</p>
						</Modal.Header>
						<Modal.Body className="grid gap-2 p-1">
							{CLOSED_REASONS.map((reason) => (
								<Button
									key={reason}
									variant="secondary"
									onPress={() => {
										if (!closing) return;
										setPendingMove({ id: closing.id, from: closing.status, to: "closed" });
										close(closing, reason);
										setClosing(null);
									}}
								>
									{getClosedReasonLabel(reason)}
								</Button>
							))}
						</Modal.Body>
					</Modal.Dialog>
				</Modal.Container>
			</Modal.Backdrop>
		</>
	);
}

// Cap the cards rendered per column so a stage with hundreds of applications doesn't mount hundreds of draggable
// nodes at once; the rest show in batches.
const COLUMN_PAGE_SIZE = 50;

const renderDropIndicator = (target: DropTarget) => <Kanban.DropIndicator target={target} />;

type ColumnProps = {
	stage: ApplicationStatus;
	applications: ApplicationSummary[];
	isDragSource: (stage: ApplicationStatus) => boolean;
	onDragSourceChange: (stage: ApplicationStatus | null) => void;
	onDrop: (id: string, stage: ApplicationStatus) => void;
	onOpen: (application: ApplicationSummary) => void;
};

function Column({ stage, applications, isDragSource, onDragSourceChange, onDrop, onOpen }: ColumnProps) {
	const titleId = useId();
	const [visible, setVisible] = useState(COLUMN_PAGE_SIZE);
	const shown = applications.slice(0, visible);
	const remaining = applications.length - shown.length;
	const label = getStageLabel(stage);

	const receive = async (items: DropItem[]) => {
		const ids = await Promise.all(items.filter(isTextDropItem).map((item) => item.getText(DRAG_TYPE)));
		for (const id of ids) onDrop(id, stage);
	};

	const { dragAndDropHooks } = useDragAndDrop<ApplicationSummary>({
		getItems: (keys) => [...keys].map((key) => ({ [DRAG_TYPE]: String(key), "text/plain": String(key) })),
		acceptedDragTypes: [DRAG_TYPE],
		// A card's own column isn't a drop target; elsewhere, between cards, on a card or into the column all move it.
		getDropOperation: () => (isDragSource(stage) ? "cancel" : "move"),
		onDragStart: () => onDragSourceChange(stage),
		onDragEnd: () => onDragSourceChange(null),
		onInsert: (event) => receive(event.items),
		onRootDrop: (event) => receive(event.items),
		onItemDrop: (event) => (event.isInternal ? undefined : receive(event.items)),
		renderDropIndicator,
	});

	return (
		<Kanban.Column aria-labelledby={titleId} className="min-h-0">
			<Kanban.ColumnHeader>
				<Kanban.ColumnIndicator style={{ background: getStageColor(stage) }} />
				<Kanban.ColumnTitle id={titleId}>{label}</Kanban.ColumnTitle>
				<Kanban.ColumnCount>{applications.length}</Kanban.ColumnCount>
			</Kanban.ColumnHeader>
			<Kanban.ColumnBody className="min-h-0">
				<Kanban.ScrollShadow className="min-h-0">
					<Kanban.CardList
						aria-label={label}
						items={shown}
						dragAndDropHooks={dragAndDropHooks}
						onAction={(key) => {
							const application = shown.find((item) => item.id === key);
							if (application) onOpen(application);
						}}
						renderEmptyState={() => t`No applications`}
						className="rounded-2xl transition-colors duration-quick data-drop-target:bg-accent-soft"
					>
						{(application) => (
							<Kanban.Card
								id={application.id}
								textValue={t`${application.role} at ${application.company}`}
								// Hover and focus prefetch the detail (see the applications route).
								data-application-id={application.id}
								data-application-open
							>
								<ApplicationCard application={application} />
							</Kanban.Card>
						)}
					</Kanban.CardList>
					{remaining > 0 && (
						<Button
							size="sm"
							variant="ghost"
							className="mx-2 mb-2 shrink-0"
							onPress={() => setVisible((count) => count + COLUMN_PAGE_SIZE)}
						>
							{t`Show ${Math.min(remaining, COLUMN_PAGE_SIZE)} more`}
						</Button>
					)}
				</Kanban.ScrollShadow>
			</Kanban.ColumnBody>
		</Kanban.Column>
	);
}
