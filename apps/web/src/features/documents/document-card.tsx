import type { DocumentSummary } from "./filter";
import { ContextMenu } from "@heroui-pro/react";
import { cardVariants, Checkbox, Chip, Dropdown, Input } from "@heroui/react";
import { plural, t } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import { Trans } from "@lingui/react/macro";
import { Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Icon } from "@rezumi/ui/components/icon";
import { IconButton } from "@rezumi/ui/components/icon-button";
import { cn } from "@rezumi/utils/style";
import { DocumentMenuContent, useDocumentActions } from "./document-actions";
import { daysLeftInTrash } from "./filter";
import { useNewDocumentsStore } from "./new-documents";
import { ResumeThumbnail } from "./resume-thumbnail";
import { isImeComposing } from "@/libs/keyboard";
import { formatRelativeTime } from "@/libs/locale";
import { ENTER_CLASS, stagger } from "@/libs/motion";

export type DocumentItemProps = {
	document: DocumentSummary;
	onTags: (document: DocumentSummary) => void;
	onLink: (document: DocumentSummary) => void;
	/** Position in the library's first appearance, which staggers in; undefined afterwards and in Trash. */
	introIndex?: number | undefined;
	/** Whether the document is in the selection; Trash has no selection. */
	selected?: boolean | undefined;
	onSelectedChange?: ((selected: boolean) => void) | undefined;
	/** Something is selected, so clicking a card toggles it instead of opening it. */
	selecting?: boolean | undefined;
};

/** "Resume · Edited 2h ago", or the days left for a document in Trash. */
function useDocumentMeta(document: DocumentSummary) {
	const { i18n } = useLingui();
	const type = document.type === "resume" ? t`Resume` : t`Letter`;
	if (document.trashedAt)
		return plural(daysLeftInTrash(document.trashedAt), { one: `${type} · # day left`, other: `${type} · # days left` });
	return t`${type} · Edited ${formatRelativeTime(document.updatedAt, i18n.locale)}`;
}

/** The editor address: resumes and letters share the editor shell. */
export const documentHref = (document: DocumentSummary) =>
	document.type === "resume" ? `/builder/${document.id}` : `/builder/letter/${document.id}`;

/** Opens the document in its editor: resumes and letters share the editor shell. */
function OpenLink({
	document,
	className,
	children,
	label,
	onSelect,
}: Pick<DocumentItemProps, "document"> & {
	className?: string;
	children: React.ReactNode;
	label?: string;
	/** While selecting, a click toggles the document instead of opening it. */
	onSelect?: (() => void) | undefined;
}) {
	const markOpened = useNewDocumentsStore((state) => state.markOpened);
	if (document.trashedAt) return <span className={className}>{children}</span>;
	const onClick = (event: React.MouseEvent) => {
		if (!onSelect) return markOpened(document.id);
		event.preventDefault();
		onSelect();
	};
	const common = { "aria-label": label, className, onClick };

	return document.type === "resume" ? (
		<Link to="/builder/$resumeId" params={{ resumeId: document.id }} {...common}>
			{children}
		</Link>
	) : (
		<Link to="/builder/letter/$coverLetterId" params={{ coverLetterId: document.id }} {...common}>
			{children}
		</Link>
	);
}

type RenameInputProps = { document: DocumentSummary; onDone: () => void };

/**
 * Enter commits, Esc cancels, and leaving the field commits. Keys and clicks stay in the field, so a list row
 * neither toggles its selection nor jumps by typeahead while the name is typed.
 */
export function RenameInput({ document, onDone }: RenameInputProps) {
	const actions = useDocumentActions();
	const [value, setValue] = useState(document.name);
	const commit = () => {
		actions.rename(document, value);
		onDone();
	};
	const stop = (event: React.SyntheticEvent) => event.stopPropagation();

	return (
		<Input
			// oxlint-disable-next-line jsx-a11y/no-autofocus -- renaming starts from the menu, so focus goes straight to the field.
			autoFocus
			fullWidth
			value={value}
			maxLength={100}
			aria-label={t`Name`}
			onChange={(event) => setValue(event.target.value)}
			onFocus={(event) => event.target.select()}
			onBlur={commit}
			onPointerDown={stop}
			onClick={stop}
			onKeyDown={(event) => {
				event.stopPropagation();
				if (isImeComposing(event)) return;
				if (event.key === "Enter") commit();
				if (event.key === "Escape") onDone();
			}}
			className="h-7 min-w-0 px-1.5 text-sm font-semibold"
		/>
	);
}

/** A letter's page, drawn from lines: letters have no thumbnail render. */
function LetterThumbnail({ name }: { name: string }) {
	return (
		<div aria-hidden="true" className="flex size-full flex-col gap-1.5 bg-white p-[14%] text-[0]">
			<span className="h-1.5 w-2/5 rounded-sm bg-[#c9c9c9]" />
			<span className="mb-3 h-1 w-3/5 rounded-sm bg-[#e2e2e2]" />
			<span className="h-1 w-1/3 rounded-sm bg-[#d4d4d4]" />
			{Array.from({ length: 7 }, (_, index) => (
				<span key={index} className={cn("h-1 rounded-sm bg-[#e6e6e6]", index % 3 === 2 ? "w-4/5" : "w-full")} />
			))}
			<span className="mt-2 h-1 w-1/4 rounded-sm bg-[#d4d4d4]" />
			<span className="sr-only">{name}</span>
		</div>
	);
}

/** A status chip on the page thumbnail. The page is white in both themes, so the chip doesn't follow the theme. */
function PaperBadge({ icon, label }: { icon: "globe" | "lock"; label: string }) {
	return (
		<span className="grid size-[22px] place-items-center rounded bg-black/75 text-white" title={label}>
			<Icon name={icon} size={14} />
			<span className="sr-only">{label}</span>
		</span>
	);
}

/** "New" on a document created or imported in this session, until it is opened. */
export function NewChip() {
	return (
		<Chip size="sm" color="accent" variant="primary" className="shrink-0">
			<Trans>New</Trans>
		</Chip>
	);
}

/** A card: the real first page, title with ⋯, "Resume · Edited 2h ago" and the linked application. */
export function DocumentCard({
	document,
	onTags,
	onLink,
	introIndex,
	selected = false,
	onSelectedChange,
	selecting = false,
}: DocumentItemProps) {
	const openDocument = useOpenDocument();
	const [renaming, setRenaming] = useState(false);
	const isNew = useNewDocumentsStore((state) => state.ids.includes(document.id)) && !document.trashedAt;
	const meta = useDocumentMeta(document);
	const menuProps = {
		document,
		onOpen: () => openDocument(document),
		onRename: () => setRenaming(true),
		onTags: () => onTags(document),
		onLink: () => onLink(document),
		onSelect: onSelectedChange && !selected ? () => onSelectedChange(true) : undefined,
	};

	return (
		<ContextMenu>
			<ContextMenu.Trigger<"article">
				render={(props) => <article {...props} />}
				style={introIndex === undefined ? undefined : stagger(introIndex)}
				className={cardVariants({ variant: "default" }).base({
					className: cn(
						"group/card rounded-[20px] p-2 shadow-none ring-0 ring-accent transition-[box-shadow,translate] duration-quick ease-enter hover:-translate-y-0.5 hover:shadow-overlay",
						(isNew || selected) && "ring-2",
						introIndex !== undefined && ENTER_CLASS,
						isNew && "animate-arrive",
						document.trashedAt && "opacity-70",
					),
				})}
			>
				<div className="relative">
					<OpenLink
						document={document}
						label={document.name}
						onSelect={selecting && onSelectedChange ? () => onSelectedChange(!selected) : undefined}
						className={cn(
							"relative block aspect-page overflow-hidden rounded-[12px] bg-white ring-1 ring-separator transition-[scale] duration-quick ease-enter active:scale-[0.98]",
							document.trashedAt && "pointer-events-none",
						)}
					>
						{document.type === "resume" ? (
							<ResumeThumbnail resume={document} />
						) : (
							<LetterThumbnail name={document.name} />
						)}
						<span className="absolute start-2 top-2 flex gap-1">
							{isNew && <NewChip />}
							{document.isPublic && <PaperBadge icon="globe" label={t`Public`} />}
							{document.isLocked && <PaperBadge icon="lock" label={t`Locked`} />}
						</span>
					</OpenLink>
					{onSelectedChange && (
						<Checkbox
							isSelected={selected}
							onChange={onSelectedChange}
							aria-label={t`Select ${document.name}`}
							className={cn(
								"absolute end-2 top-2 transition-opacity duration-quick",
								!selecting && "opacity-0 group-hover/card:opacity-100 focus-within:opacity-100",
							)}
						>
							<Checkbox.Content>
								<Checkbox.Control>
									<Checkbox.Indicator />
								</Checkbox.Control>
							</Checkbox.Content>
						</Checkbox>
					)}
				</div>

				{/* A margin, not a gap: the context-menu trigger makes the card a block, where `gap` does nothing. */}
				<div className="mt-3 flex items-start gap-1 ps-1 pb-0.5">
					<div className="grid min-w-0 flex-1 gap-0.5">
						{renaming ? (
							<RenameInput document={document} onDone={() => setRenaming(false)} />
						) : (
							<h3 className="truncate text-sm leading-5 font-medium text-foreground">{document.name}</h3>
						)}
						<span className="truncate text-xs text-muted">{meta}</span>
						{document.application && (
							<span className="flex min-w-0 items-center gap-1 text-xs text-muted">
								<Icon name="briefcase" size={14} />
								<span className="truncate">{document.application.company}</span>
							</span>
						)}
					</div>
					<Dropdown>
						<IconButton icon="dots-three" label={t`Options for ${document.name}`} size="sm" />
						<DocumentMenuContent {...menuProps} />
					</Dropdown>
				</div>
			</ContextMenu.Trigger>
			<DocumentMenuContent {...menuProps} variant="context" />
		</ContextMenu>
	);
}

/** Open from a menu: resumes in the editor, letters in the letter editor. */
export function useOpenDocument() {
	const navigate = useNavigate();
	return (document: DocumentSummary) => {
		useNewDocumentsStore.getState().markOpened(document.id);
		if (document.type === "letter") {
			void navigate({ to: "/builder/letter/$coverLetterId", params: { coverLetterId: document.id } });
			return;
		}
		void navigate({ to: "/builder/$resumeId", params: { resumeId: document.id } });
	};
}
