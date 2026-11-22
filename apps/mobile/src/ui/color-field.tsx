// A color typed as text (#1a73e8 or rgba(…)) with a swatch of the current one. The caller parses what was typed when
// the field is left or submitted, so the stored format stays the document's; an empty field clears the color.
import { useState } from "react";
import { View } from "react-native";
import { FieldError, Input, Label, TextField } from "./fields";

export type ColorFieldProps = {
	label: string;
	/** The stored color (any color React Native draws, such as `rgba(…)`), or "" for none. */
	value: string;
	/** Gets the trimmed text when the field is left or submitted; returns false when it isn't a color. */
	onChange: (text: string) => boolean;
	/** Shown when the text isn't a color, saying how to fix it ("Enter a color like #1a73e8"). */
	invalidLabel: string;
	placeholder?: string | undefined;
	isDisabled?: boolean | undefined;
	/** On a white surface (a card, a sheet): the field is filled with the page background. */
	variant?: "primary" | "secondary" | undefined;
	testID?: string | undefined;
};

export function ColorField({
	label,
	value,
	onChange,
	invalidLabel,
	placeholder,
	isDisabled = false,
	variant = "secondary",
	testID,
}: ColorFieldProps) {
	const [typed, setTyped] = useState<string | null>(null);
	const [invalid, setInvalid] = useState(false);
	const commit = () => {
		if (typed === null) return;
		const accepted = onChange(typed.trim());
		setInvalid(!accepted);
		if (accepted) setTyped(null);
	};
	const swatch = { backgroundColor: value || "transparent" };

	return (
		<TextField isInvalid={invalid} isDisabled={isDisabled}>
			<Label>{label}</Label>
			<View className="flex-row items-center gap-2">
				<View className="size-11 rounded-field border border-border" style={swatch} />
				<View className="flex-1">
					<Input
						variant={variant}
						accessibilityLabel={label}
						value={typed ?? value}
						placeholder={placeholder}
						editable={!isDisabled}
						autoCapitalize="none"
						autoCorrect={false}
						returnKeyType="done"
						testID={testID}
						onChangeText={setTyped}
						onBlur={commit}
						onSubmitEditing={commit}
					/>
				</View>
			</View>
			{invalid ? <FieldError>{invalidLabel}</FieldError> : null}
		</TextField>
	);
}
