import type { Key, ReactNode } from "react";
import { CellSelect } from "@heroui-pro/react";
import { Description, Label, ListBox, Select } from "@heroui/react";
import { cn } from "@rezumi/utils/style";

/*
 * HeroUI's Select (a styled trigger and a list in a popover) for a pick-one field, with the string value the platform
 * `<select>` had. "" is a real choice ("No resume", "All"), which a list key can't be, so it travels as `NONE`.
 */

const NONE = "__none__";

type SelectOption = {
	value: string;
	/** What the list and the trigger show. */
	label: ReactNode;
	/** The text typeahead matches and screen readers read; defaults to `label` when that is a string. */
	textValue?: string;
	isDisabled?: boolean;
	/** Shown before the label in a `CellSelectField` (a flag, say), in its list and in its trigger. */
	icon?: ReactNode;
};

type SelectFieldProps = {
	options: readonly SelectOption[];
	/** The chosen option's value; "" with no "" option shows the placeholder. */
	value: string;
	onChange: (value: string) => void;
	placeholder?: string;
	label?: ReactNode;
	"aria-label"?: string;
	description?: ReactNode;
	isRequired?: boolean;
	isDisabled?: boolean;
	isInvalid?: boolean;
	name?: string;
	className?: string;
	/** Classes for the trigger, e.g. a height. */
	triggerClassName?: string;
	/** Classes for the list, e.g. a minimum width when the trigger is narrow. */
	popoverClassName?: string;
	variant?: "primary" | "secondary";
};

const toKey = (value: string) => (value === "" ? NONE : value);

export function SelectField({
	options,
	value,
	onChange,
	label,
	description,
	variant = "secondary",
	className,
	triggerClassName,
	popoverClassName,
	...field
}: SelectFieldProps) {
	const hasEmpty = options.some((option) => option.value === "");

	return (
		<Select
			fullWidth
			variant={variant}
			value={value === "" && !hasEmpty ? null : toKey(value)}
			onChange={(key: Key | Key[] | null) => {
				if (typeof key === "string") onChange(key === NONE ? "" : key);
			}}
			disabledKeys={options.filter((option) => option.isDisabled).map((option) => toKey(option.value))}
			className={cn("grid w-full gap-1.5", className)}
			{...field}
		>
			{label && <Label>{label}</Label>}
			<Select.Trigger className={cn("pointer-coarse:min-h-11", triggerClassName)}>
				<Select.Value />
				<Select.Indicator />
			</Select.Trigger>
			{description && <Description>{description}</Description>}
			<Select.Popover {...(popoverClassName ? { className: popoverClassName } : {})}>
				<ListBox>
					{options.map((option) => (
						<ListBox.Item
							key={toKey(option.value)}
							id={toKey(option.value)}
							textValue={option.textValue ?? (typeof option.label === "string" ? option.label : option.value)}
						>
							{option.label}
							<ListBox.ItemIndicator />
						</ListBox.Item>
					))}
				</ListBox>
			</Select.Popover>
		</Select>
	);
}

type CellSelectFieldProps = {
	options: readonly SelectOption[];
	value: string;
	onChange: (value: string) => void;
	/** The cell's name, at its start; the chosen option shows at its end. */
	label: string;
	isDisabled?: boolean;
	/** Classes for the list, e.g. a minimum width when the cell is narrow. */
	popoverClassName?: string;
};

/**
 * A pick-one field as one compact cell for the editors' panels (HeroUI Pro `CellSelect`): the label at the start, the
 * chosen option and a chevron at the end. Same string value and `""` handling as {@link SelectField}.
 */
export function CellSelectField({
	options,
	value,
	onChange,
	label,
	isDisabled,
	popoverClassName,
}: CellSelectFieldProps) {
	const hasEmpty = options.some((option) => option.value === "");

	return (
		<CellSelect
			aria-label={label}
			value={value === "" && !hasEmpty ? null : toKey(value)}
			onChange={(key: Key | Key[] | null) => {
				if (typeof key === "string") onChange(key === NONE ? "" : key);
			}}
			disabledKeys={options.filter((option) => option.isDisabled).map((option) => toKey(option.value))}
			{...(isDisabled !== undefined && { isDisabled })}
		>
			<CellSelect.Trigger>
				<CellSelect.Label>{label}</CellSelect.Label>
				<CellSelect.Value />
				<CellSelect.Indicator />
			</CellSelect.Trigger>
			<CellSelect.Popover {...(popoverClassName ? { className: popoverClassName } : {})}>
				<ListBox>
					{options.map((option) => (
						<ListBox.Item
							key={toKey(option.value)}
							id={toKey(option.value)}
							textValue={option.textValue ?? (typeof option.label === "string" ? option.label : option.value)}
						>
							{option.icon ? (
								<span className="flex items-center gap-2">
									{option.icon}
									{option.label}
								</span>
							) : (
								option.label
							)}
							<ListBox.ItemIndicator />
						</ListBox.Item>
					))}
				</ListBox>
			</CellSelect.Popover>
		</CellSelect>
	);
}

export type { SelectOption };
