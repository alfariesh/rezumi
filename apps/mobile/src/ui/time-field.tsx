// A wall-clock time on the system picker, the partner of `DatePicker`: Android opens its time dialog, iOS unfolds its
// wheel under the field and folds it again with Done. Times go in and out as `HH:MM` (24 h), never a `Date`, so the
// caller decides which clock (time zone) the time belongs to.
import DateTimePicker, { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import { Description, FieldError, Label, useThemeColor } from "heroui-native";
import { useState } from "react";
import { Platform, Pressable, View } from "react-native";
import { Button } from "./button";
import { cx } from "./cx";
import { Icon } from "./icon";
import { haptics } from "./motion";
import { Text } from "./text";
import { useColorSchemeValue } from "./theme";
import { size } from "./tokens";

const hhmm = /^(\d{2}):(\d{2})$/;

/** "09:30" as a device-local Date on an arbitrary day (only its hours and minutes are read back). */
export function parseTime(value: string | null | undefined): Date | null {
	const match = value ? hhmm.exec(value) : null;
	if (!match) return null;
	const hours = Number(match[1]);
	const minutes = Number(match[2]);
	return hours < 24 && minutes < 60 ? new Date(2000, 0, 1, hours, minutes) : null;
}

/** A Date's device-local hours and minutes as `HH:MM`. */
export function formatTime(date: Date): string {
	const pad = (part: number) => String(part).padStart(2, "0");
	return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export type TimeFieldProps = {
	label: string;
	/** `HH:MM` (24 h), or null when empty. */
	value: string | null;
	onChange: (value: string) => void;
	/** Shown while empty ("Choose a time"). */
	placeholder: string;
	/** The iOS wheel's confirm button ("Done"). */
	doneLabel: string;
	description?: string | undefined;
	/** Shown under the field while `isInvalid`, with the remedy. */
	errorMessage?: string | undefined;
	isInvalid?: boolean | undefined;
	isDisabled?: boolean | undefined;
	/** Minutes the wheel steps by (iOS; Android's dialog ignores it). */
	minuteInterval?: 1 | 5 | 10 | 15 | 30 | undefined;
	/** BCP 47 locale for the shown time and the wheel; the device's by default. */
	locale?: string | undefined;
	/** `secondary` on a white surface, like the other fields. */
	variant?: "primary" | "secondary" | undefined;
	testID?: string | undefined;
};

export function TimeField({
	label,
	value,
	onChange,
	placeholder,
	doneLabel,
	description,
	errorMessage,
	isInvalid = false,
	isDisabled = false,
	minuteInterval = 5,
	locale,
	variant = "primary",
	testID,
}: TimeFieldProps) {
	const [draft, setDraft] = useState<Date | null>(null);
	const accent = useThemeColor("accent");
	const scheme = useColorSchemeValue();
	const time = parseTime(value);
	const shown = time ? new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit" }).format(time) : null;
	const open = draft !== null;

	const commit = (picked: Date) => {
		const next = formatTime(picked);
		setDraft(null);
		if (next === value) return;
		haptics.selection();
		onChange(next);
	};

	const press = () => {
		const start = time ?? new Date(2000, 0, 1, 9, 0);
		if (Platform.OS === "android") {
			DateTimePickerAndroid.open({ value: start, mode: "time", onValueChange: (_event, picked) => commit(picked) });
			return;
		}
		setDraft(open ? null : start);
	};

	return (
		<View className="gap-1.5" testID={testID}>
			<Label isInvalid={isInvalid} isDisabled={isDisabled}>
				{label}
			</Label>
			<Pressable
				onPress={press}
				disabled={isDisabled}
				accessibilityRole="button"
				accessibilityLabel={`${label}, ${shown ?? placeholder}`}
				accessibilityHint={isInvalid ? errorMessage : description}
				accessibilityState={{ disabled: isDisabled, ...(Platform.OS === "ios" ? { expanded: open } : {}) }}
				className={cx(
					"min-h-12 flex-row items-center justify-between gap-2 rounded-field px-3",
					variant === "secondary" ? "bg-background" : "bg-field",
					isInvalid && "border border-danger",
					isDisabled && "opacity-50",
				)}
			>
				<Text size="base" tabular className={cx(!shown && "text-field-placeholder")} numberOfLines={1}>
					{shown ?? placeholder}
				</Text>
				<Icon name="clock" size={size.icon.md} tone="muted" />
			</Pressable>
			{open && Platform.OS === "ios" ? (
				<View className="items-center">
					<DateTimePicker
						value={draft}
						mode="time"
						display="spinner"
						minuteInterval={minuteInterval}
						accentColor={accent}
						themeVariant={scheme}
						{...(locale ? { locale } : {})}
						onValueChange={(_event, picked) => setDraft(picked)}
						testID={testID ? `${testID}-wheel` : undefined}
					/>
					<Button size="sm" variant="secondary" onPress={() => commit(draft)} className="self-end">
						<Button.Label>{doneLabel}</Button.Label>
					</Button>
				</View>
			) : null}
			{description && !isInvalid ? <Description>{description}</Description> : null}
			{errorMessage ? <FieldError isInvalid={isInvalid}>{errorMessage}</FieldError> : null}
		</View>
	);
}
