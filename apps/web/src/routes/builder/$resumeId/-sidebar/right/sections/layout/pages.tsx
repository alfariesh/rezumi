import type { SortableTarget } from "@/components/input/sortable";
import type { Key } from "@heroui/react";
import type { ResumeData, SectionType } from "@rezumi/schema/resume/data";
import { Button, Description, Dropdown, Label, Separator, Switch } from "@heroui/react";
import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { useCallback } from "react";
import { mergeProps } from "react-aria";
import { match } from "ts-pattern";
import { filterSections } from "@rezumi/pdf/filtering";
import { templateLayouts } from "@rezumi/schema/templates";
import { Icon } from "@rezumi/ui/components/icon";
import { IconButton } from "@rezumi/ui/components/icon-button";
import { cn } from "@rezumi/utils/style";
import { resolveLayoutSectionTitle } from "./title";
import {
	SortableEdge,
	SortableHandle,
	SortableProvider,
	useSortableDropZone,
	useSortableItem,
} from "@/components/input/sortable";
import { useCurrentResume, useUpdateResumeData } from "@/features/resume/builder/draft";

type ColumnId = "main" | "sidebar";

const getColumnLabel = (columnId: ColumnId): string => {
	return match(columnId)
		.with("main", () =>
			t({
				comment: "Layout editor column label for the primary content area",
				message: "Main",
			}),
		)
		.with("sidebar", () =>
			t({
				comment: "Layout editor column label for the secondary sidebar area",
				message: "Sidebar",
			}),
		)
		.exhaustive();
};

type PageLocation = {
	pageIndex: number;
	columnId: ColumnId;
};

/** Reads a column's list id, "page-{index}-{columnId}", back into its page and column. */
const parseDroppableId = (id: string): PageLocation | null => {
	if (id.startsWith("page-")) {
		const parts = id.split("-");
		if (parts.length >= 3) {
			const pageIndex = Number.parseInt(parts[1] ?? "0", 10);
			const columnId = parts[2] as ColumnId;
			if (!Number.isNaN(pageIndex) && (columnId === "main" || columnId === "sidebar")) {
				return { pageIndex, columnId };
			}
		}
	}

	return null;
};

const createDroppableId = (pageIndex: number, columnId: ColumnId): string => {
	return `page-${pageIndex}-${columnId}`;
};

export function LayoutPages() {
	const resume = useCurrentResume();
	const template = resume.data.metadata.template;
	const templateSidebarPosition = templateLayouts[template].sidebarSide ?? "none";

	const layout = resume.data.metadata.layout;
	const updateResumeData = useUpdateResumeData();

	/**
	 * Returns the page index and column that contains the given section id.
	 */
	const findContainer = useCallback(
		(id: string): PageLocation | null => {
			for (const [pageIndex, page] of layout.pages.entries()) {
				const mainSections = new Set(page.main);
				const sidebarSections = new Set(page.sidebar);
				if (mainSections.has(id)) return { pageIndex, columnId: "main" };
				if (sidebarSections.has(id)) return { pageIndex, columnId: "sidebar" };
			}

			return null;
		},
		[layout.pages],
	);

	const handleMove = useCallback(
		(id: string, target: SortableTarget) => {
			const activeLocation = findContainer(id);
			const overLocation = parseDroppableId(target.list);
			if (!activeLocation || !overLocation) return;
			const { overId } = target;

			// Same location, reorder within column
			if (activeLocation.pageIndex === overLocation.pageIndex && activeLocation.columnId === overLocation.columnId) {
				const page = layout.pages[activeLocation.pageIndex];
				if (!page) return;
				const items = page[activeLocation.columnId];
				const oldIdx = items.indexOf(id);
				let newIdx = overId === null ? items.length - 1 : items.indexOf(overId);
				if (oldIdx === -1 || oldIdx === newIdx) return;
				if (newIdx === -1) newIdx = items.length - 1;

				updateResumeData((draft) => {
					const page = draft.metadata.layout.pages[activeLocation.pageIndex];
					if (!page) return;
					const column = page[activeLocation.columnId];
					const [moved] = column.splice(oldIdx, 1);
					if (moved !== undefined) column.splice(newIdx, 0, moved);
				});
				return;
			}

			// Different location, move between columns/pages
			const fromPage = layout.pages[activeLocation.pageIndex];
			const toPage = layout.pages[overLocation.pageIndex];
			if (!fromPage || !toPage) return;
			const fromItems = fromPage[activeLocation.columnId];
			const toItems = toPage[overLocation.columnId];
			const fromIdx = fromItems.indexOf(id);
			if (fromIdx === -1) return;

			let toIdx = overId === null ? -1 : toItems.indexOf(overId);
			if (toIdx === -1) toIdx = toItems.length;

			updateResumeData((draft) => {
				const fromPageDraft = draft.metadata.layout.pages[activeLocation.pageIndex];
				const toPageDraft = draft.metadata.layout.pages[overLocation.pageIndex];
				if (!fromPageDraft || !toPageDraft) return;
				const from = fromPageDraft[activeLocation.columnId];
				const to = toPageDraft[overLocation.columnId];

				from.splice(fromIdx, 1);
				to.splice(Math.min(toIdx, to.length), 0, id);
			});
		},
		[findContainer, layout.pages, updateResumeData],
	);

	const handleAddPage = useCallback(() => {
		updateResumeData((draft) => {
			draft.metadata.layout.pages.push({
				fullWidth: false,
				main: [],
				sidebar: [],
			});
		});
	}, [updateResumeData]);

	const handleDeletePage = useCallback(
		(pageIndex: number) => {
			if (layout.pages.length <= 1) return; // Don't allow deleting the last page

			updateResumeData((draft) => {
				const pageToDelete = draft.metadata.layout.pages[pageIndex];
				// Find the first available page that isn't being deleted
				const targetPageIndex = pageIndex === 0 ? 1 : 0;
				const targetPage = draft.metadata.layout.pages[targetPageIndex];
				if (!pageToDelete || !targetPage) return;

				// Move all sections from deleted page to target page
				targetPage.main.push(...pageToDelete.main);
				targetPage.sidebar.push(...pageToDelete.sidebar);

				draft.metadata.layout.pages.splice(pageIndex, 1);
			});
		},
		[layout.pages.length, updateResumeData],
	);

	const handleToggleFullWidth = useCallback(
		(pageIndex: number, fullWidth: boolean) => {
			updateResumeData((draft) => {
				const page = draft.metadata.layout.pages[pageIndex];
				if (!page) return;
				page.fullWidth = fullWidth;

				if (fullWidth) {
					// Move all sidebar sections to main
					page.main.push(...page.sidebar);
					page.sidebar = [];
				}
			});
		},
		[updateResumeData],
	);

	// Don't render until pages are initialized
	if (layout.pages.length === 0) {
		return null;
	}

	return (
		<SortableProvider onMove={handleMove}>
			<div className="flex flex-col gap-4">
				{layout.pages.map((page, pageIndex) => (
					<PageContainer
						key={`page-${pageIndex}`}
						pageIndex={pageIndex}
						page={{
							...page,
							main: filterSections(page.main, resume.data),
							sidebar: filterSections(page.sidebar, resume.data),
						}}
						canDelete={layout.pages.length > 1}
						sidebarPosition={templateSidebarPosition}
						onDelete={handleDeletePage}
						onToggleFullWidth={handleToggleFullWidth}
					/>
				))}

				<Button variant="secondary" className="self-end" onPress={() => handleAddPage()}>
					<Icon name="plus" size={16} />
					<Trans>Add page</Trans>
				</Button>
			</div>
		</SortableProvider>
	);
}

type PageContainerProps = {
	pageIndex: number;
	page: { fullWidth: boolean; main: string[]; sidebar: string[] };
	canDelete: boolean;
	sidebarPosition: "left" | "right" | "none";
	onDelete: (pageIndex: number) => void;
	onToggleFullWidth: (pageIndex: number, fullWidth: boolean) => void;
};

function PageContainer({
	pageIndex,
	page,
	canDelete,
	sidebarPosition,
	onDelete,
	onToggleFullWidth,
}: PageContainerProps) {
	const isFullWidth = page.fullWidth;

	return (
		<div className="space-y-3 rounded-xl bg-surface-secondary">
			<div className="@container px-4 pt-3">
				<div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 @max-[22rem]:grid-cols-1">
					<div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2">
						<span className="text-xs font-medium">
							<Trans comment="Layout editor page label with 1-based page number">Page {pageIndex + 1}</Trans>
						</span>

						<Switch
							className="min-w-0"
							isSelected={page.fullWidth}
							onChange={(checked) => onToggleFullWidth(pageIndex, checked)}
						>
							<Switch.Content className="gap-2 text-xs font-medium text-muted">
								<Switch.Control>
									<Switch.Thumb />
								</Switch.Control>
								<Trans comment="Layout editor toggle label that makes a page single-column">Full width</Trans>
							</Switch.Content>
						</Switch>
					</div>

					{canDelete && (
						<Button variant="danger-soft" size="sm" onPress={() => onDelete(pageIndex)} className="justify-self-end">
							<Icon name="trash" size={16} />
							<Trans>Delete page</Trans>
						</Button>
					)}
				</div>
			</div>

			<div
				className={cn(
					"grid w-full gap-x-4 gap-y-2 p-4 pt-0 font-medium @md:grid-cols-2",
					sidebarPosition === "none" && "@md:grid-cols-1",
				)}
			>
				<LayoutColumn
					pageIndex={pageIndex}
					columnId="main"
					items={page.main}
					disabled={false}
					className={cn(sidebarPosition === "left" ? "order-2" : "order-1")}
				/>

				{!isFullWidth && (
					<LayoutColumn
						pageIndex={pageIndex}
						columnId="sidebar"
						items={page.sidebar}
						hideLabel={sidebarPosition === "none"}
						className={cn(sidebarPosition === "left" ? "order-1" : "order-2")}
					/>
				)}
			</div>
		</div>
	);
}

type LayoutColumnProps = {
	pageIndex: number;
	columnId: ColumnId;
	items: string[];
	hideLabel?: boolean;
	disabled?: boolean;
	className?: string;
};

function LayoutColumn({
	pageIndex,
	columnId,
	items,
	hideLabel = false,
	disabled = false,
	className,
}: LayoutColumnProps) {
	const droppableId = createDroppableId(pageIndex, columnId);
	const zone = useSortableDropZone({ list: droppableId, length: items.length, isDisabled: disabled });

	return (
		<div className={cn("space-y-1.5", disabled && "opacity-50", className)}>
			{!hideLabel && (
				<div className="ps-1 text-xs font-medium text-muted @md:row-start-1">{getColumnLabel(columnId)}</div>
			)}

			<div
				{...zone.dropTargetProps}
				className={cn(
					"space-y-2 rounded-lg border border-dashed p-2 pb-8 transition-colors",
					zone.isOver && !disabled ? "border-accent bg-accent-soft" : "border-border",
				)}
			>
				{items.map((id, index) => (
					<LayoutItem key={id} id={id} list={droppableId} index={index} pageIndex={pageIndex} columnId={columnId} />
				))}

				{items.length === 0 && (
					<div className="p-2 text-xs text-muted">
						<Trans>Drag and drop sections here to move them between columns</Trans>
					</div>
				)}
			</div>
		</div>
	);
}

type MoveToSubmenuProps = {
	id: string;
	pageIndex: number;
	columnId: ColumnId;
};

/**
 * "Move to" submenu that mirrors the left-panel item menu but works at the
 * section level: it splices the section out of its current page/column and
 * pushes it onto the chosen target (or a brand new page).
 */
function MoveToSubmenu({ id, pageIndex, columnId }: MoveToSubmenuProps) {
	const resume = useCurrentResume();
	const updateResumeData = useUpdateResumeData();

	const pages = resume.data.metadata.layout.pages;
	// When the template collapses the sidebar, no page has a usable sidebar column.
	const sidebarCollapsed = templateLayouts[resume.data.metadata.template].columns === 1;

	const moveTo = (targetPageIndex: number, targetColumnId: ColumnId) => {
		updateResumeData((draft) => {
			const from = draft.metadata.layout.pages[pageIndex]?.[columnId];
			const to = draft.metadata.layout.pages[targetPageIndex]?.[targetColumnId];
			if (!from || !to) return;
			const index = from.indexOf(id);
			if (index === -1) return;
			from.splice(index, 1);
			to.push(id);
		});
	};

	const moveToNewPage = () => {
		updateResumeData((draft) => {
			const from = draft.metadata.layout.pages[pageIndex]?.[columnId];
			if (!from) return;
			const index = from.indexOf(id);
			if (index === -1) return;
			from.splice(index, 1);
			draft.metadata.layout.pages.push({ fullWidth: false, main: [id], sidebar: [] });
		});
	};

	return (
		<Dropdown.SubmenuTrigger>
			<Dropdown.Item id="move-to" textValue={t`Move to`}>
				<Icon name="arrow-u-up-right" size={16} />
				<Label>
					<Trans>Move to</Trans>
				</Label>
				<Dropdown.SubmenuIndicator />
			</Dropdown.Item>

			<Dropdown.Popover>
				<Dropdown.Menu>
					{pages.map((page, targetPageIndex) => {
						// Full-width pages hide their sidebar, so never offer it as a target.
						const sidebarHidden = sidebarCollapsed || page.fullWidth;

						return (
							<Dropdown.SubmenuTrigger key={`page-${targetPageIndex}`}>
								<Dropdown.Item id={`page-${targetPageIndex}`} textValue={t`Page ${targetPageIndex + 1}`}>
									<Icon name="file" size={16} />
									<Label>
										<Trans>Page {targetPageIndex + 1}</Trans>
									</Label>
									<Dropdown.SubmenuIndicator />
								</Dropdown.Item>

								<Dropdown.Popover>
									<Dropdown.Menu>
										<Dropdown.Item
											id="main"
											textValue={getColumnLabel("main")}
											isDisabled={targetPageIndex === pageIndex && columnId === "main"}
											onAction={() => moveTo(targetPageIndex, "main")}
										>
											<Label>{getColumnLabel("main")}</Label>
										</Dropdown.Item>

										{!sidebarHidden && (
											<Dropdown.Item
												id="sidebar"
												textValue={getColumnLabel("sidebar")}
												isDisabled={targetPageIndex === pageIndex && columnId === "sidebar"}
												onAction={() => moveTo(targetPageIndex, "sidebar")}
											>
												<Label>{getColumnLabel("sidebar")}</Label>
											</Dropdown.Item>
										)}
									</Dropdown.Menu>
								</Dropdown.Popover>
							</Dropdown.SubmenuTrigger>
						);
					})}

					<Separator />

					<Dropdown.Item id="new-page" textValue={t`New page`} onAction={moveToNewPage}>
						<Icon name="plus-circle" size={16} />
						<Label>
							<Trans>New page</Trans>
						</Label>
					</Dropdown.Item>
				</Dropdown.Menu>
			</Dropdown.Popover>
		</Dropdown.SubmenuTrigger>
	);
}

type SectionBreakField = "keepTogether" | "startOnNewPage";

const readSectionBreak = (data: ResumeData, id: string, field: SectionBreakField): boolean => {
	if (id === "summary") return data.summary[field];
	if (id in data.sections) return data.sections[id as SectionType][field];
	return data.customSections.find((section) => section.id === id)?.[field] ?? false;
};

type SectionBreakItemsProps = {
	id: string;
};

/**
 * Per-section page-break controls. These write the declarative `keepTogether` /
 * `startOnNewPage` flags onto the section metadata (summary, standard, or custom),
 * which the PDF renderer applies as `wrap` / `break` on the section container.
 */
function SectionBreakItems({ id }: SectionBreakItemsProps) {
	const resume = useCurrentResume();
	const updateResumeData = useUpdateResumeData();

	const keepTogether = readSectionBreak(resume.data, id, "keepTogether");
	const startOnNewPage = readSectionBreak(resume.data, id, "startOnNewPage");

	const toggle = (field: SectionBreakField) => {
		updateResumeData((draft) => {
			if (id === "summary") {
				draft.summary[field] = !draft.summary[field];
				return;
			}
			if (id in draft.sections) {
				const section = draft.sections[id as SectionType];
				section[field] = !section[field];
				return;
			}
			const custom = draft.customSections.find((section) => section.id === id);
			if (custom) custom[field] = !custom[field];
		});
	};

	const selected = new Set<Key>([
		...(keepTogether ? ["keepTogether"] : []),
		...(startOnNewPage ? ["startOnNewPage"] : []),
	]);

	const onSelectionChange = (keys: "all" | Set<Key>) => {
		if (keys === "all") return;
		for (const field of ["keepTogether", "startOnNewPage"] as const) {
			if (keys.has(field) !== selected.has(field)) toggle(field);
		}
	};

	return (
		<Dropdown.Section selectionMode="multiple" selectedKeys={selected} onSelectionChange={onSelectionChange}>
			<Dropdown.Item id="keepTogether" textValue={t`Keep together`}>
				<Dropdown.ItemIndicator />
				<Label>
					<Trans comment="Layout editor toggle that prevents a section from splitting across pages">
						Keep together
					</Trans>
				</Label>
				<Description>
					<Trans comment="Helper note explaining the keep-together limitation">
						Only applies when the section fits on a single page.
					</Trans>
				</Description>
			</Dropdown.Item>

			<Dropdown.Item id="startOnNewPage" textValue={t`Start on new page`}>
				<Dropdown.ItemIndicator />
				<Label>
					<Trans comment="Layout editor toggle that forces a section to begin on a new page">Start on new page</Trans>
				</Label>
			</Dropdown.Item>
		</Dropdown.Section>
	);
}

type LayoutItemProps = {
	id: string;
	list: string;
	index: number;
	pageIndex: number;
	columnId: ColumnId;
};

/** A section in a page column: drag it by its grip or anywhere on the row, or use the menu to move it. */
function LayoutItem({ id, list, index, pageIndex, columnId }: LayoutItemProps) {
	const resume = useCurrentResume();
	const title = resume ? resolveLayoutSectionTitle(resume.data, id) : id;
	const sortable = useSortableItem({ id, list, index, label: title });

	return (
		<div
			{...mergeProps(sortable.dropTargetProps, sortable.dragProps)}
			data-dragging={sortable.isDragging ? "true" : undefined}
			className={cn(
				"group/item relative flex cursor-grab items-center gap-x-2 rounded-lg bg-surface px-2 py-1.5 text-sm font-medium select-none",
				"hover:bg-default active:cursor-grabbing active:bg-default",
				"data-[dragging=true]:opacity-40",
			)}
		>
			<SortableEdge edge={sortable.edge} />
			<SortableHandle
				item={sortable}
				dragSource={false}
				label={t`Reorder ${title}`}
				iconSize={16}
				className="opacity-60 transition-opacity group-hover/item:opacity-100"
			/>
			<span className="min-w-0 flex-1 truncate">{title}</span>

			<Dropdown>
				<IconButton
					icon="dots-three-vertical"
					iconSize={16}
					size="sm"
					label={t`Move section to another column or page`}
					className="size-6 min-w-0 opacity-40 transition-opacity group-hover/item:opacity-100"
				/>

				<Dropdown.Popover placement="bottom end">
					<Dropdown.Menu>
						<MoveToSubmenu id={id} pageIndex={pageIndex} columnId={columnId} />
						<Separator />
						<SectionBreakItems id={id} />
					</Dropdown.Menu>
				</Dropdown.Popover>
			</Dropdown>
		</div>
	);
}
