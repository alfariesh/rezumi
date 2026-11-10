import type { Key, ReactNode } from "react";
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

export type { SelectOption };
