import type { PageSettings } from "./entries";
import type { Entry, WriteSection } from "./model";
import type { MessageDescriptor } from "@lingui/core";
import type { KeyboardEvent, ReactNode } from "react";
import { Button, Chip, Disclosure, Dropdown, Label, Separator } from "@heroui/react";
import { msg, t } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import { Trans } from "@lingui/react/macro";
import { AnimatePresence, m } from "motion/react";
import { useEffect, useMemo } from "react";
import { useLocale } from "react-aria-components";
import { Icon } from "@rezumi/ui/components/icon";
import { IconButton } from "@rezumi/ui/components/icon-button";
import { toast } from "@rezumi/ui/components/toast";
import { useBreakpoint } from "@rezumi/ui/hooks/use-breakpoint";
import { cn } from "@rezumi/utils/style";
import { useEditorStore } from "../store";
import { EntryFields } from "./entries";
import { useEntry, useEntryWriter } from "./fields";
import { createEntry, describeEntry, getEntries, getPrimaryField, isDraftEntry } from "./model";
import { entryElementId, keepOpenedEntryInView } from "./reveal";
import { useSectionTitle } from "./section-row";
import { SortableEdge, SortableHandle, useSortableItem } from "@/components/input/sortable";
import { useCurrentResume, useResumeStore, useUpdateResumeData } from "@/features/resume/builder/draft";
import { D3, EASE, EXIT } from "@/libs/motion";
import { getCompatibleMoveTargets, getSourceSectionTitle, moveItem } from "@/libs/resume/move-item";

const DRAFT_HINTS: Record<string, MessageDescriptor> = {
	company: msg`Appears on the page once it has a company.`,
	school: msg`Appears on the page once it has a school.`,
	name: msg`Appears on the page once it has a name.`,
	language: msg`Appears on the page once it has a language.`,
	title: msg`Appears on the page once it has a title.`,
	organization: msg`Appears on the page once it has an organization.`,
	network: msg`Appears on the page once it has a network.`,
};

type EntryCardProps = {
	section: WriteSection;
	entryId: string;
	index: number;
	count: number;
	page: PageSettings;
	locked: boolean;
	/** ⌥↑ / ⌥↓ on the title. */
	onMove: (entryId: string, direction: "up" | "down") => void;
};

/**
 * An entry in the outline. Collapsed: its title and "company · location · dates". Open (one at a time, the
 * editor's selection): its fields, saved as you type. Deleting is immediate, with Undo in the toast.
 */
export function EntryCard({ section, entryId, index, count, page, locked, onMove }: EntryCardProps) {
	const { i18n } = useLingui();
	const entry = useEntry(section.id, entryId);
	const write = useEntryWriter(section.id, entryId);
	const open = useEditorStore((state) => state.selection?.kind === "item" && state.selection.itemId === entryId);
	const autoFocus = useEditorStore((state) => state.focusEntryId === entryId);
	const described = entry ? describeEntry(section.type, entry) : null;
	const sortable = useSortableItem({
		id: entryId,
		list: section.id,
		index,
		label: described?.title || t`Untitled`,
		isDisabled: locked,
	});
	const isPhone = useBreakpoint() === "mobile";

	// The first field took focus as it mounted; later openings shouldn't steal focus again.
	useEffect(() => {
		if (autoFocus) useEditorStore.setState({ focusEntryId: null });
	}, [autoFocus]);

	if (!entry || !described) return null;

	const { title, meta } = described;
	const draft = isDraftEntry(section.type, entry);
	const primaryField = getPrimaryField(section.type);
	const hint = draft && primaryField ? DRAFT_HINTS[primaryField] : undefined;

	const toggle = () => {
		useEditorStore.setState({ selection: open ? null : { kind: "item", sectionId: section.id, itemId: entryId } });
		if (!open) keepOpenedEntryInView(entryId);
	};
	const fields = (
		<>
			{hint && <p className="col-span-full text-xs text-muted">{i18n._(hint)}</p>}
			<EntryFields type={section.type} entry={entry} write={write} page={page} autoFocus={autoFocus} />
		</>
	);

	const onTitleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
		if (!event.altKey || (event.key !== "ArrowUp" && event.key !== "ArrowDown")) return;
		event.preventDefault();
		onMove(entryId, event.key === "ArrowUp" ? "up" : "down");
	};

	return (
		<div
			{...sortable.dropTargetProps}
			id={entryElementId(entryId)}
			data-entry-id={entryId}
			className={cn(
				"group/entry relative scroll-mt-[60px] rounded-xl bg-background fields-on-card",
				sortable.isDragging && "opacity-50",
			)}
		>
			<SortableEdge edge={sortable.edge} />
			<div className="flex items-center gap-0.5 pe-1">
				{!locked && (
					<SortableHandle
						item={sortable}
						label={t`Reorder ${title || t`Untitled`}`}
						iconSize={16}
						className="h-10 w-5 opacity-0 transition-opacity duration-quick group-hover/entry:opacity-100 focus-visible:opacity-100"
					/>
				)}
				{/* A raw button: the ⌥↑ / ⌥↓ key handler needs the native element. */}
				<button
					type="button"
					aria-expanded={open}
					aria-label={t`${title || t`Untitled`}, entry ${index + 1} of ${count}`}
					onClick={toggle}
					onKeyDown={onTitleKeyDown}
					className={cn(
						"flex min-w-0 flex-1 cursor-(--cursor-interactive) flex-col items-start gap-0.5 rounded-lg py-2.5 pe-2 text-start outline-none focus-visible:ring-2 focus-visible:ring-focus",
						locked ? "ps-3" : "ps-0.5",
					)}
				>
					<span className="flex max-w-full items-center gap-2">
						<span className={cn("truncate text-sm font-semibold", !title && "text-muted")}>
							{title || <Trans>Untitled</Trans>}
						</span>
						{draft && (
							<Chip size="sm" variant="soft" className="shrink-0">
								<Trans>Draft</Trans>
							</Chip>
						)}
						{entry.hidden && (
							<Chip size="sm" variant="secondary" className="shrink-0">
								<Trans>Hidden</Trans>
							</Chip>
						)}
					</span>
					{meta && <span className="max-w-full truncate text-xs leading-4 text-muted">{meta}</span>}
				</button>

				{open && !locked && (
					<IconButton
						icon="trash"
						label={t`Delete entry`}
						size="sm"
						className="text-muted hover:bg-danger-soft hover:text-danger"
						onPress={() => deleteEntry(section, entryId)}
					/>
				)}
				{!locked && <EntryMenu section={section} entry={entry} />}
			</div>

			{!isPhone && (
				<Disclosure isExpanded={open}>
					<Disclosure.Content>
						<Disclosure.Body>
							<fieldset disabled={locked} className="m-0 grid min-w-0 gap-y-3 border-0 px-3 pt-1 pb-4">
								{fields}
							</fieldset>
						</Disclosure.Body>
					</Disclosure.Content>
				</Disclosure>
			)}

			<AnimatePresence>
				{open && isPhone && (
					<PhoneEntryScreen
						key="entry"
						section={section}
						title={title}
						locked={locked}
						onDelete={() => deleteEntry(section, entryId)}
						onBack={() => useEditorStore.setState({ selection: null })}
					>
						{fields}
					</PhoneEntryScreen>
				)}
			</AnimatePresence>
		</div>
	);
}

type PhoneEntryScreenProps = {
	section: WriteSection;
	title: string;
	locked: boolean;
	onBack: () => void;
	onDelete: () => void;
	children: ReactNode;
};

/** Phones: an open entry pushes in full screen, with a back label naming its section and 44px fields. */
function PhoneEntryScreen({ section, title, locked, onBack, onDelete, children }: PhoneEntryScreenProps) {
	const sectionTitle = useSectionTitle(section);
	// Off-screen at the end edge: the screen pushes in from there and goes back there.
	const offscreen = useLocale().direction === "rtl" ? "translateX(-100%)" : "translateX(100%)";

	return (
		<m.div
			role="dialog"
			aria-label={title || t`Untitled`}
			className="fixed inset-0 z-40 flex flex-col bg-surface pb-[env(safe-area-inset-bottom)]"
			initial={{ transform: offscreen }}
			animate={{ transform: "translateX(0%)", transition: { duration: D3, ease: EASE } }}
			exit={{ transform: offscreen, transition: { duration: D3 * EXIT, ease: EASE } }}
		>
			<div className="flex h-14 shrink-0 items-center gap-1 border-b border-separator px-1.5">
				<Button variant="ghost" size="lg" onPress={onBack} className="gap-0.5 px-2 text-accent-soft-foreground">
					<Icon name="caret-left" size={24} />
					{sectionTitle}
				</Button>
				<span className="min-w-0 flex-1" />
				{!locked && <IconButton icon="trash" label={t`Delete entry`} className="text-danger" onPress={onDelete} />}
			</div>
			<fieldset
				disabled={locked}
				className="m-0 grid min-w-0 flex-1 auto-rows-min gap-y-3 overflow-y-auto border-0 p-4 [&_input]:h-11"
			>
				{children}
			</fieldset>
		</m.div>
	);
}

function deleteEntry(section: WriteSection, entryId: string) {
	const { updateResumeData, undo } = useResumeStore.getState();
	updateResumeData(
		(draft) => {
			const entries = getEntries(draft, section);
			const index = entries.findIndex((entry) => entry.id === entryId);
			if (index !== -1) entries.splice(index, 1);
		},
		{ newStep: true },
	);
	useEditorStore.setState({ selection: null });
	toast.add({ description: t`Entry deleted`, actionProps: { children: t`Undo`, onClick: undo } });
}

type EntryMenuProps = { section: WriteSection; entry: Entry };

/** Hide from page, Duplicate, Move to… and Delete. */
function EntryMenu({ section, entry }: EntryMenuProps) {
	const resume = useCurrentResume();
	const updateResumeData = useUpdateResumeData();
	const customSectionId = section.kind === "custom" ? section.id : undefined;
	const moveTargets = useMemo(
		() => getCompatibleMoveTargets(resume.data, section.type, customSectionId),
		[resume.data, section.type, customSectionId],
	);
	const sourceTitle = useMemo(
		() => getSourceSectionTitle(resume.data, section.type, customSectionId),
		[resume.data, section.type, customSectionId],
	);

	const move = (target: Parameters<typeof moveItem>[1]["target"]) =>
		updateResumeData((draft) => moveItem(draft, { itemId: entry.id, type: section.type, customSectionId, target }), {
			newStep: true,
		});

	const duplicate = () => {
		const copy = { ...structuredClone(entry), id: createEntry(section.type).id } as Entry;
		updateResumeData(
			(draft) => {
				const entries = getEntries(draft, section);
				entries.splice(entries.findIndex((item) => item.id === entry.id) + 1, 0, copy);
			},
			{ newStep: true },
		);
		useEditorStore.setState({ selection: { kind: "item", sectionId: section.id, itemId: copy.id } });
	};

	const toggleHidden = () =>
		updateResumeData(
			(draft) => {
				const target = getEntries(draft, section).find((item) => item.id === entry.id);
				if (target) target.hidden = !target.hidden;
			},
			{ newStep: true },
		);

	return (
		<Dropdown>
			<IconButton icon="dots-three" label={t`Entry options`} size="sm" />
			<Dropdown.Popover placement="bottom end" className="w-56">
				<Dropdown.Menu>
					<Dropdown.Item
						id="hidden"
						textValue={entry.hidden ? t`Show on page` : t`Hide from page`}
						onAction={toggleHidden}
					>
						<Icon name={entry.hidden ? "eye" : "eye-slash"} className="text-muted" />
						<Label>{entry.hidden ? <Trans>Show on page</Trans> : <Trans>Hide from page</Trans>}</Label>
					</Dropdown.Item>
					<Dropdown.Item id="duplicate" textValue={t`Duplicate`} onAction={duplicate}>
						<Icon name="copy" className="text-muted" />
						<Label>
							<Trans>Duplicate</Trans>
						</Label>
					</Dropdown.Item>
					<Dropdown.SubmenuTrigger>
						<Dropdown.Item id="move" textValue={t`Move to…`}>
							<Icon name="arrow-right" className="text-muted" />
							<Label>
								<Trans>Move to…</Trans>
							</Label>
							<Dropdown.SubmenuIndicator />
						</Dropdown.Item>
						<Dropdown.Popover className="w-56">
							<Dropdown.Menu>
								{moveTargets.map(({ pageIndex, sections }) => (
									<Dropdown.SubmenuTrigger key={pageIndex}>
										<Dropdown.Item id={`page-${pageIndex}`} textValue={t`Page ${pageIndex + 1}`}>
											<Icon name="file-text" className="text-muted" />
											<Label>
												<Trans>Page {pageIndex + 1}</Trans>
											</Label>
											<Dropdown.SubmenuIndicator />
										</Dropdown.Item>
										<Dropdown.Popover>
											<Dropdown.Menu>
												{sections.map(({ sectionId, sectionTitle }) => (
													<Dropdown.Item
														key={sectionId}
														id={`section-${sectionId}`}
														textValue={sectionTitle}
														onAction={() => move({ type: "section", sectionId })}
													>
														<Label>{sectionTitle}</Label>
													</Dropdown.Item>
												))}
												{sections.length > 0 && <Separator />}
												<Dropdown.Item
													id="new-section"
													textValue={t`New section`}
													onAction={() => move({ type: "new-section", title: sourceTitle, pageIndex })}
												>
													<Icon name="plus" className="text-muted" />
													<Label>
														<Trans>New section</Trans>
													</Label>
												</Dropdown.Item>
											</Dropdown.Menu>
										</Dropdown.Popover>
									</Dropdown.SubmenuTrigger>
								))}
								<Separator />
								<Dropdown.Item
									id="new-page"
									textValue={t`New page`}
									onAction={() => move({ type: "new-page", title: sourceTitle })}
								>
									<Icon name="file-plus" className="text-muted" />
									<Label>
										<Trans>New page</Trans>
									</Label>
								</Dropdown.Item>
							</Dropdown.Menu>
						</Dropdown.Popover>
					</Dropdown.SubmenuTrigger>
					<Separator />
					<Dropdown.Item
						id="delete"
						textValue={t`Delete`}
						variant="danger"
						onAction={() => deleteEntry(section, entry.id)}
					>
						<Icon name="trash" />
						<Label>
							<Trans>Delete</Trans>
						</Label>
					</Dropdown.Item>
				</Dropdown.Menu>
			</Dropdown.Popover>
		</Dropdown>
	);
}
