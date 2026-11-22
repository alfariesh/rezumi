import type { DesignProps } from "./types";
import type { LayoutColumnId, LayoutLocation } from "@rezumi/resume/layout";
import { useLingui } from "@lingui/react/macro";
import { moveSectionToEnd, moveSectionToNewPage, readSectionBreak, toggleSectionBreak } from "@rezumi/resume/layout";
import { templateLayouts } from "@rezumi/schema/templates";
import { ListRow, ListSection, Sheet, Switch } from "@/ui";

export type MoveTarget = {
	id: string;
	title: string;
	at: LayoutLocation;
	/** Which way it can move within its column. */
	moves: { up: boolean; down: boolean };
};

type SectionMoveSheetProps = DesignProps & {
	target: MoveTarget | null;
	onClose: () => void;
	columnLabel: (column: LayoutColumnId) => string;
	/** One place up or down within its column. */
	onReorder: (target: MoveTarget, direction: "up" | "down") => void;
};

/**
 * One section's menu: Move up / Move down within its column (only those that can act), move it to another page or
 * column (or a new page), and its two page-break switches.
 */
export function SectionMoveSheet(props: SectionMoveSheetProps) {
	const { data, write, disabled, target, onClose, columnLabel, onReorder } = props;
	const { t } = useLingui();
	const { pages } = data.metadata.layout;
	const oneColumn = templateLayouts[data.metadata.template].columns === 1;
	const pageLabel = (index: number) =>
		t({ message: `Page ${index + 1}`, comment: "Layout editor page label with 1-based page number" });

	return (
		<Sheet isOpen={!!target} onOpenChange={(open) => !open && onClose()} title={target?.title} closeLabel={t`Close`}>
			{target ? (
				<>
					{target.moves.up || target.moves.down ? (
						<ListSection>
							{target.moves.up ? (
								<ListRow
									icon="arrow-up"
									title={t`Move up`}
									chevron={false}
									isDisabled={disabled}
									onPress={() => {
										onReorder(target, "up");
										onClose();
									}}
								/>
							) : null}
							{target.moves.down ? (
								<ListRow
									icon="arrow-down"
									title={t`Move down`}
									chevron={false}
									isDisabled={disabled}
									onPress={() => {
										onReorder(target, "down");
										onClose();
									}}
								/>
							) : null}
						</ListSection>
					) : null}
					<ListSection title={t`Move to`}>
						{pages.flatMap((page, index) =>
							// Full-width pages and one-column templates hide the sidebar, so it's never offered.
							(oneColumn || page.fullWidth ? (["main"] as const) : (["main", "sidebar"] as const)).map((column) => (
								<ListRow
									key={`${index}-${column}`}
									icon="file"
									title={`${pageLabel(index)} · ${columnLabel(column)}`}
									chevron={false}
									isSelected={target.at.page === index && target.at.column === column}
									isDisabled={disabled || (target.at.page === index && target.at.column === column)}
									onPress={() => {
										write(
											"layout.moveTo",
											(draft) => {
												moveSectionToEnd(draft.metadata.layout, target.id, { page: index, column });
											},
											true,
										);
										onClose();
									}}
								/>
							)),
						)}
						<ListRow
							key="new-page"
							icon="plus-circle"
							title={t`New page`}
							chevron={false}
							isDisabled={disabled}
							onPress={() => {
								write("layout.newPage", (draft) => moveSectionToNewPage(draft.metadata.layout, target.id), true);
								onClose();
							}}
						/>
					</ListSection>
					<ListSection title={t`Page breaks`}>
						<ListRow
							title={t({
								message: "Keep together",
								comment: "Layout editor toggle that prevents a section from splitting across pages",
							})}
							description={t({
								message: "Only applies when the section fits on a single page.",
								comment: "Helper note explaining the keep-together limitation",
							})}
							trailing={
								<Switch
									isSelected={readSectionBreak(data, target.id, "keepTogether")}
									isDisabled={disabled}
									accessibilityLabel={t`Keep together`}
									onSelectedChange={() =>
										write("layout.keepTogether", (draft) => toggleSectionBreak(draft, target.id, "keepTogether"), true)
									}
								/>
							}
						/>
						<ListRow
							title={t({
								message: "Start on new page",
								comment: "Layout editor toggle that forces a section to begin on a new page",
							})}
							trailing={
								<Switch
									isSelected={readSectionBreak(data, target.id, "startOnNewPage")}
									isDisabled={disabled}
									accessibilityLabel={t`Start on new page`}
									onSelectedChange={() =>
										write(
											"layout.startOnNewPage",
											(draft) => toggleSectionBreak(draft, target.id, "startOnNewPage"),
											true,
										)
									}
								/>
							}
						/>
					</ListSection>
				</>
			) : null}
		</Sheet>
	);
}
