import type { DocumentSort, DocumentSummary, DocumentTypeFilter } from "./filter";
import { ActionBar, EmptyState, Segment } from "@heroui-pro/react";
import { Button, Chip, Dropdown, InputGroup, Kbd, Label, Separator, Skeleton, Tag, TagGroup } from "@heroui/react";
import { t } from "@lingui/core/macro";
import { Plural, Trans } from "@lingui/react/macro";
import { useHotkey } from "@tanstack/react-hotkeys";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Icon } from "@rezumi/ui/components/icon";
import { NativeSelect } from "@rezumi/ui/components/native-select";
import { cn } from "@rezumi/utils/style";
import { LinkApplicationDialog, TagsDialog, useBatchActions } from "./document-actions";
import { DocumentCard } from "./document-card";
import { DocumentList, documentKey } from "./document-list";
import { collectTags, filterDocuments } from "./filter";
import { LibraryError } from "./library-error";
import { useStartDocument } from "./use-start-document";
import { PageHeader } from "@/components/layout/page-header";
import { useDialogStore } from "@/dialogs/store";
import { isEditableElementFocused } from "@/features/resume/builder/draft";
import { orpc } from "@/libs/orpc/client";

export type DocumentsSearch = {
	type: DocumentTypeFilter;
	q: string;
	tags: string[];
	/** Only resumes whose public link is on. */
	public?: boolean | undefined;
	sort: DocumentSort;
	view?: "grid" | "list" | undefined;
};

type DocumentsPageProps = {
	search: DocumentsSearch;
	onSearchChange: (patch: Partial<DocumentsSearch>) => void;
};

/**
 * Documents: every resume and letter in one library, with type tabs, search (/), sort, grid or list, and tag
 * chips once tags exist. A file dropped anywhere on the page imports straight away.
 */
export function DocumentsPage({ search, onSearchChange }: DocumentsPageProps) {
	const openDialog = useDialogStore((state) => state.openDialog);
	const searchRef = useRef<HTMLInputElement>(null);
	const [tagsFor, setTagsFor] = useState<DocumentSummary[] | null>(null);
	const [selected, setSelected] = useState<ReadonlySet<string>>(() => new Set());
	const [linkFor, setLinkFor] = useState<DocumentSummary | null>(null);
	// Grid and list animate in only after a switch, never on the page's first render.
	const [viewSwitched, setViewSwitched] = useState(false);
	const {
		data: documents,
		isPending,
		isError,
		isFetching,
		refetch,
	} = useQuery(orpc.documents.list.queryOptions({ input: { trashed: false } }));
	// The library staggers in on its first appearance only; cards that appear later (filters, a new document) don't.
	const [intro, setIntro] = useState(true);
	useEffect(() => {
		if (isPending) return;
		const timeout = setTimeout(() => setIntro(false), INTRO_MS);
		return () => clearTimeout(timeout);
	}, [isPending]);
	const view = search.view ?? readStoredView();
	const setView = (next: "grid" | "list") => {
		setViewSwitched(true);
		storeView(next);
		onSearchChange({ view: next });
	};
	const viewEnter =
		viewSwitched &&
		"transition-[opacity,translate] duration-standard ease-enter starting:translate-y-1 starting:opacity-0";

	useHotkey("/", (event) => {
		if (isEditableElementFocused()) return;
		event.preventDefault();
		searchRef.current?.focus();
	});

	const all = documents ?? [];
	const failed = isError && !documents;
	const firstRun = !isPending && all.length === 0;
	const shown = filterDocuments(all, search);
	const tags = collectTags(all);
	const counts = {
		all: all.length,
		resume: all.filter((document) => document.type === "resume").length,
		letter: all.filter((document) => document.type === "letter").length,
	};
	const hasPublic = all.some((document) => document.isPublic);
	const filtered = search.type !== "all" || search.q.trim() !== "" || search.tags.length > 0 || search.public === true;
	// Actions apply to the selected documents the filters show.
	const selection = shown.filter((document) => selected.has(documentKey(document)));
	const selecting = selection.length > 0;
	const allSelected = selecting && selection.length === shown.length;
	const selectedShown = new Set(selection.map(documentKey));
	const setSelectedFor = (document: DocumentSummary, on: boolean) =>
		setSelected((current) => {
			const next = new Set(current);
			if (on) next.add(documentKey(document));
			else next.delete(documentKey(document));
			return next;
		});
	const selectAll = (on: boolean) => setSelected(new Set(on ? shown.map(documentKey) : []));
	const itemProps = (document: DocumentSummary) => ({
		onTags: (document: DocumentSummary) => setTagsFor([document]),
		onLink: setLinkFor,
		selected: selected.has(documentKey(document)),
		onSelectedChange: (on: boolean) => setSelectedFor(document, on),
		selecting,
	});

	useHotkey("Escape", () => {
		if (!selecting || tagsFor || linkFor || isEditableElementFocused()) return;
		selectAll(false);
	});

	return (
		<div className="mx-auto grid w-full max-w-[1180px] content-start gap-5 px-8 py-8 max-sm:px-4 max-sm:py-5">
			<PageHeader title={<Trans>Documents</Trans>}>
				{!failed && !firstRun && (
					<>
						<Segment
							aria-label={t`Document type`}
							// On a phone the filter spans the row, its three items sharing it.
							className="max-sm:w-full"
							selectedKey={search.type}
							onSelectionChange={(type) => onSearchChange({ type: String(type) as DocumentTypeFilter })}
						>
							<Segment.Item id="all">
								<Trans>All</Trans> <span className="text-xs text-muted tabular-nums">{counts.all}</span>
							</Segment.Item>
							<Segment.Item id="resume">
								<Trans>Resumes</Trans> <span className="text-xs text-muted tabular-nums">{counts.resume}</span>
							</Segment.Item>
							<Segment.Item id="letter">
								<Trans>Letters</Trans> <span className="text-xs text-muted tabular-nums">{counts.letter}</span>
							</Segment.Item>
						</Segment>

						<div className="ms-auto flex flex-wrap items-center gap-2 max-sm:ms-0 max-sm:w-full">
							<InputGroup className="w-60 max-sm:w-full">
								<InputGroup.Prefix>
									<Icon name="magnifying-glass" size={18} />
								</InputGroup.Prefix>
								<InputGroup.Input
									ref={searchRef}
									type="search"
									value={search.q}
									aria-label={t`Search documents`}
									placeholder={t`Search`}
									onChange={(event) => onSearchChange({ q: event.target.value })}
								/>
								<InputGroup.Suffix className="max-sm:hidden pointer-coarse:hidden">
									<Kbd>/</Kbd>
								</InputGroup.Suffix>
							</InputGroup>
							<div className="w-[150px] max-sm:w-auto max-sm:flex-1">
								<NativeSelect
									aria-label={t`Sort`}
									value={search.sort}
									onChange={(event) => onSearchChange({ sort: event.target.value as DocumentSort })}
								>
									<option value="edited">{t`Last edited`}</option>
									<option value="name">{t`Name`}</option>
									<option value="created">{t`Created`}</option>
								</NativeSelect>
							</div>
							<Segment
								aria-label={t`View`}
								className="shrink-0"
								selectedKey={view}
								onSelectionChange={(next) => setView(next as "grid" | "list")}
							>
								<Segment.Item id="grid" aria-label={t`Grid`}>
									<Icon name="squares-four" size={18} variant={view === "grid" ? "duotone" : "stroke"} />
								</Segment.Item>
								<Segment.Item id="list" aria-label={t`List`}>
									<Icon name="list-dashes" size={18} variant={view === "list" ? "duotone" : "stroke"} />
								</Segment.Item>
							</Segment>
						</div>
					</>
				)}
			</PageHeader>

			{isError && <LibraryError retrying={isFetching} onRetry={() => void refetch()} />}

			{failed ? null : firstRun ? (
				<FirstRun onChooseFile={() => openDialog("document.new", undefined)} />
			) : (
				<>
					{(tags.length > 0 || hasPublic) && (
						<TagFilter
							tags={tags}
							active={search.tags}
							onChange={(next) => onSearchChange({ tags: next })}
							showPublic={hasPublic}
							publicOnly={search.public ?? false}
							onPublicChange={(next) => onSearchChange({ public: next })}
						/>
					)}

					{isPending ? (
						<LibrarySkeleton view={view} />
					) : shown.length === 0 ? (
						<EmptyState className="py-16">
							<EmptyState.Header>
								<EmptyState.Media variant="icon">
									<Icon name="magnifying-glass" size={22} />
								</EmptyState.Media>
								<EmptyState.Title>
									{search.q.trim() ? (
										<Trans>Nothing matches “{search.q.trim()}”</Trans>
									) : (
										<Trans>Nothing matches these filters</Trans>
									)}
								</EmptyState.Title>
								<EmptyState.Description className="max-w-xs text-pretty">
									<Trans>Search covers titles, tags and linked applications.</Trans>
								</EmptyState.Description>
							</EmptyState.Header>
							{filtered && (
								<EmptyState.Content>
									<Button
										size="sm"
										variant="secondary"
										onPress={() => onSearchChange({ q: "", tags: [], type: "all", public: false })}
									>
										<Trans>Clear search and filters</Trans>
									</Button>
								</EmptyState.Content>
							)}
						</EmptyState>
					) : view === "list" ? (
						<DocumentList
							documents={shown}
							label={t`Documents`}
							className={viewEnter || undefined}
							onTags={(document) => setTagsFor([document])}
							onLink={setLinkFor}
							selected={selectedShown}
							onSelectedChange={(keys) => setSelected(keys)}
							sort={search.sort}
							onSortChange={(sort) => onSearchChange({ sort })}
						/>
					) : (
						<div className={cn(GRID_CLASS, viewEnter)}>
							{shown.map((document, index) => (
								<DocumentCard
									key={documentKey(document)}
									document={document}
									introIndex={intro ? index : undefined}
									{...itemProps(document)}
								/>
							))}
						</div>
					)}
				</>
			)}

			<SelectionBar
				selection={selection}
				allSelected={allSelected}
				onSelectAll={() => selectAll(true)}
				onClear={() => selectAll(false)}
				onTags={() => setTagsFor(selection)}
			/>
			<DropToImport />
			<TagsDialog documents={tagsFor} onClose={() => setTagsFor(null)} />
			<LinkApplicationDialog document={linkFor} onClose={() => setLinkFor(null)} />
		</div>
	);
}

const VIEW_KEY = "documents-view";
const GRID_CLASS = "grid grid-cols-[repeat(auto-fill,minmax(184px,1fr))] gap-4 max-sm:grid-cols-2 max-sm:gap-3";
// Longest stagger (150ms) plus the D2 entrance (200ms), with room to spare: then the intro classes come off.
const INTRO_MS = 400;

// The last view picked on this device; storage can be unavailable, and then it's the grid.
function readStoredView(): "grid" | "list" {
	try {
		return window.localStorage.getItem(VIEW_KEY) === "list" ? "list" : "grid";
	} catch {
		return "grid";
	}
}

function storeView(view: "grid" | "list") {
	try {
		window.localStorage.setItem(VIEW_KEY, view);
	} catch {
		// A convenience only.
	}
}

/** The first visit: import is the filled button here, and only here. */
function FirstRun({ onChooseFile }: { onChooseFile: () => void }) {
	const { startBlank, trySample, creating } = useStartDocument();

	return (
		<section className="grid max-w-xl gap-4 pt-4 transition-[opacity,translate] duration-emphasized ease-enter starting:translate-y-2 starting:opacity-0">
			<h2 className="text-2xl font-semibold text-foreground">
				<Trans>Let's start with what you have</Trans>
			</h2>
			<p className="leading-6 text-muted">
				<Trans>
					Import your current resume and we'll lay out every section for you to refine. Or start fresh. Start with your
					name. Build from there.
				</Trans>
			</p>
			<div className="flex flex-wrap items-center gap-3 rounded-2xl border border-dashed border-border p-5">
				<Icon name="file-arrow-up" size={24} className="text-muted" />
				<span className="flex-1 text-sm text-muted">
					<Trans>Drop a PDF, Word or JSON file</Trans>
				</span>
				<Button onPress={onChooseFile}>
					<Trans>Choose a file</Trans>
				</Button>
			</div>
			<div className="flex flex-wrap gap-4 text-sm">
				<Button
					variant="ghost"
					size="sm"
					isDisabled={creating}
					className="h-auto px-0 text-link underline-offset-4 hover:underline pointer-coarse:min-h-11"
					onPress={() => void startBlank()}
				>
					<Trans>Start blank</Trans>
				</Button>
				<Button
					variant="ghost"
					size="sm"
					isDisabled={creating}
					className="h-auto px-0 text-link underline-offset-4 hover:underline pointer-coarse:min-h-11"
					onPress={() => void trySample()}
				>
					<Trans>Try a sample</Trans>
				</Button>
			</div>
		</section>
	);
}

type TagFilterProps = {
	tags: string[];
	active: string[];
	onChange: (tags: string[]) => void;
	/** Public appears first once any resume's link is on. */
	showPublic: boolean;
	publicOnly: boolean;
	onPublicChange: (publicOnly: boolean) => void;
};

// Public shares the chip row with the tags; its key can't clash with a tag's.
const PUBLIC_KEY = "public:";
const tagKey = (tag: string) => `tag:${tag}`;

function TagFilter({ tags, active, onChange, showPublic, publicOnly, onPublicChange }: TagFilterProps) {
	const selectedKeys = new Set([...(publicOnly ? [PUBLIC_KEY] : []), ...active.map(tagKey)]);

	return (
		<TagGroup
			aria-label={t`Filter by tag`}
			size="lg"
			selectionMode="multiple"
			selectedKeys={selectedKeys}
			onSelectionChange={(keys) => {
				const next = keys === "all" ? new Set([PUBLIC_KEY, ...tags.map(tagKey)]) : new Set([...keys].map(String));
				if (next.has(PUBLIC_KEY) !== publicOnly) onPublicChange(!publicOnly);
				const nextTags = tags.filter((tag) => next.has(tagKey(tag)));
				if (nextTags.length !== active.length || nextTags.some((tag) => !active.includes(tag))) onChange(nextTags);
			}}
		>
			{/* On a phone the chips stay on one row that scrolls sideways, edge to edge past the page's 16px padding. */}
			<TagGroup.List className="max-sm:-mx-4 max-sm:-my-1 max-sm:[scrollbar-width:none] max-sm:flex-nowrap max-sm:overflow-x-auto max-sm:px-4 max-sm:py-1 max-sm:*:shrink-0">
				{showPublic && (
					<Tag id={PUBLIC_KEY} textValue={t`Public`}>
						<Icon name="globe" size={16} />
						<Trans>Public</Trans>
					</Tag>
				)}
				{tags.map((tag) => (
					<Tag key={tag} id={tagKey(tag)} textValue={tag}>
						#{tag}
					</Tag>
				))}
			</TagGroup.List>
		</TagGroup>
	);
}

type SelectionBarProps = {
	selection: DocumentSummary[];
	allSelected: boolean;
	onSelectAll: () => void;
	onClear: () => void;
	onTags: () => void;
};

/** Floats over the library while documents are selected: tags, visibility, locking and Trash for all of them. */
function SelectionBar({ selection, allSelected, onSelectAll, onClear, onTags }: SelectionBarProps) {
	const batch = useBatchActions();
	const [busy, setBusy] = useState(false);
	const count = selection.length;
	const run = async (action: () => Promise<unknown>, { clear = false } = {}) => {
		setBusy(true);
		try {
			await action();
			if (clear) onClear();
		} finally {
			setBusy(false);
		}
	};

	return (
		<ActionBar aria-label={t`Selected documents`} isOpen={count > 0}>
			<ActionBar.Prefix>
				<Chip size="sm" variant="soft" className="whitespace-nowrap tabular-nums" aria-live="polite">
					<Plural value={count} one="# selected" other="# selected" />
				</Chip>
				{!allSelected && (
					<Button variant="ghost" size="sm" onPress={onSelectAll} className="max-sm:hidden">
						<Trans>Select all</Trans>
					</Button>
				)}
			</ActionBar.Prefix>
			<Separator orientation="vertical" className="h-5" />

			<ActionBar.Content>
				<Button variant="ghost" size="sm" isDisabled={busy} aria-label={t`Tags`} onPress={onTags}>
					<Icon name="tag" />
					<span className="action-bar__label">
						<Trans>Tags</Trans>
					</span>
				</Button>
				<Dropdown>
					<Button variant="ghost" size="sm" isDisabled={busy} aria-label={t`Sharing`}>
						<Icon name="globe" />
						<span className="action-bar__label">
							<Trans>Sharing</Trans>
						</span>
						<Icon name="caret-down" size={14} />
					</Button>
					<Dropdown.Popover placement="top" className="w-48">
						<Dropdown.Menu>
							<Dropdown.Item
								id="public"
								textValue={t`Make public`}
								onAction={() => void run(() => batch.setPublic(selection, true))}
							>
								<Icon name="globe" className="text-muted" />
								<Label>
									<Trans>Make public</Trans>
								</Label>
							</Dropdown.Item>
							<Dropdown.Item
								id="private"
								textValue={t`Make private`}
								onAction={() => void run(() => batch.setPublic(selection, false))}
							>
								<Icon name="eye-slash" className="text-muted" />
								<Label>
									<Trans>Make private</Trans>
								</Label>
							</Dropdown.Item>
							<Separator />
							<Dropdown.Item
								id="lock"
								textValue={t`Lock editing`}
								onAction={() => void run(() => batch.setLocked(selection, true))}
							>
								<Icon name="lock" className="text-muted" />
								<Label>
									<Trans>Lock editing</Trans>
								</Label>
							</Dropdown.Item>
							<Dropdown.Item
								id="unlock"
								textValue={t`Unlock`}
								onAction={() => void run(() => batch.setLocked(selection, false))}
							>
								<Icon name="lock-open" className="text-muted" />
								<Label>
									<Trans>Unlock</Trans>
								</Label>
							</Dropdown.Item>
						</Dropdown.Menu>
					</Dropdown.Popover>
				</Dropdown>
				<Button
					variant="danger-soft"
					size="sm"
					isDisabled={busy}
					aria-label={t`Move to Trash`}
					onPress={() => void run(() => batch.trash(selection), { clear: true })}
				>
					<Icon name="trash" />
					<span className="action-bar__label">
						<Trans>Move to Trash</Trans>
					</span>
				</Button>
			</ActionBar.Content>

			<Separator orientation="vertical" className="h-5" />
			<ActionBar.Suffix>
				<Button isIconOnly size="sm" variant="ghost" aria-label={t`Clear selection`} onPress={onClear}>
					<Icon name="x" />
				</Button>
			</ActionBar.Suffix>
		</ActionBar>
	);
}

function LibrarySkeleton({ view }: { view: "grid" | "list" }) {
	if (view === "list") {
		return (
			<div className="grid">
				<div className="h-9 border-b border-separator" />
				{Array.from({ length: 6 }, (_, index) => (
					<div key={index} className="flex h-[45px] items-center border-b border-separator ps-3">
						<Skeleton className="h-4 w-1/3" />
					</div>
				))}
			</div>
		);
	}
	return (
		<div className={GRID_CLASS}>
			{Array.from({ length: 6 }, (_, index) => (
				<div key={index} className="grid gap-2">
					<Skeleton className="aspect-page rounded-3xl" />
					<Skeleton className="h-4 w-3/4 rounded-lg" />
				</div>
			))}
		</div>
	);
}

/** A file dragged anywhere over the page shows the drop target, and dropping it starts the import. */
function DropToImport() {
	const openDialog = useDialogStore((state) => state.openDialog);
	const [dragging, setDragging] = useState(false);

	useEffect(() => {
		let depth = 0;
		const hasFiles = (event: DragEvent) => Array.from(event.dataTransfer?.types ?? []).includes("Files");
		const onEnter = (event: DragEvent) => {
			if (!hasFiles(event)) return;
			depth += 1;
			setDragging(true);
		};
		const onLeave = () => {
			depth = Math.max(0, depth - 1);
			if (depth === 0) setDragging(false);
		};
		const onOver = (event: DragEvent) => {
			if (hasFiles(event)) event.preventDefault();
		};
		const onDrop = (event: DragEvent) => {
			depth = 0;
			setDragging(false);
			const file = event.dataTransfer?.files[0];
			if (!file) return;
			event.preventDefault();
			// A drop inside an open dialog is that dialog's to handle.
			if (useDialogStore.getState().open) return;
			openDialog("document.new", { file });
		};

		window.addEventListener("dragenter", onEnter);
		window.addEventListener("dragleave", onLeave);
		window.addEventListener("dragover", onOver);
		window.addEventListener("drop", onDrop);
		return () => {
			window.removeEventListener("dragenter", onEnter);
			window.removeEventListener("dragleave", onLeave);
			window.removeEventListener("dragover", onOver);
			window.removeEventListener("drop", onDrop);
		};
	}, [openDialog]);

	return (
		<div
			aria-hidden={!dragging}
			className={cn(
				"pointer-events-none fixed inset-3 z-40 grid place-items-center rounded-2xl border-2 border-dashed border-accent bg-accent-soft/80 transition-[opacity,visibility] ease-enter",
				dragging ? "visible opacity-100 duration-standard" : "invisible opacity-0 duration-[calc(var(--d2)*0.7)]",
			)}
		>
			<div className="grid justify-items-center gap-2 text-center">
				<Icon name="download-simple" size={32} className="text-accent-soft-foreground" />
				<p className="text-lg font-semibold">
					<Trans>Drop to import</Trans>
				</p>
				<p className="text-sm text-muted">
					<Trans>PDF, Word or JSON. We'll build a resume from it.</Trans>
				</p>
			</div>
		</div>
	);
}
