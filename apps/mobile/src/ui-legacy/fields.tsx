import type { ComponentRef, ReactNode } from "react";
import type { TextInputProps } from "react-native";
import { useRef, useState } from "react";
import { I18nManager, Pressable, TextInput, View } from "react-native";
import { Icon } from "./icon";
import { Text } from "./text";
import { useTheme } from "./theme";

export type TextFieldProps = Omit<TextInputProps, "style" | "value" | "onChangeText" | "placeholderTextColor"> & {
	label: string;
	value: string;
	onChangeText: (value: string) => void;
	/** Helper text under the field. Replaced by `error` when there is one. */
	helper?: string | undefined;
	error?: string | undefined;
	/** Shown inside the field at its end, for example a reveal toggle or a unit. */
	trailing?: ReactNode;
	/** Fixed text inside the field before the value, in `ink3`, for example `https://`. */
	prefix?: string | undefined;
	/** Monospace value (keys, URLs, JSON). */
	mono?: boolean | undefined;
};

type FieldProps = {
	label: string;
	helper?: string | undefined;
	error?: string | undefined;
	children: ReactNode;
};

function Field({ label, helper, error, children }: FieldProps) {
	const { colors, size, space } = useTheme();

	return (
		<View style={{ gap: space.s1 + space.s0 }}>
			<Text variant="callout" weight={600} color="ink2">
				{label}
			</Text>
			{children}
			{error ? (
				<View accessibilityRole="alert" style={{ flexDirection: "row", gap: space.s1 + space.s0 }}>
					<Icon name="warning-circle" size={size.icon.meta} color={colors.dangerText} />
					<Text variant="callout" color="dangerText" style={{ flex: 1 }}>
						{error}
					</Text>
				</View>
			) : helper ? (
				<Text variant="callout" color="ink3">
					{helper}
				</Text>
			) : null}
		</View>
	);
}

type InputBoxProps = Omit<TextFieldProps, "label" | "helper"> & {
	accessibilityLabel: string;
	hint?: string | undefined;
	multiline?: boolean | undefined;
};

/** The bordered box: 1 pt `lineStrong`, 2 pt `accent` while focused, 2 pt `dangerText` with an error. */
function InputBox({
	accessibilityLabel,
	hint,
	error,
	trailing,
	prefix,
	mono,
	multiline,
	onFocus,
	onBlur,
	...input
}: InputBoxProps) {
	const { colors, radius, size, space, type } = useTheme();
	const ref = useRef<ComponentRef<typeof TextInput>>(null);
	const [focused, setFocused] = useState(false);
	const border = error ? 2 : focused ? 2 : 1;

	return (
		<Pressable
			accessible={false}
			onPress={() => ref.current?.focus()}
			style={{
				flexDirection: "row",
				alignItems: multiline ? "flex-start" : "center",
				gap: space.s2,
				minHeight: size.input,
				// The thicker focus border eats into the padding, so the text does not move.
				paddingHorizontal: space.s3 - (border - 1),
				paddingVertical: multiline ? space.s3 - (border - 1) : 0,
				borderWidth: border,
				borderColor: error ? colors.dangerText : focused ? colors.accent : colors.lineStrong,
				borderRadius: radius.rLg,
				backgroundColor: colors.raised,
			}}
		>
			{prefix ? (
				<Text variant="bodyLarge" color="ink3">
					{prefix}
				</Text>
			) : null}
			<TextInput
				ref={ref}
				accessibilityLabel={accessibilityLabel}
				accessibilityHint={hint}
				placeholderTextColor={colors.ink3}
				selectionColor={colors.accent}
				cursorColor={colors.accent}
				multiline={multiline}
				textAlignVertical={multiline ? "top" : "center"}
				{...input}
				onFocus={(event) => {
					setFocused(true);
					onFocus?.(event);
				}}
				onBlur={(event) => {
					setFocused(false);
					onBlur?.(event);
				}}
				style={[
					mono ? type.mono : type.bodyLarge,
					{
						flex: 1,
						color: colors.ink,
						paddingVertical: multiline ? 0 : space.s2,
						textAlign: I18nManager.isRTL ? "right" : "left",
					},
				]}
			/>
			{trailing}
		</Pressable>
	);
}

export function TextField({ label, helper, error, ...input }: TextFieldProps) {
	return (
		<Field label={label} helper={helper} error={error}>
			<InputBox
				{...input}
				accessibilityLabel={input.accessibilityLabel ?? label}
				hint={error ?? helper}
				error={error}
			/>
		</Field>
	);
}
