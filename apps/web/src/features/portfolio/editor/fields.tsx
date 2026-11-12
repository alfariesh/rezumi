import type { SlashItem } from "./rich-text-editor";
import type { PortfolioAiField } from "@rezumi/schema/portfolio/ai";
import type { IconName } from "@rezumi/ui/components/icon";
import type { ReactNode } from "react";
import { FieldError, Input, Label, Skeleton, TextArea, TextField } from "@heroui/react";
import { t } from "@lingui/core/macro";
import { lazy, Suspense, useId, useState } from "react";
import { PORTFOLIO_LIMITS } from "@rezumi/schema/portfolio/limits";
import { isAllowedPortfolioUrl, PORTFOLIO_WEB_PROTOCOLS } from "@rezumi/schema/portfolio/links";
import { IconButton } from "@rezumi/ui/components/icon-button";
import { cn } from "@rezumi/utils/style";
import { AiRewriteMenu } from "../ai/rewrite-menu";
import { useDraftText } from "../metrics/use-draft-text";
import { usePortfolioEditorStore } from "./store";
import { INPUT_WITH_ICON, WithInputIcon } from "@/components/input/input-icon";
import { CellSelectField } from "@/components/input/select-field";
import { SortableEdge, SortableHandle, SortableProvider, useSortableItem } from "@/components/input/sortable";
import { GroupSection, useInGroupPanel } from "@/features/resume/editor/chrome/group-nav";
import { PanelSection } from "@/features/resume/editor/chrome/panel-section";

const LazyRichTextEditor = lazy(() => import("./rich-text-editor"));

/** Starts loading the rich text editor before a field needs it. */
export function preloadPortfolioRichTextEditor() {
	void import("./rich-text-editor");
}

type PanelGroupProps = {
	/** The group's anchor in a group panel (Design), which its chip jumps to. */
	id?: string;
	icon: IconName;
	title: ReactNode;
	/** Sits at the end of the header: a switch or a short note. */
	action?: ReactNode;
	children: ReactNode;
};

/**
 * One group of the editor's panel: an icon and title with its fields right under them on the panel, like the resume
 * editor's sections. Inside a group panel (Design) it is a section of the panel card instead.
 */
export function PanelGroup({ id, icon, title, action, children }: PanelGroupProps) {
	const inGroupPanel = useInGroupPanel();
	if (inGroupPanel && id)
		return (
			<GroupSection id={id} icon={icon} title={title} action={action}>
				{children}
			</GroupSection>
		);
	return (
		<PanelSection icon={icon} title={title} action={action} contentClassName="gap-4">
			{children}
		</PanelSection>
	);
}

type TextInputProps = {
	label: string;
	value: string;
	onChange: (value: string) => void;
	maxLength: number;
	placeholder?: string | undefined;
	/** Drawn at the start of the field. */
	icon?: IconName | undefined;
	/** What's wrong with the value, shown under the field, which is marked invalid. */
	errorMessage?: string | undefined;
	multiline?: boolean;
	isDisabled?: boolean;
	type?: "text" | "email" | "tel";
	inputMode?: "text" | "numeric" | "tel";
	onBlur?: () => void;
	/** Offers AI rewriting for this field. */
	rewrite?: PortfolioAiField | undefined;
};

/** A labelled text field that saves as it's typed. `maxLength` matches the server's limit, so typing stops there. */
export function TextInput({
	label,
	value,
	onChange,
	maxLength,
	placeholder,
	icon,
	errorMessage,
	multiline = false,
	isDisabled = false,
	type = "text",
	inputMode,
	onBlur,
	rewrite,
}: TextInputProps) {
	return (
		<TextField
			fullWidth
			type={type}
			value={value}
			maxLength={maxLength}
			isDisabled={isDisabled}
			isInvalid={Boolean(errorMessage)}
			onChange={onChange}
			{...(onBlur ? { onBlur } : {})}
			className="gap-1.5"
		>
			{rewrite ? (
				<div className="flex items-center justify-between gap-2">
					<Label>{label}</Label>
					<AiRewriteMenu field={rewrite} value={value} onResult={onChange} />
				</div>
			) : (
				<Label>{label}</Label>
			)}
			<WithInputIcon icon={icon} {...(multiline && { iconClassName: "top-3 translate-y-0" })}>
				{multiline ? (
					<TextArea
						variant="secondary"
						className={cn("min-h-20", icon && INPUT_WITH_ICON)}
						{...(placeholder ? { placeholder } : {})}
					/>
				) : (
					<Input
						variant="secondary"
						className={cn(icon && INPUT_WITH_ICON)}
						{...(placeholder ? { placeholder } : {})}
						{...(inputMode ? { inputMode } : {})}
					/>
				)}
			</WithInputIcon>
			<FieldError>{errorMessage}</FieldError>
		</TextField>
	);
}

type UrlInputProps = {
	label: string;
	value: string | undefined;
	/** Called with a valid address, or undefined once the field is cleared. */
	onChange: (value: string | undefined) => void;
	/** Whether what's typed is an address that can be used (or nothing), for forms that wait for one. */
	onValidChange?: (valid: boolean) => void;
	/** Web pages only (no mailto:). */
	webOnly?: boolean;
	placeholder?: string | undefined;
	/** Drawn at the start of the field; a link icon by default. */
	icon?: IconName;
	/** Called when the field loses focus, once typing in it is over. */
	onBlur?: () => void;
};

/** Adds https:// to an address typed without one ("linkedin.com/in/nadia"). */
export function normalizePortfolioUrl(text: string): string {
	const trimmed = text.trim();
	if (!trimmed) return "";
	if (/^[a-z][\d+.a-z-]*:/i.test(trimmed)) return trimmed;
	return `https://${trimmed}`;
}

/**
 * An address field: what's typed stays in the field, and only a full, allowed address (or nothing) reaches the data,
 * so a half-typed link never stops the portfolio from saving.
 */
export function UrlInput({
	label,
	value,
	onChange,
	onValidChange,
	webOnly = false,
	placeholder,
	icon = "link-simple-horizontal",
	onBlur,
}: UrlInputProps) {
	// Undo, redo or a reload put another address in the data: the field shows that one.
	const [text, setText] = useDraftText(value ?? "");
	const [touched, setTouched] = useState(false);
	const allowed = (url: string) => isAllowedPortfolioUrl(url, webOnly ? PORTFOLIO_WEB_PROTOCOLS : undefined);
	const normalized = normalizePortfolioUrl(text);
	const valid = normalized === "" || allowed(normalized);

	const change = (next: string) => {
		setText(next);
		const url = normalizePortfolioUrl(next);
		onValidChange?.(url === "" || allowed(url));
		if (url === "") onChange(undefined);
		else if (allowed(url)) onChange(url);
	};

	return (
		<TextField
			fullWidth
			type="url"
			value={text}
			maxLength={PORTFOLIO_LIMITS.text.url}
			isInvalid={touched && !valid}
			onChange={change}
			onBlur={() => {
				setTouched(true);
				onBlur?.();
			}}
			className="gap-1.5"
		>
			<Label>{label}</Label>
			<WithInputIcon icon={icon}>
				<Input variant="secondary" dir="ltr" placeholder={placeholder ?? "https://"} className={INPUT_WITH_ICON} />
			</WithInputIcon>
			<FieldError>
				{webOnly
					? t`Enter a full web address, such as https://example.com.`
					: t`Enter a full address, such as https://example.com or mailto:you@example.com.`}
			</FieldError>
		</TextField>
	);
}

type RichTextFieldProps = {
	label: string;
	value: string;
	onChange: (html: string) => void;
	maxLength: number;
	placeholder?: string | undefined;
	/** Typing "/" opens these (blocks to add after this one). */
	slashItems?: readonly SlashItem[] | undefined;
	/** The label is for screen readers only (the block around it already says what it is). */
	hideLabel?: boolean;
	/** Offers AI rewriting for this field. */
	rewrite?: PortfolioAiField | undefined;
};

/** A labelled rich text field. The editor loads on first use; it starts over after undo, redo or a reload. */
export function RichTextField({
	label,
	value,
	onChange,
	maxLength,
	placeholder,
	slashItems,
	hideLabel = false,
	rewrite,
}: RichTextFieldProps) {
	const revision = usePortfolioEditorStore((state) => state.revision);
	const labelId = useId();
	// The editor keeps its own document: text from AI starts it over, like undo does.
	const [rewrites, setRewrites] = useState(0);

	return (
		<div className="grid gap-1.5">
			<div className="flex items-center justify-between gap-2">
				<span id={labelId} className={hideLabel ? "sr-only" : "text-sm font-medium"}>
					{label}
				</span>
				{rewrite && (
					<span className="ms-auto">
						<AiRewriteMenu
							field={rewrite}
							value={value}
							onResult={(html) => {
								onChange(html);
								setRewrites((count) => count + 1);
							}}
						/>
					</span>
				)}
			</div>
			<Suspense fallback={<Skeleton className="h-44 rounded-2xl" />}>
				<LazyRichTextEditor
					key={`${revision}-${rewrites}`}
					label={label}
					labelledBy={labelId}
					value={value}
					onChange={onChange}
					maxLength={maxLength}
					placeholder={placeholder}
					slashItems={slashItems}
				/>
			</Suspense>
		</div>
	);
}

type ChoiceOption<T extends string> = { id: T; label: string };

type ChoiceSelectProps<T extends string> = {
	label: string;
	value: T;
	options: readonly ChoiceOption<T>[];
	onChange: (value: T) => void;
	/** Something wrong with the choice, said under the cell (not a help text). */
	warning?: ReactNode;
};

/** A pick-one cell: its label at the start, the chosen option at the end. */
export function ChoiceSelect<T extends string>({ label, value, options, onChange, warning }: ChoiceSelectProps<T>) {
	return (
		<>
			<CellSelectField
				label={label}
				value={value}
				options={options.map((option) => ({ value: option.id, label: option.label }))}
				onChange={(next) => onChange(next as T)}
			/>
			{warning && <p className="px-1 text-body-xs text-warning">{warning}</p>}
		</>
	);
}

type SortableListProps = {
	/** The ids of the items in order, so a drop's target can be turned into a place in the list. */
	ids: readonly string[];
	/** Moves the item at `from` to `to`. */
	onMove: (from: number, to: number) => void;
	children: ReactNode;
};

/** A list whose cards can be dragged into a new order (each card is a {@link SortableCard}). */
export function SortableList({ ids, onMove, children }: SortableListProps) {
	return (
		<SortableProvider
			onMove={(id, target) => {
				const from = ids.indexOf(id);
				if (from !== -1) onMove(from, target.index);
			}}
		>
			{children}
		</SortableProvider>
	);
}

type SortableCardProps = {
	/** The item's id in its {@link SortableList}'s `ids`. */
	id: string;
	/** Names the list, so items only drop within their own. */
	list: string;
	index: number;
	/** Names the item in the buttons' labels: "Reorder Branding". */
	name: string;
	onRemove: () => void;
	/** Marks the card for `useRemovalFocus`. */
	itemProps?: Record<string, string>;
	children: ReactNode;
};

/** One item of a list as a bordered card: its fields, then a row with the drag handle and Remove. */
export function SortableCard({ id, list, index, name, onRemove, itemProps, children }: SortableCardProps) {
	const sortable = useSortableItem({ id, list, index, label: name });
	return (
		<div
			{...itemProps}
			{...sortable.dropTargetProps}
			className={cn("relative grid gap-3 rounded-xl border border-separator p-3", sortable.isDragging && "opacity-50")}
		>
			<SortableEdge edge={sortable.edge} />
			{children}
			<div className="flex items-center justify-between">
				<SortableHandle item={sortable} label={t`Reorder ${name}`} className="size-8" />
				<IconButton icon="trash" size="sm" label={t`Remove ${name}`} className="text-danger" onPress={onRemove} />
			</div>
		</div>
	);
}

/** Moves an item of a list to `to`, in place. */
export function moveItem<T>(items: T[], from: number, to: number): void {
	if (to < 0 || to >= items.length || from === to) return;
	const [item] = items.splice(from, 1);
	if (item !== undefined) items.splice(to, 0, item);
}
