import type { DocumentSort, DocumentSummary } from "./filter";
import type { DataGridColumn } from "@heroui-pro/react";
import type { Selection, SortDescriptor } from "@heroui/react";
import { DataGrid } from "@heroui-pro/react";
import { Checkbox, Dropdown, Link } from "@heroui/react";
import { t } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import { Plural, Trans } from "@lingui/react/macro";
import { useState } from "react";
import { Icon } from "@rezumi/ui/components/icon";
import { IconButton } from "@rezumi/ui/components/icon-button";
import { useBreakpoint } from "@rezumi/ui/hooks/use-breakpoint";
import { cn } from "@rezumi/utils/style";
import { DocumentMenuContent } from "./document-actions";
import { documentHref, NewChip, RenameInput, useOpenDocument } from "./document-card";
import { daysLeftInTrash } from "./filter";
import { useNewDocumentsStore } from "./new-documents";
import { formatRelativeTime } from "@/libs/locale";

export const documentKey = (document: DocumentSummary) => `${document.type}:${document.id}`;

// The URL sort has one direction per key: names A to Z, dates newest first.
const SORT_COLUMNS = { name: "name", edited: "edited", created: "created" } as const;
const SORT_DIRECTIONS = { name: "ascending", edited: "descending", created: "descending" } as const;

type DocumentListProps = {
	documents: DocumentSummary[];
	label: string;
	/** Trash: the date column counts the days left. */
	inTrash?: boolean | undefined;
	onTags: (document: DocumentSummary) => void;
	onLink: (document: DocumentSummary) => void;
	/** The selection, by `documentKey`; Trash has none. */
	selected?: ReadonlySet<string> | undefined;
	onSelectedChange?: ((keys: Set<string>) => void) | undefined;
	/** Name and Edited headers set the library's sort; Trash keeps its order. */
	sort?: DocumentSort | undefined;
	onSortChange?: ((sort: DocumentSort) => void) | undefined;
	className?: string | undefined;
};

/**
 * The list view and Trash: Name, Type, Application, Edited (or days left), ⋯. Clicking a row opens the document
 * until something is selected, then it toggles the row. Phones keep Name, the date and ⋯.
 */
export function DocumentList({
	documents,
	label,
	inTrash = false,
	onTags,
	onLink,
	selected,
	onSelectedChange,
	sort,
	onSortChange,
	className,
}: DocumentListProps) {
	const { i18n } = useLingui();
	const phone = useBreakpoint() === "mobile";
	const openDocument = useOpenDocument();
	const markOpened = useNewDocumentsStore((state) => state.markOpened);
	const newIds = useNewDocumentsStore((state) => state.ids);
	const [renaming, setRenaming] = useState<string | null>(null);
	const byKey = new Map(documents.map((document) => [documentKey(document), document]));
	const selectable = selected !== undefined && onSelectedChange !== undefined;
	const sortable = sort !== undefined && onSortChange !== undefined;

	const date = (document: DocumentSummary) =>
		document.trashedAt ? (
			<Plural value={daysLeftInTrash(document.trashedAt)} one="# day left" other="# days left" />
		) : (
			formatRelativeTime(document.updatedAt, i18n.locale)
		);

	const nameLine = (document: DocumentSummary) => (
		<span className="flex min-w-0 items-center gap-2.5">
			<Icon name={document.type === "resume" ? "file-text" : "envelope-simple"} className="shrink-0 text-muted" />
			{renaming === documentKey(document) ? (
				<RenameInput document={document} onDone={() => setRenaming(null)} />
			) : document.trashedAt ? (
				<span className="min-w-0 truncate text-sm font-medium">{document.name}</span>
			) : (
				<Link
					href={documentHref(document)}
					onPress={() => markOpened(document.id)}
					className="min-w-0 truncate text-sm font-medium text-foreground no-underline hover:underline"
				>
					{document.name}
				</Link>
			)}
			{newIds.includes(document.id) && !document.trashedAt && <NewChip />}
			{document.isPublic && (
				<span title={t`Public`} className="shrink-0 text-muted">
					<Icon name="globe" size={16} />
					<span className="sr-only">
						<Trans>Public</Trans>
					</span>
				</span>
			)}
			{document.isLocked && (
				<span title={t`Locked`} className="shrink-0 text-muted">
					<Icon name="lock" size={16} />
					<span className="sr-only">
						<Trans>Locked</Trans>
					</span>
				</span>
			)}
		</span>
	);

	// Widths sit on the header cells: DataGrid applies column `width` only to resizable columns.
	const columns: DataGridColumn<DocumentSummary>[] = [
		...(selectable
			? [
					{
						id: "select",
						headerClassName: "w-11",
						header: (
							<Checkbox slot="selection" aria-label={t`Select all`}>
								<Checkbox.Content>
									<Checkbox.Control>
										<Checkbox.Indicator />
									</Checkbox.Control>
								</Checkbox.Content>
							</Checkbox>
						),
						// React Aria adds the row's name: "Select Product resume".
						cell: () => (
							<Checkbox slot="selection" aria-label={t`Select`}>
								<Checkbox.Content>
									<Checkbox.Control>
										<Checkbox.Indicator />
									</Checkbox.Control>
								</Checkbox.Content>
							</Checkbox>
						),
					} satisfies DataGridColumn<DocumentSummary>,
				]
			: []),
		{
			id: "name",
			header: t`Name`,
			isRowHeader: true,
			allowsSorting: sortable,
			cell: (document) => (
				<span className="grid min-w-0 gap-0.5">
					{nameLine(document)}
					{phone && <span className="ps-[26px] text-xs whitespace-nowrap text-muted">{date(document)}</span>}
				</span>
			),
		},
		...(phone
			? []
			: [
					{
						id: "type",
						header: t`Type`,
						headerClassName: "w-26",
						cellClassName: "text-muted",
						cell: (document: DocumentSummary) =>
							document.type === "resume" ? <Trans>Resume</Trans> : <Trans>Letter</Trans>,
					} satisfies DataGridColumn<DocumentSummary>,
					{
						id: "application",
						header: t`Application`,
						headerClassName: "w-1/4",
						cellClassName: "text-muted",
						cell: (document: DocumentSummary) => (
							<span className="block truncate">{document.application?.company ?? "—"}</span>
						),
					} satisfies DataGridColumn<DocumentSummary>,
					{
						id: "edited",
						header: inTrash ? t`Deleted in` : t`Edited`,
						allowsSorting: sortable,
						headerClassName: "w-32",
						cellClassName: "whitespace-nowrap text-muted",
						cell: date,
					} satisfies DataGridColumn<DocumentSummary>,
				]),
		{
			id: "menu",
			header: <span className="sr-only">{t`Options`}</span>,
			headerClassName: "w-14",
			align: "end",
			cell: (document) => (
				<Dropdown>
					<IconButton icon="dots-three" label={t`Options for ${document.name}`} size="sm" />
					<DocumentMenuContent
						document={document}
						onOpen={() => openDocument(document)}
						onRename={() => setRenaming(documentKey(document))}
						onTags={() => onTags(document)}
						onLink={() => onLink(document)}
					/>
				</Dropdown>
			),
		},
	];

	const sortDescriptor: SortDescriptor | undefined = sortable
		? { column: SORT_COLUMNS[sort], direction: SORT_DIRECTIONS[sort] }
		: undefined;

	return (
		<DataGrid
			aria-label={label}
			variant="secondary"
			className={cn("w-full", className)}
			contentClassName="table-fixed"
			columns={columns}
			data={documents}
			getRowId={documentKey}
			selectionMode={selectable ? "multiple" : "none"}
			{...(selectable && {
				selectedKeys: new Set(selected),
				onSelectionChange: (keys: Selection) =>
					onSelectedChange(keys === "all" ? new Set(byKey.keys()) : new Set([...keys].map(String))),
			})}
			{...(sortDescriptor && {
				sortDescriptor,
				onSortChange: (descriptor: SortDescriptor) => {
					if (descriptor.column === "name" || descriptor.column === "edited") onSortChange?.(descriptor.column);
				},
			})}
			{...(selectable && {
				onRowAction: (key: string | number) => {
					const document = byKey.get(String(key));
					if (document) openDocument(document);
				},
			})}
		/>
	);
}
