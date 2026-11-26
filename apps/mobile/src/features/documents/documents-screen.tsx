// Documents (plans/mobile Phase 07 step 3): every resume and letter in one library, as the web's Documents page and
// Trash. A segment under the title picks All, Resumes, Letters or Trash; search, sort, Public and tag chips narrow
// the library; rows (phones) or cards in columns (the grid, and tablets by default) show the real first page. A tap
// opens the editor, a long press or ⋯ the menu, a swipe the quick actions (also in the menu).
import type { DocumentItemHandlers } from "./document-item";
import type { DocumentSort, DocumentSummary } from "./filter";
import type { LibraryView } from "./library-toolbar";
import { useLingui } from "@lingui/react/macro";
import { useRouter } from "expo-router";
import { useLayoutEffect, useRef, useState } from "react";
import { View } from "react-native";
import { useDocumentActions } from "./document-actions";
import { DocumentList } from "./document-list";
import { collectTags, documentKey, filterDocuments } from "./filter";
import { LibraryMenu } from "./library-menu";
import {
	FirstRun,
	LibrarySkeleton,
	LoadFailed,
	NoMatches,
	RefreshFailed,
	TrashEmpty,
	TypeEmpty,
} from "./library-states";
import { LibraryToolbar } from "./library-toolbar";
import { usePendingDocuments } from "./pending";
import { PurgeDialog } from "./purge-dialog";
import { useDocuments } from "./queries";
import { SegmentHeader, type LibrarySegment } from "./segment-header";
import { UnsyncedDocuments } from "./unsynced-documents";
import { useDocumentCounts } from "@/features/home/queries";
import { useSectionWidth } from "@/shell/section-width";
import { NewFab, TabTopBar } from "@/shell/tab-chrome";
import { size } from "@/ui";

type DocumentsScreenProps = { segment: LibrarySegment };

/** Columns of cards for the screen's width: two on phones, more on tablets. */
const columnsFor = (width: number) => (width >= 1100 ? 5 : width >= 900 ? 4 : width >= size.wide ? 3 : 2);

export function DocumentsScreen({ segment }: DocumentsScreenProps) {
	const { t } = useLingui();
	const router = useRouter();
	const width = useSectionWidth();
	const trash = segment === "trash";
	const live = useDocuments(false);
	const trashed = useDocuments(true, trash);
	const counts = useDocumentCounts();
	const pending = usePendingDocuments();
	const actions = useDocumentActions();
	const query = trash ? trashed : live;
	const [q, setQ] = useState("");
	const [sort, setSort] = useState<DocumentSort>("edited");
	const [tags, setTags] = useState<string[]>([]);
	const [publicOnly, setPublicOnly] = useState(false);
	const [chosenView, setView] = useState<LibraryView | null>(null);
	const [menuFor, setMenuFor] = useState<DocumentSummary | null>(null);
	const [purgeFor, setPurgeFor] = useState<DocumentSummary | null>(null);

	const view: LibraryView = trash ? "list" : (chosenView ?? (width >= size.wide ? "grid" : "list"));
	const columns = columnsFor(width);
	const all = query.data ?? [];
	const liveRows = live.data ?? [];
	const type = segment === "resume" || segment === "letter" ? segment : "all";
	const filters = { type, q, tags, sort, public: publicOnly } as const;
	// Trash has no search field or chips, so the library's filters never hide a trashed document there.
	const shown = trash
		? filterDocuments(all, { ...filters, type: "all", q: "", tags: [], public: false })
		: filterDocuments(all, filters);
	const unsynced = new Set(pending.map(documentKey));
	const recoverable = trash
		? []
		: pending.filter((document) => !liveRows.some((row) => documentKey(row) === documentKey(document)));

	// Rows get one set of callbacks for the screen's life, so a change re-renders only the row it touches.
	const current: DocumentItemHandlers = {
		onOpen: actions.open,
		onMenu: setMenuFor,
		onTrash: (document) => void actions.trash(document),
		onDuplicate: (document) => void actions.duplicate(document),
		onRestore: (document) => void actions.restore(document),
		onPurge: setPurgeFor,
	};
	const latest = useRef(current);
	useLayoutEffect(() => {
		latest.current = current;
	});
	const [handlers] = useState<DocumentItemHandlers>(() => ({
		onOpen: (document) => latest.current.onOpen(document),
		onMenu: (document) => latest.current.onMenu(document),
		onTrash: (document) => latest.current.onTrash(document),
		onDuplicate: (document) => latest.current.onDuplicate(document),
		onRestore: (document) => latest.current.onRestore(document),
		onPurge: (document) => latest.current.onPurge(document),
	}));

	const clearFilters = () => {
		setQ("");
		setTags([]);
		setPublicOnly(false);
	};
	const refresh = () => Promise.allSettled([query.refetch(), counts.refetch()]);
	const failed = query.isError && !query.data;
	const firstRun = !trash && live.data?.length === 0 && recoverable.length === 0;
	const emptyType = type !== "all" && live.data && !live.data.some((document) => document.type === type) ? type : null;
	const typeEmpty = emptyType !== null;

	let empty = null;
	if (failed) empty = <LoadFailed onRetry={() => void query.refetch()} />;
	else if (!query.data) empty = <LibrarySkeleton view={view} columns={columns} />;
	else if (trash && all.length === 0) empty = <TrashEmpty />;
	else if (firstRun) empty = <FirstRun />;
	else if (emptyType) empty = <TypeEmpty type={emptyType} />;
	else if (shown.length === 0 && all.length > 0) empty = <NoMatches q={q} onClear={clearFilters} />;

	const showToolbar = !trash && !failed && !firstRun && !typeEmpty && all.length > 0;
	const header = (
		<View className="gap-4 pb-4">
			<SegmentHeader
				segment={segment}
				counts={counts.data}
				onChange={(next) => router.setParams({ segment: next === "all" ? undefined : next })}
			/>
			<UnsyncedDocuments documents={recoverable} onOpen={actions.open} />
			{query.isError && query.data ? <RefreshFailed onRetry={() => void query.refetch()} /> : null}
			{showToolbar ? (
				<LibraryToolbar
					q={q}
					onQueryChange={setQ}
					sort={sort}
					onSortChange={setSort}
					tags={collectTags(all)}
					activeTags={tags}
					onTagsChange={setTags}
					showPublic={all.some((document) => document.isPublic)}
					publicOnly={publicOnly}
					onPublicChange={setPublicOnly}
					view={view}
					onViewChange={setView}
				/>
			) : null}
		</View>
	);

	return (
		<View className="flex-1 bg-background" testID="documents-screen">
			<TabTopBar title={trash ? t`Trash` : t`Documents`} />
			<DocumentList
				documents={shown}
				view={view}
				columns={columns}
				busy={actions.busy}
				unsynced={unsynced}
				handlers={handlers}
				header={header}
				empty={empty}
				onRefresh={refresh}
			/>
			<NewFab />
			<LibraryMenu document={menuFor} actions={actions} onClose={() => setMenuFor(null)} onPurge={setPurgeFor} />
			<PurgeDialog
				document={purgeFor}
				onClose={() => setPurgeFor(null)}
				onConfirm={(document) => void actions.purge(document)}
			/>
		</View>
	);
}
