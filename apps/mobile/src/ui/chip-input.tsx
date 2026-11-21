// A list of short values typed one at a time (target roles, places): the field, then each value as a removable tag.
// The return key or a comma adds what was typed; leaving the field keeps it too, so nothing typed is lost.
import { useState } from "react";
import { View } from "react-native";
import { TagGroup } from "./data";
import { Description, Input, Label, TextField } from "./fields";

export type ChipInputProps = {
	label: string;
	values: readonly string[];
	onChange: (values: string[]) => void;
	/** The remove button's name for one value ("Remove Designer"), translated by the caller. */
	removeLabel: (value: string) => string;
	placeholder?: string | undefined;
	description?: string | undefined;
	/** At most this many values; more are ignored. */
	max?: number | undefined;
	/** Each value is cut to this length. */
	maxLength?: number | undefined;
	/** `secondary` on a white surface (card, sheet), as for every field. */
	variant?: "primary" | "secondary" | undefined;
	testID?: string | undefined;
};

/** Adds `text` (split at commas) to `values`: trimmed, cut to `maxLength`, without repeats, up to `max`. */
export function addChips(values: readonly string[], text: string, max = 20, maxLength = 200): string[] {
	const next = [...values];
	for (const part of text.split(",")) {
		const value = part.trim().slice(0, maxLength);
		if (value && !next.some((item) => item.toLowerCase() === value.toLowerCase()) && next.length < max)
			next.push(value);
	}
	return next;
}

export function ChipInput(props: ChipInputProps) {
	const { label, values, onChange, removeLabel, placeholder, description, max = 20, maxLength = 200 } = props;
	const [text, setText] = useState("");

	const commit = (value: string) => {
		if (value.trim()) onChange(addChips(values, value, max, maxLength));
		setText("");
	};

	return (
		<View className="gap-2">
			<TextField isDisabled={values.length >= max}>
				<Label>{label}</Label>
				<Input
					value={text}
					onChangeText={(value) => {
						// A comma ends a value; what follows it keeps being typed.
						const cut = value.lastIndexOf(",");
						if (cut === -1) return setText(value);
						onChange(addChips(values, value.slice(0, cut), max, maxLength));
						setText(value.slice(cut + 1));
					}}
					onSubmitEditing={() => commit(text)}
					onBlur={() => commit(text)}
					submitBehavior="submit"
					returnKeyType="done"
					placeholder={placeholder}
					accessibilityLabel={label}
					{...(props.variant ? { variant: props.variant } : {})}
					testID={props.testID}
				/>
				{description ? <Description>{description}</Description> : null}
			</TextField>
			{values.length > 0 ? (
				<TagGroup
					onRemove={(keys) => onChange(values.filter((value) => !keys.has(value)))}
					variant={props.variant === "secondary" ? "default" : "surface"}
				>
					<TagGroup.List>
						{values.map((value) => (
							<TagGroup.Item
								key={value}
								id={value}
								accessibilityActions={[{ name: "delete", label: removeLabel(value) }]}
								onAccessibilityAction={(event) => {
									if (event.nativeEvent.actionName === "delete") onChange(values.filter((item) => item !== value));
								}}
							>
								<TagGroup.ItemLabel>{value}</TagGroup.ItemLabel>
								<TagGroup.ItemRemoveButton aria-label={removeLabel(value)} />
							</TagGroup.Item>
						))}
					</TagGroup.List>
				</TagGroup>
			) : null}
		</View>
	);
}
