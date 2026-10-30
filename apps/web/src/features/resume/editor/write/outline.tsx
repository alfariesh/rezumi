import type { PageSettings } from "./entries";
import type { OutlineRow, WriteSection } from "./model";
import type { DragEndEvent } from "@dnd-kit/core";
import type { MessageDescriptor } from "@lingui/core";
import type { CustomSectionType } from "@rezumi/schema/resume/data";
import { closestCenter, DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Widget } from "@heroui-pro/react";
import { Button } from "@heroui/react";
import { msg } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import { Trans } from "@lingui/react/macro";
import { Fragment, useId, useMemo } from "react";
import { Icon } from "@rezumi/ui/components/icon";
import { useEditorStore } from "../store";
import { addEntryTo } from "./actions";
import { EntryCard } from "./entry-card";
import { getEntries, getOutlineRows, getSectionKind, getSectionType, moveSection } from "./model";
import { SectionRow } from "./section-row";
import { SummaryEditor } from "./summary-editor";
import { useCurrentBuilderResumeSelector, useUpdateResumeData } from "@/features/resume/builder/draft";

const ADD_LABELS: Record<CustomSectionType, MessageDescriptor> = {
	summary: msg`Add text`,
	experience: msg`Add experience`,
	education: msg`Add education`,
	projects: msg`Add project`,
	skills: msg`Add skill`,
	languages: msg`Add language`,
	interests: msg`Add interest`,
	awards: msg`Add award`,
	certifications: msg`Add certification`,
	publications: msg`Add publication`,
	volunteer: msg`Add volunteering`,
	references: msg`Add reference`,
	profiles: msg`Add profile`,
	"cover-letter": msg`Add cover letter`,
};

const rowKey = (row: OutlineRow) => `${row.id}\u0000${row.page}\u0000${row.column}\u0000${row.hidden ? 1 : 0}`;

function parseRows(key: string): OutlineRow[] {
	if (!key) return [];
	return key.split("\u0001").map((part) => {
		const [id = "", page = "0", column = "main", hidden = "0"] = part.split("\u0000");
		return { id, page: Number(page), column: column as OutlineRow["column"], hidden: hidden === "1" };
	});
}

function useSortSensors() {
	return useSensors(
		// A small distance keeps clicks on the handle from starting a drag.
		useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
		useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
	);
}

type OutlineProps = { locked: boolean; page: PageSettings };

/**
 * The outline: sections in print order, one widget per page. Hidden sections keep their place (dimmed, with the
 * eye crossed out), so showing one again puts it back where it was. Dragging a row (or ⌥↑ / ⌥↓ on its title)
 * reorders the layout, across pages too; on two-column pages a label marks where the sidebar starts.
 */
export function Outline({ locked, page }: OutlineProps) {
	const added = useEditorStore((state) => state.addedSections);
	const key = useCurrentBuilderResumeSelector((resume) =>
		getOutlineRows(resume.data, new Set(added)).map(rowKey).join("\u0001"),
	);
	const rows = useMemo(() => parseRows(key), [key]);
	const pages = useMemo(() => groupByPage(rows), [rows]);
	const updateResumeData = useUpdateResumeData();
	const sensors = useSortSensors();

	const move = (id: string, target: OutlineRow | undefined, direction: "up" | "down") => {
		if (!target) return;
		updateResumeData((draft) => moveSection(draft, id, target, direction), { newStep: true });
	};

	const onDragEnd = ({ active, over }: DragEndEvent) => {
		if (!over || active.id === over.id) return;
		const from = rows.findIndex((row) => row.id === active.id);
		const to = rows.findIndex((row) => row.id === over.id);
		move(String(active.id), rows[to], from < to ? "down" : "up");
	};

	return (
		<DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
			<SortableContext items={rows.map((row) => row.id)} strategy={verticalListSortingStrategy}>
				{pages.map(({ page: pageIndex, rows: pageRows }, widgetIndex) => (
					<PageWidget key={pageIndex} pageNumber={pageIndex + 1} hint={!locked && widgetIndex === 0}>
						{pageRows.map((row, index) => {
							const sidebarStarts = row.column === "sidebar" && pageRows[index - 1]?.column !== "sidebar";
							const position = rows.indexOf(row);

							return (
								<Fragment key={row.id}>
									{sidebarStarts && <SidebarLabel />}
									<OutlineSection
										sectionId={row.id}
										locked={locked}
										page={page}
										onMove={(direction) =>
											move(row.id, rows[direction === "up" ? position - 1 : position + 1], direction)
										}
									/>
								</Fragment>
							);
						})}
					</PageWidget>
				))}
			</SortableContext>
		</DndContext>
	);
}

/** Rows in print order, grouped by the page they print on. */
function groupByPage(rows: OutlineRow[]) {
	const pages: { page: number; rows: OutlineRow[] }[] = [];
	for (const row of rows) {
		const last = pages.at(-1);
		if (last?.page === row.page) last.rows.push(row);
		else pages.push({ page: row.page, rows: [row] });
	}
	return pages;
}

type PageWidgetProps = { pageNumber: number; hint: boolean; children: React.ReactNode };

function PageWidget({ pageNumber, hint, children }: PageWidgetProps) {
	const titleId = useId();

	return (
		<Widget role="region" aria-labelledby={titleId}>
			<Widget.Header>
				<span className="flex min-w-0 items-center gap-2">
					<Icon name="file-text" size={16} className="shrink-0 text-muted" />
					<Widget.Title id={titleId} className="truncate">
						<Trans>Page {pageNumber}</Trans>
					</Widget.Title>
				</span>
				{hint && (
					<Widget.Description className="whitespace-nowrap max-sm:hidden">
						<Trans>drag · ⌥↑↓</Trans>
					</Widget.Description>
				)}
			</Widget.Header>
			<Widget.Content className="grid gap-0.5 p-1.5">{children}</Widget.Content>
		</Widget>
	);
}

function SidebarLabel() {
	return (
		<p className="flex items-center gap-1.5 px-2 pt-2 pb-1 text-xs font-medium text-muted">
			<Icon name="sidebar-simple" size={14} />
			<Trans>Sidebar</Trans>
		</p>
	);
}

type OutlineSectionProps = {
	sectionId: string;
	locked: boolean;
	page: PageSettings;
	onMove?: ((direction: "up" | "down") => void) | undefined;
};

function OutlineSection({ sectionId, locked, page, onMove }: OutlineSectionProps) {
	const { i18n } = useLingui();
	// Select the type (a string) rather than a new section object, so the row renders only when it changes.
	const type = useCurrentBuilderResumeSelector((resume) => getSectionType(resume.data, sectionId) ?? null);
	const stableSection = useMemo<WriteSection | null>(
		() => (type ? { id: sectionId, kind: getSectionKind(sectionId), type } : null),
		[sectionId, type],
	);
	if (!stableSection) return null;

	return (
		<SectionRow section={stableSection} locked={locked} onMove={onMove}>
			{stableSection.kind === "summary" ? (
				<SummaryEditor locked={locked} />
			) : (
				<>
					<EntryList section={stableSection} locked={locked} page={page} />
					{!locked && (
						<Button
							variant="ghost"
							onPress={() => addEntryTo(stableSection)}
							className="w-fit text-accent-soft-foreground"
						>
							<Icon name="plus" size={18} />
							{i18n._(ADD_LABELS[stableSection.type])}
						</Button>
					)}
				</>
			)}
		</SectionRow>
	);
}

type EntryListProps = { section: WriteSection; locked: boolean; page: PageSettings };

/** Entries reorder like sections: drag the card's handle, or ⌥↑ / ⌥↓ on its title. */
function EntryList({ section, locked, page }: EntryListProps) {
	const ids = useCurrentBuilderResumeSelector((resume) =>
		getEntries(resume.data, section)
			.map((entry) => entry.id)
			.join("\u0000"),
	);
	const entryIds = useMemo(() => (ids ? ids.split("\u0000") : []), [ids]);
	const updateResumeData = useUpdateResumeData();
	const sensors = useSortSensors();

	const move = (entryId: string, to: number) => {
		if (to < 0 || to >= entryIds.length) return;
		updateResumeData(
			(draft) => {
				const entries = getEntries(draft, section);
				const from = entries.findIndex((entry) => entry.id === entryId);
				const [entry] = entries.splice(from, 1);
				if (entry) entries.splice(to, 0, entry);
			},
			{ newStep: true },
		);
	};

	const onDragEnd = ({ active, over }: DragEndEvent) => {
		if (!over || active.id === over.id) return;
		move(String(active.id), entryIds.indexOf(String(over.id)));
	};

	return (
		<DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
			<SortableContext items={entryIds} strategy={verticalListSortingStrategy}>
				{entryIds.map((entryId, index) => (
					<EntryCard
						key={entryId}
						section={section}
						entryId={entryId}
						index={index}
						count={entryIds.length}
						page={page}
						locked={locked}
						onMove={(id, direction) => move(id, direction === "up" ? index - 1 : index + 1)}
					/>
				))}
			</SortableContext>
		</DndContext>
	);
}
