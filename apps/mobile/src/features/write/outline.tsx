// The outline (the web's outline.tsx on a phone): one sortable list of page and sidebar labels, section rows and,
// under open sections, their entries and Add rows. Hold ⋮⋮ to move a section (across pages and into the sidebar) or
// an entry within its section; screen readers move rows with Move up / Move down. Hidden sections wait at the end.
import type { SectionMoves } from "./section-row";
import type { FlatRow, WriteSection } from "@/features/entries/model";
import type { ReactElement } from "react";
import { useLingui } from "@lingui/react/macro";
import { useMemo, useState } from "react";
import { View } from "react-native";
import { AddFromProfileSheet, AddRow } from "./add-row";
import { EntryRow } from "./entry-row";
import { EntrySheet } from "./entry-sheet";
import { SectionRow } from "./section-row";
import { SectionSheet } from "./section-sheet";
import { requestFocus, useAddEntry, useEdit } from "@/features/entries/hooks";
import {
	applySectionDrop,
	flattenOutline,
	getOutlineRows,
	moveEntry,
	moveSection,
	resolveDrop,
	resolveSection,
} from "@/features/entries/model";
import { useWriteData, useWriteSource } from "@/features/entries/source";
import { Icon, SortableList, Text } from "@/ui";

type OutlineProps = {
	/** Sections added this visit stay listed while still empty. */
	added: ReadonlySet<string>;
	open: ReadonlySet<string>;
	onToggle: (sectionId: string) => void;
	onOpenEntry: (sectionId: string, entryId: string) => void;
	onOpenSummary: () => void;
	header: ReactElement;
	footer: ReactElement;
};

const rowsKey = (rows: { id: string; page: number; column: string; hidden: boolean }[]) =>
	rows.map((row) => `${row.id}:${row.page}:${row.column}:${row.hidden ? 1 : 0}`).join("|");

export function Outline({ added, open, onToggle, onOpenEntry, onOpenSummary, header, footer }: OutlineProps) {
	const source = useWriteSource();
	const locked = source.useLocked();
	const edit = useEdit();
	const addEntry = useAddEntry();
	// The shape of the outline as a string, so typing in a field never rebuilds the list.
	const shape = useWriteData((data) => {
		const rows = getOutlineRows(data, added);
		const flat = flattenOutline(data, rows, open);
		return `${rowsKey(rows)}#${flat.map((row) => row.key).join("|")}`;
	}, "");
	const flat = useMemo(() => {
		const data = source.getData();
		return shape && data ? flattenOutline(data, getOutlineRows(data, added), open) : [];
	}, [shape, source, added, open]);
	const [sectionFor, setSectionFor] = useState<WriteSection | null>(null);
	const [entryFor, setEntryFor] = useState<{ section: WriteSection; entryId: string } | null>(null);
	const [fromProfileFor, setFromProfileFor] = useState<WriteSection | null>(null);

	const resolve = (id: string) => {
		const data = source.getData();
		return data ? resolveSection(data, id) : null;
	};
	const active = flat.flatMap((row) => (row.kind === "section" && !row.row.hidden ? [row.row] : []));
	// Hidden sections wait at the end and don't move; the first and last can only move one way.
	const movesOf = (id: string): SectionMoves => {
		const index = active.findIndex((row) => row.id === id);
		return { up: index > 0, down: index !== -1 && index < active.length - 1 };
	};
	const moveRow = (id: string, direction: "up" | "down") => {
		const index = active.findIndex((row) => row.id === id);
		const target = active[direction === "up" ? index - 1 : index + 1];
		if (index !== -1 && target) edit((draft) => moveSection(draft, id, target, direction));
	};
	const add = (section: WriteSection) => {
		const id = addEntry(section);
		requestFocus(id);
		onOpenEntry(section.id, id);
	};

	const renderItem = ({ item, drag }: { item: FlatRow; drag: () => void }) => {
		switch (item.kind) {
			case "divider":
				return <Divider label={item.label} page={item.page} />;
			case "section":
				return (
					<SectionRow
						row={item.row}
						open={open.has(item.row.id)}
						locked={locked}
						moves={movesOf(item.row.id)}
						onDrag={drag}
						onToggle={() => (item.row.id === "summary" ? onOpenSummary() : onToggle(item.row.id))}
						onMove={(direction) => moveRow(item.row.id, direction)}
						onOptions={() => setSectionFor(resolve(item.row.id))}
					/>
				);
			case "entry":
				return (
					<EntryRow
						row={item}
						locked={locked}
						onDrag={drag}
						onOpen={() => onOpenEntry(item.sectionId, item.entryId)}
						onMove={(to) => {
							const section = resolve(item.sectionId);
							if (section) edit((draft) => moveEntry(draft, section, item.entryId, to));
						}}
						onOptions={() => {
							const section = resolve(item.sectionId);
							if (section) setEntryFor({ section, entryId: item.entryId });
						}}
					/>
				);
			case "add":
				return locked ? (
					<View />
				) : (
					<AddRow sectionId={item.sectionId} onAdd={add} onAddFromProfile={setFromProfileFor} />
				);
		}
	};

	return (
		<>
			<SortableList<FlatRow>
				data={flat}
				keyExtractor={(row) => row.key}
				renderItem={renderItem}
				onReorder={(reordered, { to }) => {
					const drop = resolveDrop(reordered, to);
					if (drop?.kind === "section") edit((draft) => applySectionDrop(draft, drop));
					if (drop?.kind === "entry") {
						const section = resolve(drop.sectionId);
						if (section) edit((draft) => moveEntry(draft, section, drop.entryId, drop.to));
					}
				}}
				ListHeaderComponent={header}
				ListFooterComponent={footer}
				testID="write-outline"
			/>
			<SectionSheet
				section={sectionFor}
				onClose={() => setSectionFor(null)}
				onAddEntry={add}
				moves={sectionFor ? movesOf(sectionFor.id) : { up: false, down: false }}
				onMove={(direction) => sectionFor && moveRow(sectionFor.id, direction)}
			/>
			<EntrySheet target={entryFor} onClose={() => setEntryFor(null)} onOpen={onOpenEntry} />
			<AddFromProfileSheet section={fromProfileFor} onClose={() => setFromProfileFor(null)} onOpen={onOpenEntry} />
		</>
	);
}

type DividerProps = { label: "page" | "sidebar" | "hidden"; page: number };

/** "Page 2", "Sidebar" or "Hidden sections" above the rows it introduces. */
function Divider({ label, page }: DividerProps) {
	const { t } = useLingui();
	const text = label === "page" ? t`Page ${page + 1}` : label === "sidebar" ? t`Sidebar` : t`Hidden sections`;
	return (
		<View accessibilityRole="header" className="flex-row items-center gap-2 px-4 pt-4 pb-1">
			{label === "sidebar" ? <Icon name="sidebar-simple" size={16} tone="muted" /> : null}
			<Text size="xs" weight="semibold" tone="muted">
				{text}
			</Text>
			<View className="h-px flex-1 bg-separator" />
		</View>
	);
}
