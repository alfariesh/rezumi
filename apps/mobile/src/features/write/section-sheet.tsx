// A section's options (the web's section menu) in one sheet: the menu, and Rename, Columns, Keyword layout and
// Move to… as pages inside it. The icon grid opens over it.
import type { SectionPage } from "./section-menu";
import type { SectionMoves } from "./section-row";
import type { WriteSection } from "@/features/entries/model";
import { useLingui } from "@lingui/react/macro";
import { useState } from "react";
import { View } from "react-native";
import { useEditSection } from "./hooks";
import { SectionMenu } from "./section-menu";
import { ColumnsPage, KeywordsPage, MovePage, RenamePage } from "./section-sheet-pages";
import { useSectionTitle } from "@/features/entries/hooks";
import { IconPickerSheet } from "@/features/entries/icon-picker";
import { findPlacement, getSectionObject } from "@/features/entries/model";
import { useWriteData } from "@/features/entries/source";
import { ListRow, ListSection, Sheet } from "@/ui";

type SectionSheetProps = {
	section: WriteSection | null;
	onClose: () => void;
	onAddEntry: (section: WriteSection) => void;
	moves: SectionMoves;
	onMove: (direction: "up" | "down") => void;
};

export function SectionSheet({ section, onClose, onAddEntry, moves, onMove }: SectionSheetProps) {
	const { t } = useLingui();
	const title = useSectionTitle(section);
	const settings = useWriteData((data) => (section ? (getSectionObject(data, section) ?? null) : null), null);
	const placement = useWriteData((data) => {
		const found = section ? findPlacement(data.metadata.layout.pages, section.id) : null;
		return found ? `${found.page}:${found.column}` : "";
	}, "");
	const editSection = useEditSection();
	const [page, setPage] = useState<Exclude<SectionPage, "icon">>("menu");
	const [iconOpen, setIconOpen] = useState(false);

	const close = () => {
		setPage("menu");
		onClose();
	};
	const back = () => setPage("menu");
	const [pageIndex = "0", column = "main"] = placement.split(":");
	const where = placement
		? column === "main"
			? t`Page ${Number(pageIndex) + 1}`
			: t`Page ${Number(pageIndex) + 1} · Sidebar`
		: undefined;
	const titles = {
		menu: title,
		rename: t`Rename section`,
		columns: t`Columns`,
		keywords: t`Keyword layout`,
		move: t`Move ${title} to…`,
	};

	const content = () => {
		if (!section || !settings) return null;
		if (page === "menu")
			return (
				<SectionMenu
					section={section}
					settings={settings}
					where={where}
					onPage={(next) => (next === "icon" ? setIconOpen(true) : setPage(next))}
					onAddEntry={onAddEntry}
					moves={moves}
					onMove={onMove}
					onClose={close}
				/>
			);
		const pageContent =
			page === "rename" ? (
				<RenamePage
					value={settings.title}
					onSave={(next) => {
						if (next !== settings.title)
							editSection(section, (target) => {
								target.title = next;
							});
						back();
					}}
				/>
			) : page === "columns" ? (
				<ColumnsPage section={section} onDone={back} />
			) : page === "keywords" ? (
				<KeywordsPage section={section} onDone={back} />
			) : (
				<MovePage section={section} onDone={back} />
			);
		return (
			<>
				<ListSection>
					<ListRow title={title} icon="caret-left" chevron={false} onPress={back} />
				</ListSection>
				<View className="gap-3">{pageContent}</View>
			</>
		);
	};

	return (
		<>
			<Sheet
				isOpen={section !== null}
				onOpenChange={(open) => !open && close()}
				title={titles[page]}
				closeLabel={t`Close`}
				detents={[0.9]}
				testID="section-sheet"
			>
				{content()}
			</Sheet>
			<IconPickerSheet
				isOpen={iconOpen}
				value={settings?.icon === "none" ? "" : (settings?.icon ?? "")}
				onOpenChange={setIconOpen}
				onChange={(icon) => {
					if (section)
						editSection(section, (target) => {
							target.icon = icon === "" ? "none" : icon;
						});
					setIconOpen(false);
				}}
			/>
		</>
	);
}
