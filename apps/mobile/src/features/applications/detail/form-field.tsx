// A labelled text field for the application forms (sheets are white, so fields take the secondary fill). The input
// carries the label for screen readers, since HeroUI's Label isn't linked to it for VoiceOver.
import type { TextInputProps } from "react-native";
import { FieldError, Input, Label, TextArea, TextField } from "@/ui";

type FormFieldProps = Omit<TextInputProps, "style" | "value" | "onChangeText"> & {
	label: string;
	value: string;
	onChangeText: (value: string) => void;
	/** Shown under the field; also marks it invalid. */
	error?: string | null | undefined;
	multiline?: boolean | undefined;
	isDisabled?: boolean | undefined;
	isRequired?: boolean | undefined;
};

export function FormField({ label, error, multiline, isDisabled, isRequired, ...input }: FormFieldProps) {
	const Control = multiline ? TextArea : Input;
	return (
		<TextField isInvalid={Boolean(error)} isDisabled={isDisabled ?? false} isRequired={isRequired ?? false}>
			<Label>{label}</Label>
			<Control variant="secondary" accessibilityLabel={label} {...input} />
			{error ? <FieldError>{error}</FieldError> : null}
		</TextField>
	);
}
