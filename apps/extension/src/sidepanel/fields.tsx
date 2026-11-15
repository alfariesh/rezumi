import type { Key, ReactNode } from "react";
import { Input, Label, ListBox, Select, TextArea } from "@heroui/react";
import { useId } from "react";

/** Small form pieces for the panel, on HeroUI (as the web app's `SelectField`, without its dependencies). */

const NONE = "__none__";
const toKey = (value: string) => (value === "" ? NONE : value);

type SelectFieldProps = {
	label: ReactNode;
	value: string;
	options: readonly { value: string; label: string }[];
	onChange: (value: string) => void;
	isDisabled?: boolean;
};

/** A pick-one field; "" is a real choice ("No resume"). */
export function SelectField({ label, value, options, onChange, isDisabled = false }: SelectFieldProps) {
	return (
		<Select
			fullWidth
			variant="primary"
			value={toKey(value)}
			isDisabled={isDisabled}
			onChange={(key: Key | Key[] | null) => {
				if (typeof key === "string") onChange(key === NONE ? "" : key);
			}}
			className="grid w-full gap-1.5"
		>
			<Label>{label}</Label>
			<Select.Trigger>
				<Select.Value />
				<Select.Indicator />
			</Select.Trigger>
			<Select.Popover>
				<ListBox>
					{options.map((option) => (
						<ListBox.Item key={toKey(option.value)} id={toKey(option.value)} textValue={option.label}>
							{option.label}
							<ListBox.ItemIndicator />
						</ListBox.Item>
					))}
				</ListBox>
			</Select.Popover>
		</Select>
	);
}

type TextFieldProps = {
	label: ReactNode;
	value: string;
	onChange: (value: string) => void;
	maxLength: number;
	type?: "text" | "date";
	isRequired?: boolean;
	isInvalid?: boolean;
	multiline?: boolean;
	rows?: number;
	placeholder?: string;
};

/** A labelled text input (or text area) that keeps what it shows in the parent's state. */
export function TextField({
	label,
	value,
	onChange,
	maxLength,
	type = "text",
	isRequired = false,
	isInvalid = false,
	multiline = false,
	rows = 6,
	placeholder,
}: TextFieldProps) {
	const id = useId();
	return (
		<div className="grid gap-1.5">
			<Label htmlFor={id} isRequired={isRequired}>
				{label}
			</Label>
			{multiline ? (
				<TextArea
					id={id}
					variant="primary"
					fullWidth
					rows={rows}
					value={value}
					maxLength={maxLength}
					{...(placeholder ? { placeholder } : {})}
					{...(isInvalid ? { "aria-invalid": true } : {})}
					onChange={(event) => onChange(event.target.value)}
				/>
			) : (
				<Input
					id={id}
					variant="primary"
					fullWidth
					type={type}
					value={value}
					maxLength={maxLength}
					required={isRequired}
					{...(placeholder ? { placeholder } : {})}
					{...(isInvalid ? { "aria-invalid": true } : {})}
					onChange={(event) => onChange(event.target.value)}
				/>
			)}
		</div>
	);
}
