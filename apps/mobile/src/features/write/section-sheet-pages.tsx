// The pages inside a section's options sheet: Rename, Columns, Keyword layout and Move to….
import type { LayoutColumn, WriteSection } from "@/features/entries/model";
import { plural } from "@lingui/core/macro";
import { useLingui } from "@lingui/react/macro";
import { useState } from "react";
import { useEditSection } from "./hooks";
import { useEdit } from "@/features/entries/hooks";
import { findPlacement, getSectionObject, placeSection } from "@/features/entries/model";
import { useWriteData } from "@/features/entries/source";
import { Button, Description, Input, Label, ListRow, ListSection, TextField } from "@/ui";

type RenamePageProps = { value: string; onSave: (title: string) => void };

/** Leave it empty to print the original title again. */
export function RenamePage({ value, onSave }: RenamePageProps) {
	const { t } = useLingui();
	const [title, setTitle] = useState(value);
	return (
		<>
			<TextField>
				<Label>{t`Section title`}</Label>
				<Input
					variant="secondary"
					accessibilityLabel={t`Section title`}
					value={title}
					autoFocus
					returnKeyType="done"
					onChangeText={setTitle}
					onSubmitEditing={() => onSave(title.trim())}
					testID="section-title-input"
				/>
				<Description>{t`Leave it empty to use the original title.`}</Description>
			</TextField>
			<Button onPress={() => onSave(title.trim())} testID="section-title-save">
				{t`Save title`}
			</Button>
		</>
	);
}

type PageProps = { section: WriteSection; onDone: () => void };

export function ColumnsPage({ section, onDone }: PageProps) {
	const { t } = useLingui();
	const editSection = useEditSection();
	const settings = useWriteData((data) => getSectionObject(data, section) ?? null, null);
	if (!settings) return null;
	const isSkills = section.type === "skills";
	const current =
		isSkills && (settings as { layout?: string }).layout === "inline" ? "inline" : String(settings.columns);
	const pick = (value: string) => {
		editSection(section, (target) => {
			if (isSkills) (target as { layout?: string }).layout = value === "inline" ? "inline" : "default";
			target.columns = value === "inline" ? 1 : Number(value);
		});
		onDone();
	};
	return (
		<ListSection>
			{[1, 2, 3, 4, 5, 6].map((count) => (
				<ListRow
					key={count}
					title={plural(count, { one: "# column", other: "# columns" })}
					isSelected={current === String(count)}
					chevron={false}
					onPress={() => pick(String(count))}
				/>
			))}
			{isSkills ? (
				<ListRow
					title={t`1 column, inline`}
					isSelected={current === "inline"}
					chevron={false}
					onPress={() => pick("inline")}
				/>
			) : null}
		</ListSection>
	);
}

/** How each skill's keywords print. */
export function KeywordsPage({ section, onDone }: PageProps) {
	const { t } = useLingui();
	const editSection = useEditSection();
	const layout = useWriteData(
		(data) => (getSectionObject(data, section) as { keywordLayout?: string } | undefined)?.keywordLayout ?? "inline",
		"inline",
	);
	const options = [
		{ value: "inline", label: t`Inline` },
		{ value: "list", label: t`Bulleted list` },
		{ value: "tags", label: t`Chips` },
	];
	return (
		<ListSection footer={t`How each skill's keywords print.`}>
			{options.map((option) => (
				<ListRow
					key={option.value}
					title={option.label}
					isSelected={layout === option.value}
					chevron={false}
					onPress={() => {
						editSection(section, (target) => {
							(target as { keywordLayout?: string }).keywordLayout = option.value;
						});
						onDone();
					}}
				/>
			))}
		</ListSection>
	);
}

/** The start of a page's main column or sidebar, or a new last page. */
export function MovePage({ section, onDone }: PageProps) {
	const { t } = useLingui();
	const edit = useEdit();
	const pages = useWriteData((data) => data.metadata.layout.pages, null);
	if (!pages) return null;
	const placement = findPlacement(pages, section.id);
	const place = (target: { page: number; column: LayoutColumn } | "new-page") => {
		// Where it already is: placing it again would jump it to the top of that column.
		const here = target !== "new-page" && placement?.page === target.page && placement.column === target.column;
		if (!here) edit((draft) => placeSection(draft, section.id, target));
		onDone();
	};
	return (
		<ListSection footer={t`The sidebar prints only on pages whose template has two columns.`}>
			{pages.flatMap((layout, page) =>
				(["main", "sidebar"] as const)
					.filter((column) => column === "main" || !layout.fullWidth)
					.map((column) => (
						<ListRow
							key={`${page}:${column}`}
							title={column === "main" ? t`Page ${page + 1}` : t`Page ${page + 1} · Sidebar`}
							isSelected={placement?.page === page && placement.column === column}
							chevron={false}
							onPress={() => place({ page, column })}
						/>
					)),
			)}
			<ListRow title={t`New page`} icon="plus" chevron={false} onPress={() => place("new-page")} />
		</ListSection>
	);
}
