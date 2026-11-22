// Design → Layout: each page's Main and Sidebar sections. Hold ⋮⋮ to lift a section and drag it between columns and
// pages; ⋮ moves it without dragging and holds its page-break switches. Pages can be added, deleted or made full width.
import type { DropZone } from "./drop";
import type { Measurable } from "./layout-column";
import type { MoveTarget } from "./section-move-sheet";
import type { DesignProps } from "./types";
import type { LayoutColumnId, LayoutDrop, LayoutLocation } from "@rezumi/resume/layout";
import { useLingui } from "@lingui/react/macro";
import { useRef, useState } from "react";
import { ScrollView, View } from "react-native";
import { isSectionVisible } from "@rezumi/pdf/filtering";
import { getResumeSectionTitle } from "@rezumi/pdf/section-title";
import { addLayoutPage, deleteLayoutPage, moveSection, setPageFullWidth } from "@rezumi/resume/layout";
import { templateLayouts } from "@rezumi/schema/templates";
import { dropAt } from "./drop";
import { LayoutColumn, SectionRow } from "./layout-column";
import { SectionMoveSheet } from "./section-move-sheet";
import { DesignSubScreen } from "./sub-screen";
import { Button, Card, Icon, ListRow, ListSection, NumberStepper, Switch, Text, cx, haptics } from "@/ui";

const measure = (view: Measurable | null | undefined) =>
	new Promise<{ top: number; bottom: number } | null>((resolve) => {
		if (!view) return resolve(null);
		view.measureInWindow((_x, y, _width, height) => resolve({ top: y, bottom: y + height }));
	});

type Dragging = { id: string; dy: number; zones: DropZone[]; target: LayoutDrop | null };

export function LayoutScreen({ id }: { id: string }) {
	const { t } = useLingui();
	return (
		<DesignSubScreen id={id} title={t`Layout`} scroll={false}>
			{(props) => <LayoutEditor {...props} />}
		</DesignSubScreen>
	);
}

function LayoutEditor({ data, write, disabled }: DesignProps) {
	const { t } = useLingui();
	const { layout } = data.metadata;
	const columns = useRef(new Map<string, Measurable | null>());
	const rows = useRef(new Map<string, Measurable | null>());
	const latest = useRef<Dragging | null>(null);
	const [dragging, setDragging] = useState<Dragging | null>(null);
	const [menu, setMenu] = useState<MoveTarget | null>(null);
	const visible = (section: string) => isSectionVisible(section, data);
	const title = (section: string) => getResumeSectionTitle(data, section) || section;
	const columnLabel = (column: LayoutColumnId) =>
		column === "main"
			? t({ message: "Main", comment: "Layout editor column label for the primary content area" })
			: t({ message: "Sidebar", comment: "Layout editor column label for the secondary sidebar area" });

	// The latest drag, for the gesture callbacks; state mirrors it for rendering.
	const update = (next: Dragging | null) => {
		latest.current = next;
		setDragging(next);
	};
	// Full-width pages and one-column templates hide the sidebar: it's never a place to drop or move a section to.
	const oneColumn = templateLayouts[data.metadata.template].columns === 1;
	const dropColumns = (fullWidth: boolean) =>
		oneColumn || fullWidth ? (["main"] as const) : (["main", "sidebar"] as const);
	const lift = async (section: string) => {
		haptics.medium();
		update({ id: section, dy: 0, zones: [], target: null });
		const zones: DropZone[] = [];
		for (const [page, value] of layout.pages.entries()) {
			for (const column of dropColumns(value.fullWidth)) {
				const box = await measure(columns.current.get(`${page}-${column}`));
				if (!box) continue;
				const ids = value[column].filter((item) => item !== section && visible(item));
				const boxes = await Promise.all(ids.map((item) => measure(rows.current.get(item))));
				zones.push({ page, column, ...box, rows: boxes.filter((row) => row !== null) });
			}
		}
		// The finger may have lifted while the rows were measured.
		if (latest.current?.id === section) update({ ...latest.current, zones });
	};
	const move = (section: string, y: number, dy: number) => {
		const current = latest.current;
		if (current?.id !== section) return;
		const target = dropAt(current.zones, y);
		if (target && (target.page !== current.target?.page || target.column !== current.target?.column))
			haptics.selection();
		update({ ...current, dy, target });
	};
	const drop = (commit: boolean) => {
		const current = latest.current;
		if (!current) return;
		update(null);
		const { id: section, target } = current;
		if (commit && target)
			write("layout.move", (draft) => void moveSection(draft.metadata.layout, section, target, visible), true);
	};
	// One place up or down among the column's visible sections (screen readers, and the ⋮ sheet).
	const reorder = (section: string, at: LayoutLocation, direction: "up" | "down") => {
		const index = layout.pages[at.page]?.[at.column].filter(visible).indexOf(section) ?? -1;
		if (index < 0) return;
		const to = { ...at, index: direction === "up" ? index - 1 : index + 1 };
		if (to.index < 0) return;
		write("layout.reorder", (draft) => void moveSection(draft.metadata.layout, section, to, visible), true);
	};

	const column = (page: number, columnId: LayoutColumnId, sections: string[]) => {
		const shown = sections.filter(visible);
		const at: LayoutLocation = { page, column: columnId };
		const movesOf = (section: string) => {
			const index = shown.indexOf(section);
			return { up: index > 0, down: index >= 0 && index < shown.length - 1 };
		};
		const target = dragging?.target?.page === page && dragging.target.column === columnId ? dragging.target : null;
		// The lifted row still renders in place; the marker's index counts the other rows only.
		const others = shown.filter((item) => item !== dragging?.id);
		const anchor = target ? others[target.index] : undefined;
		const marker = target ? (anchor === undefined ? shown.length : shown.indexOf(anchor)) : null;
		return (
			<LayoutColumn
				key={columnId}
				label={columnLabel(columnId)}
				marker={marker}
				register={(view) => void columns.current.set(`${page}-${columnId}`, view)}
				rows={shown.map((section) => (
					<SectionRow
						key={section}
						id={section}
						title={title(section)}
						lifted={dragging?.id === section}
						offset={dragging?.id === section ? dragging.dy : 0}
						disabled={disabled}
						register={(view) => void rows.current.set(section, view)}
						onLift={() => void lift(section)}
						onMove={(y, dy) => move(section, y, dy)}
						onDrop={drop}
						onMenu={() => setMenu({ id: section, title: title(section), at, moves: movesOf(section) })}
						moves={movesOf(section)}
						onReorder={(direction) => reorder(section, at, direction)}
					/>
				))}
			/>
		);
	};

	return (
		<ScrollView
			scrollEnabled={!dragging}
			keyboardShouldPersistTaps="handled"
			contentContainerClassName={cx("gap-4 p-4", disabled && "opacity-60")}
		>
			{layout.pages.map((page, index) => (
				<Card key={`page-${index}`}>
					<Card.Body className="gap-3">
						<View className="flex-row items-center justify-between gap-2">
							<Text weight="semibold">
								{t({ message: `Page ${index + 1}`, comment: "Layout editor page label with 1-based page number" })}
							</Text>
							{layout.pages.length > 1 ? (
								<Button
									variant="ghost"
									size="sm"
									isDisabled={disabled}
									onPress={() =>
										write("layout.deletePage", (draft) => deleteLayoutPage(draft.metadata.layout, index), true)
									}
								>
									<Icon name="trash" size={16} />
									<Button.Label>{t`Delete page`}</Button.Label>
								</Button>
							) : null}
						</View>
						<ListSection>
							<ListRow
								title={t({
									message: "Full width",
									comment: "Layout editor toggle label that makes a page single-column",
								})}
								trailing={
									<Switch
										isSelected={page.fullWidth}
										isDisabled={disabled}
										accessibilityLabel={t`Full width`}
										onSelectedChange={(value) =>
											write("layout.fullWidth", (draft) => setPageFullWidth(draft.metadata.layout, index, value), true)
										}
									/>
								}
							/>
						</ListSection>
						{column(index, "main", page.main)}
						{/* A one-column template's sidebar shows only while it still holds sections, so they can be moved out. */}
						{page.fullWidth || (oneColumn && !page.sidebar.some(visible))
							? null
							: column(index, "sidebar", page.sidebar)}
					</Card.Body>
				</Card>
			))}
			<Button
				variant="secondary"
				isDisabled={disabled}
				className="self-start"
				onPress={() => write("layout.addPage", (draft) => addLayoutPage(draft.metadata.layout), true)}
			>
				<Icon name="plus" size={16} />
				<Button.Label>{t`Add page`}</Button.Label>
			</Button>
			<NumberStepper
				label={t`Sidebar width`}
				value={layout.sidebarWidth}
				unit="%"
				min={10}
				max={50}
				step={0.1}
				isDisabled={disabled}
				variant="primary"
				decreaseLabel={t`Narrower sidebar`}
				increaseLabel={t`Wider sidebar`}
				onChange={(value) => write("sidebarWidth", (draft) => void (draft.metadata.layout.sidebarWidth = value), true)}
			/>
			<SectionMoveSheet
				data={data}
				write={write}
				disabled={disabled}
				target={menu}
				onClose={() => setMenu(null)}
				columnLabel={columnLabel}
				onReorder={(target, direction) => reorder(target.id, target.at, direction)}
			/>
		</ScrollView>
	);
}
