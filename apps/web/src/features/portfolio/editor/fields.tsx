import type { SlashItem } from "./rich-text-editor";
import type { PortfolioAiField } from "@rezumi/schema/portfolio/ai";
import type { IconName } from "@rezumi/ui/components/icon";
import type { ReactNode } from "react";
import { Widget } from "@heroui-pro/react";
import {
	Description,
	FieldError,
	Input,
	Label,
	ListBox,
	Radio,
	Select,
	Skeleton,
	TextArea,
	TextField,
} from "@heroui/react";
import { t } from "@lingui/core/macro";
import { lazy, Suspense, useId, useState } from "react";
import { PORTFOLIO_LIMITS } from "@rezumi/schema/portfolio/limits";
import { isAllowedPortfolioUrl, PORTFOLIO_WEB_PROTOCOLS } from "@rezumi/schema/portfolio/links";
import { IconButton } from "@rezumi/ui/components/icon-button";
import { AiRewriteMenu } from "../ai/rewrite-menu";
import { useDraftText } from "../metrics/use-draft-text";
import { usePortfolioEditorStore } from "./store";
import { WidgetHeading } from "@/components/layout/widget-heading";

const LazyRichTextEditor = lazy(() => import("./rich-text-editor"));

/** Starts loading the rich text editor before a field needs it. */
export function preloadPortfolioRichTextEditor() {
	void import("./rich-text-editor");
}

type PanelGroupProps = {
	icon: IconName;
	title: ReactNode;
	/** Sits at the end of the header: a switch or a short note. */
	action?: ReactNode;
	children: ReactNode;
};

/** One group of the editor's panel: a labelled region with an icon and title, its fields on a card. */
export function PanelGroup({ icon, title, action, children }: PanelGroupProps) {
	const titleId = useId();
	return (
		<Widget role="region" aria-labelledby={titleId}>
			<WidgetHeading id={titleId} icon={icon} title={title} action={action} />
			<Widget.Content className="@container grid gap-4">{children}</Widget.Content>
		</Widget>
	);
}

type TextInputProps = {
	label: string;
	value: string;
	onChange: (value: string) => void;
	maxLength: number;
	placeholder?: string | undefined;
	description?: ReactNode;
	/** What's wrong with the value, shown under the field (which is marked invalid) instead of the description. */
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
	description,
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
			{multiline ? (
				<TextArea variant="secondary" className="min-h-20" {...(placeholder ? { placeholder } : {})} />
			) : (
				<Input variant="secondary" {...(placeholder ? { placeholder } : {})} {...(inputMode ? { inputMode } : {})} />
			)}
			{description && !errorMessage && <Description>{description}</Description>}
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
	description?: ReactNode;
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
	description,
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
			<Input variant="secondary" dir="ltr" placeholder={placeholder ?? "https://"} />
			{description && <Description>{description}</Description>}
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
	description?: ReactNode;
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
	description,
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
			{description && <p className="text-xs text-muted">{description}</p>}
		</div>
	);
}

type ChoiceOption<T extends string> = { id: T; label: string };

type ChoiceSelectProps<T extends string> = {
	label: string;
	value: T;
	options: readonly ChoiceOption<T>[];
	onChange: (value: T) => void;
	description?: ReactNode;
};

/** A labelled pick-one list. */
export function ChoiceSelect<T extends string>({ label, value, options, onChange, description }: ChoiceSelectProps<T>) {
	return (
		<Select
			value={value}
			onChange={(key) => {
				if (typeof key === "string") onChange(key as T);
			}}
			className="grid w-full gap-1.5"
		>
			<Label>{label}</Label>
			<Select.Trigger>
				<Select.Value />
				<Select.Indicator />
			</Select.Trigger>
			{description && <Description>{description}</Description>}
			<Select.Popover>
				<ListBox>
					{options.map((option) => (
						<ListBox.Item key={option.id} id={option.id} textValue={option.label}>
							{option.label}
							<ListBox.ItemIndicator />
						</ListBox.Item>
					))}
				</ListBox>
			</Select.Popover>
		</Select>
	);
}

type ItemToolbarProps = {
	/** Names the item in the buttons' labels: "Move Branding up". */
	name: string;
	index: number;
	count: number;
	onMove: (to: number) => void;
	onRemove: () => void;
	/** Extra buttons before Move up. */
	children?: ReactNode;
};

/** Move up, move down and remove, for one item of a list (the keyboard and screen-reader way to reorder). */
export function ItemToolbar({ name, index, count, onMove, onRemove, children }: ItemToolbarProps) {
	return (
		<div className="flex items-center justify-end gap-0.5">
			{children}
			<IconButton
				icon="arrow-up"
				size="sm"
				label={t`Move ${name} up`}
				isDisabled={index === 0}
				onPress={() => onMove(index - 1)}
			/>
			<IconButton
				icon="arrow-down"
				size="sm"
				label={t`Move ${name} down`}
				isDisabled={index === count - 1}
				onPress={() => onMove(index + 1)}
			/>
			<IconButton icon="trash" size="sm" label={t`Remove ${name}`} className="text-danger" onPress={onRemove} />
		</div>
	);
}

/** Moves an item of a list to `to`, in place. */
export function moveItem<T>(items: T[], from: number, to: number): void {
	if (to < 0 || to >= items.length || from === to) return;
	const [item] = items.splice(from, 1);
	if (item !== undefined) items.splice(to, 0, item);
}

type RadioOptionProps = { value: string; children: ReactNode };

/** One choice of a `RadioGroup`: the dot, then its label. */
export function RadioOption({ value, children }: RadioOptionProps) {
	return (
		<Radio value={value} className="flex min-h-9 items-center rounded-lg px-1 hover:bg-default">
			<Radio.Content className="flex-1 text-sm">
				<Radio.Control>
					<Radio.Indicator />
				</Radio.Control>
				{children}
			</Radio.Content>
		</Radio>
	);
}
