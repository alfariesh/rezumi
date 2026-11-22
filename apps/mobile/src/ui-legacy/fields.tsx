import type { IconName } from "./icon";
import type { ComponentRef, ReactNode } from "react";
import type { TextInputProps } from "react-native";
import { useLingui } from "@lingui/react/macro";
import { useEffect, useRef, useState } from "react";
import { I18nManager, Platform, Pressable, TextInput, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { filterOptions } from "@rezumi/utils/string";
import { Icon } from "./icon";
import { ListRow } from "./layout";
import { Sheet } from "./overlays";
import { Text } from "./text";
import { useTheme } from "./theme";
import { haptics } from "@/ui/motion";

const android = Platform.OS === "android";

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
	minHeight?: number | undefined;
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
	minHeight,
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
				minHeight: minHeight ?? size.input,
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

export type TextAreaProps = Omit<TextFieldProps, "multiline" | "trailing" | "prefix"> & {
	/** Visible lines before the field scrolls. Defaults to 4. */
	minLines?: number | undefined;
};

export function TextArea({ label, helper, error, minLines = 4, ...input }: TextAreaProps) {
	const { space, type } = useTheme();

	return (
		<Field label={label} helper={helper} error={error}>
			<InputBox
				{...input}
				accessibilityLabel={input.accessibilityLabel ?? label}
				hint={error ?? helper}
				error={error}
				multiline
				minHeight={type.bodyLarge.lineHeight * minLines + space.s3 * 2}
			/>
		</Field>
	);
}

export type SelectOption<T extends string> = {
	value: T;
	label: string;
	description?: string | undefined;
	icon?: IconName | undefined;
};

export type SelectSheetProps<T extends string> = {
	label: string;
	value: T | null;
	options: SelectOption<T>[];
	onChange: (value: T) => void;
	placeholder?: string | undefined;
	disabled?: boolean | undefined;
	/** `field` (default) looks like a text field with a caret; `row` is a settings row with the value at its end. */
	appearance?: "field" | "row" | undefined;
	/** Adds a field above the options that filters them by label, for long lists such as countries. */
	searchable?: boolean | undefined;
};

/** A field that opens a sheet of options; picking one closes it. */
export function SelectSheet<T extends string>({
	label,
	value,
	options,
	onChange,
	placeholder,
	disabled,
	appearance = "field",
	searchable,
}: SelectSheetProps<T>) {
	const { t } = useLingui();
	const { colors, radius, size, space } = useTheme();
	const [open, setOpen] = useState(false);
	const [query, setQuery] = useState("");
	const selected = options.find((option) => option.value === value);
	const shown = selected?.label ?? placeholder;
	const listed = searchable ? filterOptions(options, query) : options;
	const close = () => {
		setOpen(false);
		setQuery("");
	};

	return (
		<>
			{appearance === "row" ? (
				<ListRow title={label} value={shown} chevron disabled={disabled} onPress={() => setOpen(true)} />
			) : (
				<Field label={label}>
					<Pressable
						accessibilityRole="button"
						accessibilityLabel={label}
						accessibilityValue={shown ? { text: shown } : undefined}
						accessibilityState={{ disabled: !!disabled, expanded: open }}
						disabled={disabled}
						onPress={() => setOpen(true)}
						android_ripple={{ color: colors.press }}
						style={({ pressed }) => ({
							flexDirection: "row",
							alignItems: "center",
							gap: space.s2,
							minHeight: size.input,
							paddingHorizontal: space.s3,
							borderWidth: 1,
							borderColor: colors.lineStrong,
							borderRadius: radius.rLg,
							backgroundColor: pressed && !android ? colors.sunken : colors.raised,
							overflow: "hidden",
							opacity: disabled ? 0.45 : 1,
						})}
					>
						{selected?.icon ? <Icon name={selected.icon} size={size.icon.row} color={colors.ink2} /> : null}
						<Text variant="bodyLarge" color={selected ? "ink" : "ink3"} style={{ flex: 1 }}>
							{shown}
						</Text>
						<Icon name="caret-down" size={size.icon.meta} color={colors.ink3} />
					</Pressable>
				</Field>
			)}
			<Sheet
				open={open}
				onClose={close}
				title={label}
				padded={false}
				// A long list (languages, countries) scrolls in a half-height sheet that can rise to full.
				detents={options.length > 6 ? [0.5, 0.9] : ["content"]}
			>
				{searchable ? (
					<View style={{ paddingHorizontal: space.s4, paddingBottom: space.s2 }}>
						<InputBox
							accessibilityLabel={t`Search`}
							placeholder={t`Search…`}
							value={query}
							onChangeText={setQuery}
							autoCapitalize="none"
							autoCorrect={false}
							returnKeyType="search"
						/>
					</View>
				) : null}
				{searchable && listed.length === 0 ? (
					<Text color="ink3" style={{ paddingHorizontal: space.s4, paddingVertical: space.s3 }}>
						{t`No matches`}
					</Text>
				) : null}
				<View accessibilityRole="radiogroup">
					{listed.map((option) => (
						<ListRow
							key={option.value}
							title={option.label}
							subtitle={option.description}
							leading={option.icon}
							selected={option.value === value}
							onPress={() => {
								haptics.selection();
								onChange(option.value);
								close();
							}}
						/>
					))}
				</View>
			</Sheet>
		</>
	);
}

export { Switch } from "./switch";

export type SegmentedProps<T extends string> = {
	value: T;
	options: { value: T; label: string; icon?: IconName | undefined }[];
	onChange: (value: T) => void;
	/** The accessible name of the group. */
	label?: string | undefined;
	orientation?: "horizontal" | "vertical";
	/** Size horizontal choices to their content instead of filling the row. */
	compact?: boolean;
};

type SegmentProps = {
	label: string;
	icon?: IconName | undefined;
	active: boolean;
	onPress: () => void;
	stacked: boolean;
	compact: boolean;
};

function Segment({ label, icon, active, onPress, stacked, compact }: SegmentProps) {
	const { colors, motion, radius, shadows, size, space } = useTheme();
	const shown = useSharedValue(active ? 1 : 0);

	useEffect(() => {
		shown.set(withTiming(active ? 1 : 0, { duration: motion.d1 }));
	}, [active, shown, motion.d1]);

	const fill = useAnimatedStyle(() => ({ opacity: shown.get() }));

	return (
		<Pressable
			accessibilityRole="radio"
			accessibilityLabel={label}
			accessibilityState={{ checked: active }}
			onPress={onPress}
			// 40 pt inside the track's 2 pt padding; the slop brings the target to 44.
			hitSlop={{ top: space.s0, bottom: space.s0 }}
			style={{
				flex: stacked || compact ? undefined : 1,
				minHeight: size.hit - space.s0 * 2,
				flexDirection: "row",
				alignItems: "center",
				justifyContent: "center",
				gap: space.s1 + space.s0,
				paddingHorizontal: space.s3,
				paddingVertical: stacked ? space.s2 : undefined,
			}}
		>
			<Animated.View
				style={[
					{
						position: "absolute",
						top: 0,
						bottom: 0,
						start: 0,
						end: 0,
						borderRadius: radius.rMd,
						backgroundColor: colors.raised,
						boxShadow: shadows.e1.boxShadow,
					},
					fill,
				]}
			/>
			{icon ? <Icon name={icon} size={size.icon.meta} color={active ? colors.ink : colors.ink2} /> : null}
			<Text variant="callout" weight={active ? 600 : 400} color={active ? "ink" : "ink2"} align="center">
				{label}
			</Text>
		</Pressable>
	);
}

export function Segmented<T extends string>({
	value,
	options,
	onChange,
	label,
	orientation = "horizontal",
	compact = false,
}: SegmentedProps<T>) {
	const { colors, radius, space } = useTheme();
	const stacked = orientation === "vertical";

	return (
		<View
			accessibilityRole="radiogroup"
			accessibilityLabel={label}
			style={{
				flexDirection: stacked ? "column" : "row",
				gap: space.s0,
				padding: space.s0,
				borderRadius: radius.rLg,
				backgroundColor: colors.sunken,
			}}
		>
			{options.map((option) => (
				<Segment
					key={option.value}
					label={option.label}
					icon={option.icon}
					active={option.value === value}
					stacked={stacked}
					compact={compact}
					onPress={() => {
						if (option.value === value) return;
						haptics.selection();
						onChange(option.value);
					}}
				/>
			))}
		</View>
	);
}

/** A 32 pt pill whose touch target reaches 44 pt through `hitSlop`. */
