import type { ComponentProps } from "react";
import { ComboBox, Input, ListBox } from "@heroui/react";

/*
 * A free-text input with a list of suggestions in a HeroUI popover, in place of `<input list>` and `<datalist>` (the
 * platform's own dropdown). Anything can be typed; picking a suggestion writes it into the field.
 */

type SuggestInputProps = {
	/** Goes to the input, so a `Field`'s label points at it. */
	id?: string | undefined;
	value: string;
	onChange: (value: string) => void;
	suggestions: readonly string[];
	placeholder?: string | undefined;
	"aria-label"?: string | undefined;
	/** The input's own key and blur handlers, e.g. a tag field that adds on Enter. */
	onKeyDown?: ComponentProps<typeof Input>["onKeyDown"];
	onBlur?: ComponentProps<typeof Input>["onBlur"];
};

export function SuggestInput({
	id,
	value,
	onChange,
	suggestions,
	placeholder,
	onKeyDown,
	onBlur,
	...aria
}: SuggestInputProps) {
	const inputProps = {
		...(id !== undefined && { id }),
		...(placeholder !== undefined && { placeholder }),
		...(onKeyDown && { onKeyDown }),
		...(onBlur && { onBlur }),
	};

	return (
		<ComboBox
			fullWidth
			allowsCustomValue
			menuTrigger="focus"
			variant="secondary"
			aria-label={aria["aria-label"] ?? placeholder ?? ""}
			items={suggestions.map((suggestion) => ({ id: suggestion }))}
			inputValue={value}
			onInputChange={onChange}
		>
			<ComboBox.InputGroup>
				<Input {...inputProps} />
				<ComboBox.Trigger />
			</ComboBox.InputGroup>
			<ComboBox.Popover>
				<ListBox>
					{(item: { id: string }) => (
						<ListBox.Item id={item.id} textValue={item.id}>
							{item.id}
							<ListBox.ItemIndicator />
						</ListBox.Item>
					)}
				</ListBox>
			</ComboBox.Popover>
		</ComboBox>
	);
}
