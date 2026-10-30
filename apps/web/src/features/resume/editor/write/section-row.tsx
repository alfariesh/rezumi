import type { WriteSection } from "./model";
import type { SectionType } from "@rezumi/schema/resume/data";
import type { KeyboardEvent, ReactNode } from "react";
import type { Selection } from "react-aria-components";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Chip, Disclosure, Dropdown, Label, Separator } from "@heroui/react";
import { i18n } from "@lingui/core";
import { plural, t } from "@lingui/core/macro";
import { Plural, Trans } from "@lingui/react/macro";
import { useState } from "react";
import { sortSectionItemsByPeriod } from "@rezumi/resume/section-sort";
import { Icon } from "@rezumi/ui/components/icon";
import { IconButton } from "@rezumi/ui/components/icon-button";
import { toast } from "@rezumi/ui/components/toast";
import { formatList } from "@rezumi/utils/locale";
import { cn } from "@rezumi/utils/style";
import { pendingProposals } from "../proposals/proposals";
import { useEditorStore } from "../store";
import { addEntryTo } from "./actions";
import { countEntriesToCheck, getEntries, getSectionObject } from "./model";
import { IconPicker } from "@/components/input/icon-picker";
import { useCurrentBuilderResumeSelector, useResumeStore, useUpdateResumeData } from "@/features/resume/builder/draft";
import { usePrompt } from "@/hooks/use-confirm";
import { DRAG_SETTLE } from "@/libs/motion";
import { getSectionTitle } from "@/libs/resume/section";

/** The printed title: the one the user gave, else the section type's name. */
export function useSectionTitle(section: WriteSection) {
	const title = useCurrentBuilderResumeSelector((resume) => getSectionObject(resume.data, section)?.title ?? "");
	return (
		title.trim() || getSectionTitle(section.kind === "custom" ? section.type : (section.id as SectionType | "summary"))
	);
}

type SectionRowProps = {
	section: WriteSection;
	locked: boolean;
	/** ⌥↑ / ⌥↓ on the focused title. Hidden sections sit outside the print order, so they have none. */
	onMove?: ((direction: "up" | "down") => void) | undefined;
	children: ReactNode;
};

/**
 * An outline row: drag handle, title (opens the section), entry count, the eye (hidden sections keep their
 * content but aren't printed), the chevron and the ⋯ menu. Open, it shows the section's entries.
 */
export function SectionRow({ section, locked, onMove, children }: SectionRowProps) {
	const title = useSectionTitle(section);
	const hidden = useCurrentBuilderResumeSelector((resume) => getSectionObject(resume.data, section)?.hidden ?? false);
	const count = useCurrentBuilderResumeSelector((resume) => getEntries(resume.data, section).length);
	// Dates read from text that wasn't exact ask for a look (they print as typed until then).
	const toCheck = useCurrentBuilderResumeSelector((resume) => countEntriesToCheck(getEntries(resume.data, section)));
	const proposed = useProposedCount(section.id);
	const open = useEditorStore((state) => state.openSections.includes(section.id));
	const setOpen = useEditorStore((state) => state.setSectionOpen);
	const updateResumeData = useUpdateResumeData();
	const { setNodeRef, transform, transition, isDragging, attributes, listeners } = useSortable({
		id: section.id,
		disabled: locked || hidden,
		transition: DRAG_SETTLE,
	});

	const toggleHidden = () =>
		updateResumeData(
			(draft) => {
				const target = getSectionObject(draft, section);
				if (target) target.hidden = !target.hidden;
			},
			{ newStep: true },
		);

	const onTitleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
		if (!event.altKey || (event.key !== "ArrowUp" && event.key !== "ArrowDown")) return;
		event.preventDefault();
		onMove?.(event.key === "ArrowUp" ? "up" : "down");
	};

	return (
		<div
			ref={setNodeRef}
			id={`sidebar-${section.id}`}
			data-section-id={section.id}
			style={{ transform: CSS.Translate.toString(transform), transition: transition }}
			className={cn(
				"relative scroll-mt-[60px] rounded-lg transition-shadow duration-quick ease-enter",
				isDragging && "z-10 bg-raised shadow-e2",
			)}
		>
			<div className="group/row flex h-11 items-center gap-0.5 rounded-lg pe-1 hover:bg-hover">
				<button
					type="button"
					aria-label={t`Reorder ${title}`}
					disabled={locked || hidden}
					className={cn(
						"flex h-11 w-7 shrink-0 cursor-grab items-center justify-center text-ink-3 active:cursor-grabbing disabled:cursor-default",
						hidden && "opacity-40",
					)}
					{...attributes}
					{...listeners}
				>
					<Icon name="dots-six-vertical" size={18} />
				</button>

				<button
					type="button"
					aria-expanded={open}
					onClick={() => setOpen(section.id, !open)}
					onKeyDown={onTitleKeyDown}
					className={cn(
						"min-w-0 flex-1 truncate rounded-md py-1 text-start text-sm font-medium",
						hidden && "text-ink-3 line-through",
					)}
				>
					{title}
				</button>

				{proposed > 0 && (
					<Chip size="sm" color="accent" variant="soft" className="shrink-0">
						<Plural value={proposed} one="# proposed" other="# proposed" />
					</Chip>
				)}
				{toCheck > 0 && (
					<Chip size="sm" color="warning" variant="soft" className="shrink-0">
						<Plural value={toCheck} one="# to check" other="# to check" />
					</Chip>
				)}
				{section.kind !== "summary" && (
					<span className="px-1 font-mono text-xs text-ink-3">
						<span aria-hidden="true">{count}</span>
						<span className="sr-only">{plural(count, { one: "# entry", other: "# entries" })}</span>
					</span>
				)}

				<IconButton
					icon={hidden ? "eye-slash" : "eye"}
					label={hidden ? t`Show ${title} on the page` : t`Hide ${title} from the page`}
					aria-pressed={hidden}
					size="sm"
					isDisabled={locked}
					className="text-ink-2"
					onPress={toggleHidden}
				/>
				<IconButton
					icon="caret-down"
					label={open ? t`Close ${title}` : t`Open ${title}`}
					size="sm"
					className={cn("text-ink-2 transition-transform duration-standard ease-enter", open && "rotate-180")}
					onPress={() => setOpen(section.id, !open)}
				/>
				{!locked && <SectionMenu section={section} title={title} onMove={onMove} />}
			</div>

			<Disclosure isExpanded={open}>
				<Disclosure.Content>
					<Disclosure.Body>
						<div className="grid gap-2 ps-[26px] pt-1 pb-3">{children}</div>
					</Disclosure.Body>
				</Disclosure.Content>
			</Disclosure>
		</div>
	);
}

type SectionMenuProps = Pick<SectionRowProps, "section" | "onMove"> & { title: string };

/** Everything else a section can do: add, sort, heading, rename, icon, layout and reset or delete. */
function SectionMenu({ section, title, onMove }: SectionMenuProps) {
	const prompt = usePrompt();
	const updateResumeData = useUpdateResumeData();
	const settings = useCurrentBuilderResumeSelector((resume) => getSectionObject(resume.data, section) ?? null);
	const locale = useCurrentBuilderResumeSelector((resume) => resume.data.metadata.page.locale);
	const [iconPickerOpen, setIconPickerOpen] = useState(false);
	if (!settings) return null;

	const edit = (mutate: (target: NonNullable<ReturnType<typeof getSectionObject>>) => void) =>
		updateResumeData(
			(draft) => {
				const target = getSectionObject(draft, section);
				if (target) mutate(target);
			},
			{ newStep: true },
		);

	const undoToast = (description: string) =>
		toast.add({ description, actionProps: { children: t`Undo`, onClick: () => useResumeStore.getState().undo() } });

	const isSkills = section.type === "skills";
	const canSort = section.type === "experience" || section.type === "education";
	const columns =
		isSkills && (settings as { layout?: string }).layout === "inline" ? "inline" : String(settings.columns);

	const sortByDate = () => {
		let unresolved: string[] = [];
		updateResumeData(
			(draft) => {
				const entries = getEntries(draft, section) as never as {
					id: string;
					period: string;
					company?: string;
					school?: string;
				}[];
				const result = sortSectionItemsByPeriod(entries, locale);
				unresolved = result.unresolvedIds.map((id) => {
					const entry = entries.find((item) => item.id === id);
					return (entry?.company || entry?.school || id).trim();
				});
				entries.splice(0, entries.length, ...result.items);
			},
			{ newStep: true },
		);
		if (unresolved.length > 0) {
			const entries = formatList(i18n.locale, unresolved);
			toast.add({
				type: "warning",
				description: t`Couldn't read the dates on ${entries}, so they stay at the end. Fix their dates and sort again.`,
			});
		}
	};

	const rename = async () => {
		const next = await prompt(t`Rename section`, {
			description: t`Leave it empty to use the original title.`,
			defaultValue: settings.title,
		});
		if (next === null || next === settings.title) return;
		edit((target) => {
			target.title = next;
		});
	};

	const reset = () => {
		edit((target) => {
			if ("items" in target) target.items = [];
			else target.content = "";
		});
		undoToast(t`${title} cleared`);
	};

	const remove = () => {
		updateResumeData(
			(draft) => {
				draft.customSections = draft.customSections.filter((custom) => custom.id !== section.id);
				for (const page of draft.metadata.layout.pages) {
					page.main = page.main.filter((id) => id !== section.id);
					page.sidebar = page.sidebar.filter((id) => id !== section.id);
				}
			},
			{ newStep: true },
		);
		undoToast(t`${title} deleted`);
	};

	return (
		<span className="relative">
			<Dropdown>
				<IconButton icon="dots-three" label={t`Options for ${title}`} size="sm" />
				<Dropdown.Popover placement="bottom end" className="w-60">
					<Dropdown.Menu>
						{section.kind !== "summary" && (
							<Dropdown.Item id="add" textValue={t`Add entry`} onAction={() => addEntryTo(section)}>
								<Icon name="plus" className="text-muted" />
								<Label>
									<Trans>Add entry</Trans>
								</Label>
							</Dropdown.Item>
						)}
						{canSort && (
							<Dropdown.Item id="sort" textValue={t`Sort by date`} onAction={sortByDate}>
								<Icon name="arrow-down" className="text-muted" />
								<Label>
									<Trans>Sort by date</Trans>
								</Label>
							</Dropdown.Item>
						)}
						{onMove && (
							<Dropdown.Item id="up" textValue={t`Move up`} onAction={() => onMove("up")}>
								<Icon name="arrow-up" className="text-muted" />
								<Label>
									<Trans>Move up</Trans>
								</Label>
							</Dropdown.Item>
						)}
						{onMove && (
							<Dropdown.Item id="down" textValue={t`Move down`} onAction={() => onMove("down")}>
								<Icon name="arrow-down" className="text-muted" />
								<Label>
									<Trans>Move down</Trans>
								</Label>
							</Dropdown.Item>
						)}
						<Dropdown.Item id="rename" textValue={t`Rename…`} onAction={() => void rename()}>
							<Icon name="pencil-simple" className="text-muted" />
							<Label>
								<Trans>Rename…</Trans>
							</Label>
						</Dropdown.Item>
						<Dropdown.Item id="icon" textValue={t`Icon…`} onAction={() => setIconPickerOpen(true)}>
							<Icon name="bookmark-simple" className="text-muted" />
							<Label>
								<Trans>Icon…</Trans>
							</Label>
						</Dropdown.Item>
						<Dropdown.Section
							selectionMode="multiple"
							selectedKeys={new Set(settings.showHeading !== false ? ["heading"] : [])}
							onSelectionChange={(keys) => {
								const showHeading = has(keys, "heading");
								edit((target) => {
									target.showHeading = showHeading;
								});
							}}
						>
							<Dropdown.Item id="heading" textValue={t`Show heading`}>
								<Label>
									<Trans>Show heading</Trans>
								</Label>
								<Dropdown.ItemIndicator />
							</Dropdown.Item>
						</Dropdown.Section>
						<Separator />
						<Dropdown.SubmenuTrigger>
							<Dropdown.Item id="columns" textValue={t`Columns`}>
								<Icon name="squares-four" className="text-muted" />
								<Label>
									<Trans>Columns</Trans>
								</Label>
								<Dropdown.SubmenuIndicator />
							</Dropdown.Item>
							<Dropdown.Popover>
								<Dropdown.Menu
									selectionMode="single"
									disallowEmptySelection
									selectedKeys={new Set([columns])}
									onSelectionChange={(keys) => {
										const value = first(keys);
										if (value === undefined) return;
										edit((target) => {
											const skills = target as { layout?: string };
											if (isSkills) skills.layout = value === "inline" ? "inline" : "default";
											target.columns = value === "inline" ? 1 : Number(value);
										});
									}}
								>
									{[1, 2, 3, 4, 5, 6].map((column) => (
										<Dropdown.Item
											key={column}
											id={String(column)}
											textValue={plural(column, { one: "# column", other: "# columns" })}
										>
											<Label>
												<Plural value={column} one="# column" other="# columns" />
											</Label>
											<Dropdown.ItemIndicator type="dot" />
										</Dropdown.Item>
									))}
									{isSkills && (
										<Dropdown.Item id="inline" textValue={t`1 column, inline`}>
											<Label>
												<Trans>1 column, inline</Trans>
											</Label>
											<Dropdown.ItemIndicator type="dot" />
										</Dropdown.Item>
									)}
								</Dropdown.Menu>
							</Dropdown.Popover>
						</Dropdown.SubmenuTrigger>
						{isSkills && (
							<Dropdown.SubmenuTrigger>
								<Dropdown.Item id="keywords" textValue={t`Keyword layout`}>
									<Icon name="list-bullets" className="text-muted" />
									<Label>
										<Trans>Keyword layout</Trans>
									</Label>
									<Dropdown.SubmenuIndicator />
								</Dropdown.Item>
								<Dropdown.Popover>
									<Dropdown.Menu
										selectionMode="single"
										disallowEmptySelection
										selectedKeys={new Set([(settings as { keywordLayout?: string }).keywordLayout ?? "inline"])}
										onSelectionChange={(keys) => {
											const value = first(keys);
											if (value === undefined) return;
											edit((target) => {
												(target as { keywordLayout?: string }).keywordLayout = value;
											});
										}}
									>
										<Dropdown.Item id="inline" textValue={t`Inline`}>
											<Label>
												<Trans>Inline</Trans>
											</Label>
											<Dropdown.ItemIndicator type="dot" />
										</Dropdown.Item>
										<Dropdown.Item id="list" textValue={t`Bulleted list`}>
											<Label>
												<Trans>Bulleted list</Trans>
											</Label>
											<Dropdown.ItemIndicator type="dot" />
										</Dropdown.Item>
									</Dropdown.Menu>
								</Dropdown.Popover>
							</Dropdown.SubmenuTrigger>
						)}
						<Dropdown.Section
							selectionMode="multiple"
							selectedKeys={
								new Set([
									...(settings.keepTogether ? ["together"] : []),
									...(settings.startOnNewPage ? ["newPage"] : []),
								])
							}
							onSelectionChange={(keys) => {
								const keepTogether = has(keys, "together");
								const startOnNewPage = has(keys, "newPage");
								edit((target) => {
									target.keepTogether = keepTogether;
									target.startOnNewPage = startOnNewPage;
								});
							}}
						>
							<Dropdown.Item id="together" textValue={t`Keep on one page`}>
								<Label>
									<Trans>Keep on one page</Trans>
								</Label>
								<Dropdown.ItemIndicator />
							</Dropdown.Item>
							<Dropdown.Item id="newPage" textValue={t`Start on a new page`}>
								<Label>
									<Trans>Start on a new page</Trans>
								</Label>
								<Dropdown.ItemIndicator />
							</Dropdown.Item>
						</Dropdown.Section>
						<Separator />
						<Dropdown.Item
							id="danger"
							textValue={section.kind === "custom" ? t`Delete section` : t`Clear section`}
							variant="danger"
							onAction={section.kind === "custom" ? remove : reset}
						>
							<Icon name="trash" />
							<Label>{section.kind === "custom" ? <Trans>Delete section</Trans> : <Trans>Clear section</Trans>}</Label>
						</Dropdown.Item>
					</Dropdown.Menu>
				</Dropdown.Popover>
			</Dropdown>

			{/* The icon grid opens from the ⋯ button: an invisible trigger laid over it anchors the popover. */}
			<IconPicker
				value={settings.icon === "none" ? "" : settings.icon}
				onChange={(icon) => {
					edit((target) => {
						target.icon = icon === "" ? "none" : icon;
					});
					setIconPickerOpen(false);
				}}
				popoverProps={{ open: iconPickerOpen, onOpenChange: setIconPickerOpen }}
				aria-hidden
				tabIndex={-1}
				className="pointer-events-none absolute inset-0 size-full opacity-0"
			/>
		</span>
	);
}

const has = (keys: Selection, key: string) => keys === "all" || keys.has(key);
const first = (keys: Selection) => {
	const [key] = keys === "all" ? [] : keys;
	return typeof key === "string" ? key : undefined;
};

const NONE: readonly never[] = [];

/** The assistant's pending edits in a section, while the assistant is open: "2 proposed". */
function useProposedCount(sectionId: string) {
	const proposals = useEditorStore((state) => (state.assistantOpen ? state.assistantProposals : NONE));
	const data = useCurrentBuilderResumeSelector((resume) => resume.data);
	return pendingProposals(data, proposals, sectionId).length;
}
