import type { Key } from "@heroui/react";
import { Autocomplete, EmptyState, ListBox, SearchField, useFilter } from "@heroui/react";
import { t } from "@lingui/core/macro";
import React from "react";
import { cn } from "@rezumi/utils/style";

type ComboboxOption<TValue extends string | number = string> = {
	value: TValue;
	label: React.ReactNode;
	// Plain-text label used for the collapsed trigger and filtering when `label` is a ReactNode.
	// Without it, a JSX label falls back to String(value) (e.g. a raw enum or locale code) in the trigger.
	textValue?: string;
	keywords?: string[];
	disabled?: boolean;
};

type SingleComboboxProps<TValue extends string | number = string> = {
	options: ComboboxOption<TValue>[];
	value?: TValue | null | undefined;
	defaultValue?: TValue | null | undefined;
	onValueChange?: (value: TValue | null) => void;
	multiple?: false;
	disabled?: boolean;
	showClear?: boolean;
	placeholder?: string;
	emptyMessage?: React.ReactNode;
	className?: string;
	id?: string;
	name?: string;
	// Kept for API compatibility; the trigger is rendered by HeroUI Autocomplete.
	render?: unknown;
};

type MultiComboboxProps<TValue extends string | number = string> = {
	options: ComboboxOption<TValue>[];
	value?: TValue[] | null | undefined;
	defaultValue?: TValue[] | null | undefined;
	onValueChange?: (value: TValue[] | null) => void;
	multiple: true;
	disabled?: boolean;
	showClear?: boolean;
	placeholder?: string;
	emptyMessage?: React.ReactNode;
	className?: string;
	id?: string;
	name?: string;
	// Kept for API compatibility; the trigger is rendered by HeroUI Autocomplete.
	render?: unknown;
};

type ComboboxProps<TValue extends string | number = string> = SingleComboboxProps<TValue> | MultiComboboxProps<TValue>;

function Combobox<TValue extends string | number = string>(props: ComboboxProps<TValue>) {
	const {
		options,
		multiple = false,
		disabled = false,
		showClear = false,
		placeholder,
		emptyMessage,
		className,
		id,
		name,
	} = props;

	const { contains } = useFilter({ sensitivity: "base" });

	const optionMap = new Map(options.map((opt) => [String(opt.value), opt]));
	const textOf = (item: ComboboxOption<TValue>) =>
		item.textValue ?? (typeof item.label === "string" ? item.label : String(item.value));
	const keywordsByText = new Map(options.map((opt) => [textOf(opt), opt.keywords ?? []]));

	const filter = (text: string, input: string) =>
		contains(text, input) || (keywordsByText.get(text)?.some((kw) => contains(kw, input)) ?? false);

	const toKey = (v: TValue | null | undefined) => (v == null ? null : String(v));
	const fromKey = (key: Key) => optionMap.get(String(key))?.value;

	const [internal, setInternal] = React.useState<TValue | TValue[] | null | undefined>(props.defaultValue);
	const controlled = props.value !== undefined;
	const current = controlled ? props.value : internal;

	const hasSelectedValue = multiple
		? Array.isArray(current) && current.length > 0
		: current !== null && current !== undefined;

	const emit = (next: TValue | TValue[] | null) => {
		if (!controlled) setInternal(next);
		if (multiple) (props as MultiComboboxProps<TValue>).onValueChange?.(next as TValue[]);
		else (props as SingleComboboxProps<TValue>).onValueChange?.(next as TValue | null);
	};

	const handleChange = (key: Key | Key[] | null) => {
		if (multiple) {
			const keys = Array.isArray(key) ? key : key === null ? [] : [key];
			emit(keys.flatMap((k) => fromKey(k) ?? []));
			return;
		}
		const single = Array.isArray(key) ? key[0] : key;
		emit(single == null ? null : (fromKey(single) ?? null));
	};

	const value = multiple
		? (Array.isArray(current) ? current : []).map(String)
		: toKey(Array.isArray(current) ? undefined : current);

	return (
		<Autocomplete
			fullWidth
			{...(id ? { id } : {})}
			{...(name ? { name } : {})}
			isDisabled={disabled}
			className={cn("min-w-0", className)}
			placeholder={placeholder ?? t`Select...`}
			selectionMode={multiple ? "multiple" : "single"}
			value={value}
			onChange={handleChange}
		>
			<Autocomplete.Trigger>
				<Autocomplete.Value />
				{showClear && hasSelectedValue && <Autocomplete.ClearButton aria-label={t`Clear selection`} />}
				<Autocomplete.Indicator />
			</Autocomplete.Trigger>
			<Autocomplete.Popover aria-label={placeholder ?? t`Options`}>
				<Autocomplete.Filter filter={filter}>
					<SearchField autoFocus aria-label={placeholder ?? t`Search...`} variant="secondary">
						<SearchField.Group>
							<SearchField.SearchIcon />
							<SearchField.Input placeholder={placeholder ?? t`Search...`} />
							<SearchField.ClearButton />
						</SearchField.Group>
					</SearchField>
					<ListBox renderEmptyState={() => <EmptyState>{emptyMessage ?? t`No results found.`}</EmptyState>}>
						{options.map((item) => (
							<ListBox.Item
								key={String(item.value)}
								id={String(item.value)}
								textValue={textOf(item)}
								isDisabled={Boolean(item.disabled)}
							>
								{item.label}
								<ListBox.ItemIndicator />
							</ListBox.Item>
						))}
					</ListBox>
				</Autocomplete.Filter>
			</Autocomplete.Popover>
		</Autocomplete>
	);
}

export { Combobox, type ComboboxOption, type MultiComboboxProps, type SingleComboboxProps };
