// The first page of a section's options: add, sort and move; title, icon and what shows; columns and page breaks;
// then clear or delete with Undo.
import type { SectionMoves } from "./section-row";
import type { WriteSection, getSectionObject } from "@/features/entries/model";
import { plural } from "@lingui/core/macro";
import { useLingui } from "@lingui/react/macro";
import { View } from "react-native";
import { useEditSection, useSortByDate } from "./hooks";
import { useEdit, useSectionTitle, useUndoToast } from "@/features/entries/hooks";
import { ResumeIconGlyph, hasResumeIcon } from "@/features/entries/icon-picker";
import { deleteCustomSection } from "@/features/entries/model";
import { Icon, ListRow, ListSection, Switch } from "@/ui";

export type SectionPage = "menu" | "rename" | "columns" | "keywords" | "move" | "icon";

type SectionMenuProps = {
	section: WriteSection;
	settings: NonNullable<ReturnType<typeof getSectionObject>>;
	/** Where it prints ("Page 1 · Sidebar"). */
	where: string | undefined;
	onPage: (page: SectionPage) => void;
	onAddEntry: (section: WriteSection) => void;
	/** Which way it can move; Move up / Move down show only when they can act. */
	moves: SectionMoves;
	onMove: (direction: "up" | "down") => void;
	onClose: () => void;
};

export function SectionMenu({
	section,
	settings,
	where,
	onPage,
	onAddEntry,
	moves,
	onMove,
	onClose,
}: SectionMenuProps) {
	const { t } = useLingui();
	const title = useSectionTitle(section);
	const edit = useEdit();
	const editSection = useEditSection();
	const sortByDate = useSortByDate();
	const undoToast = useUndoToast();
	const change = (mutate: Parameters<ReturnType<typeof useEditSection>>[1]) => editSection(section, mutate);
	const hasIcon = Boolean(settings.icon) && hasResumeIcon(settings.icon);
	const isSkills = section.type === "skills";
	const canSort = section.type === "experience" || section.type === "education";
	const skills = settings as { layout?: string; keywordLayout?: string };
	const columns =
		isSkills && skills.layout === "inline"
			? t`1 column, inline`
			: plural(settings.columns, { one: "# column", other: "# columns" });
	const toggle = (label: string, value: boolean, set: (on: boolean) => void) => (
		<ListRow title={label} trailing={<Switch isSelected={value} onSelectedChange={set} accessibilityLabel={label} />} />
	);
	const act = (run: () => void) => () => {
		run();
		onClose();
	};
	return (
		<>
			<ListSection>
				{section.kind !== "summary" ? (
					<ListRow title={t`Add entry`} icon="plus" chevron={false} onPress={act(() => onAddEntry(section))} />
				) : null}
				{canSort ? (
					<ListRow title={t`Sort by date`} icon="arrow-down" chevron={false} onPress={act(() => sortByDate(section))} />
				) : null}
				{moves.up ? (
					<ListRow title={t`Move up`} icon="arrow-up" chevron={false} onPress={act(() => onMove("up"))} />
				) : null}
				{moves.down ? (
					<ListRow title={t`Move down`} icon="arrow-down" chevron={false} onPress={act(() => onMove("down"))} />
				) : null}
				<ListRow title={t`Move to…`} icon="arrows-left-right" value={where} onPress={() => onPage("move")} />
			</ListSection>
			<ListSection>
				<ListRow
					title={t`Rename…`}
					icon="pencil-simple"
					value={settings.title.trim() || undefined}
					onPress={() => onPage("rename")}
					testID="section-rename"
				/>
				<ListRow
					title={t`Icon…`}
					icon="bookmark-simple"
					// The chosen icon itself: its id is an English file name, not a label.
					value={hasIcon ? undefined : t`None`}
					trailing={
						hasIcon ? (
							<View className="flex-row items-center gap-2">
								<ResumeIconGlyph name={settings.icon} />
								<Icon name="caret-right" size={16} tone="muted" />
							</View>
						) : undefined
					}
					onPress={() => onPage("icon")}
				/>
				{toggle(t`Show on page`, !settings.hidden, (shown) =>
					change((target) => {
						target.hidden = !shown;
					}),
				)}
				{toggle(t`Show heading`, settings.showHeading !== false, (shown) =>
					change((target) => {
						target.showHeading = shown;
					}),
				)}
			</ListSection>
			<ListSection>
				<ListRow title={t`Columns`} icon="squares-four" value={columns} onPress={() => onPage("columns")} />
				{isSkills ? (
					<ListRow
						title={t`Keyword layout`}
						icon="list-bullets"
						value={
							skills.keywordLayout === "list"
								? t`Bulleted list`
								: skills.keywordLayout === "tags"
									? t`Chips`
									: t`Inline`
						}
						onPress={() => onPage("keywords")}
					/>
				) : null}
				{toggle(t`Keep on one page`, settings.keepTogether, (on) =>
					change((target) => {
						target.keepTogether = on;
					}),
				)}
				{toggle(t`Start on a new page`, settings.startOnNewPage, (on) =>
					change((target) => {
						target.startOnNewPage = on;
					}),
				)}
			</ListSection>
			<ListSection
				footer={
					section.kind === "custom"
						? t`Deletes the section and its entries. You can undo.`
						: t`Clears its entries; the section stays. You can undo.`
				}
			>
				<ListRow
					title={section.kind === "custom" ? t`Delete section` : t`Clear section`}
					icon="trash"
					tone="danger"
					testID="section-delete"
					onPress={act(() => {
						if (section.kind === "custom") {
							edit((draft) => deleteCustomSection(draft, section.id));
							undoToast(t`${title} deleted`);
						} else {
							change((target) => {
								if ("items" in target) target.items = [];
								else target.content = "";
							});
							undoToast(t`${title} cleared`);
						}
					})}
				/>
			</ListSection>
		</>
	);
}
