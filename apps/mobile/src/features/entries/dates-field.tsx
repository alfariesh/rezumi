// Structured dates for an entry: start – end with Present, or one date. Typed the way people write them ("Mar 2022",
// "03/2022", "2022") or picked; a readable value saves as you type and shows in the page's format on blur.
import type { DateFormat, ResumeDates, YearMonth } from "@rezumi/schema/resume/dates";
import { useLingui } from "@lingui/react/macro";
import { useState } from "react";
import { View } from "react-native";
import { getPresentLabel } from "@rezumi/schema/resume/dates";
import { useWriteSource } from "./source";
import {
	editDates,
	fromPickerDate,
	isReversed,
	pickerDate,
	readTypedDate,
	showYearMonth,
} from "@/features/entries/dates";
import { ControlField, Icon, IconButton, InputGroup, Label, MonthPicker, Switch, Text, TextField } from "@/ui";

type MonthInputProps = {
	label: string;
	value: YearMonth | null;
	locale: string;
	format?: DateFormat | undefined;
	disabled?: boolean | undefined;
	autoFocus?: boolean | undefined;
	/** Shown instead of the value ("Present" while ongoing); the field is then read-only. */
	placeholderValue?: string | undefined;
	onCommit: (value: YearMonth | null) => void;
	onInvalid: (invalid: boolean) => void;
};

function MonthInput({
	label,
	value,
	locale,
	format,
	disabled,
	autoFocus,
	placeholderValue,
	onCommit,
	onInvalid,
}: MonthInputProps) {
	const { t } = useLingui();
	const { focus } = useWriteSource();
	const [typed, setTyped] = useState<string | null>(null);
	const [picking, setPicking] = useState(false);
	const fixed = placeholderValue !== undefined;

	const commit = (next: YearMonth | null) => {
		setTyped(null);
		onInvalid(false);
		if (next !== value) onCommit(next);
	};

	return (
		<View className="min-w-0 flex-1">
			<TextField isDisabled={(disabled ?? false) || fixed}>
				<Label>{label}</Label>
				<InputGroup>
					<InputGroup.Input
						variant="secondary"
						accessibilityLabel={label}
						placeholder={t`Mar 2022`}
						value={placeholderValue ?? typed ?? showYearMonth(value, locale, format)}
						editable={!disabled && !fixed}
						autoFocus={(autoFocus ?? false) && !disabled}
						autoComplete="off"
						autoCorrect={false}
						onFocus={focus.onFocus}
						onChangeText={(text) => {
							setTyped(text);
							const next = readTypedDate(text, locale);
							onInvalid(next === undefined);
							if (next !== undefined && next !== value) onCommit(next);
						}}
						onBlur={() => {
							focus.onBlur();
							if (typed === null) return;
							const next = readTypedDate(typed, locale);
							onInvalid(next === undefined);
							if (next !== undefined) setTyped(null);
						}}
					/>
					<InputGroup.Suffix>
						<IconButton
							variant="ghost"
							size="sm"
							icon="calendar-dots"
							label={t`Pick ${label}`}
							isDisabled={(disabled ?? false) || fixed}
							onPress={() => setPicking(true)}
						/>
					</InputGroup.Suffix>
				</InputGroup>
			</TextField>
			<MonthPicker
				isOpen={picking}
				onOpenChange={setPicking}
				title={label}
				value={pickerDate(value)}
				locale={locale}
				onPick={(date) => commit(fromPickerDate(date))}
				onClear={() => commit(null)}
				clearLabel={t`Clear`}
				doneLabel={t`Done`}
				closeLabel={t`Close`}
			/>
		</View>
	);
}

type DatesFieldProps = {
	dates: ResumeDates;
	locale: string;
	format?: DateFormat | undefined;
	/** Awards, certifications and publications have one date. */
	single?: boolean | undefined;
	disabled?: boolean | undefined;
	autoFocus?: boolean | undefined;
	onChange: (dates: ResumeDates) => void;
};

/** Editing any part clears the "needs a look" note left by text that couldn't be read exactly. */
export function DatesField({ dates, locale, format, single = false, disabled, autoFocus, onChange }: DatesFieldProps) {
	const { t } = useLingui();
	const [invalid, setInvalid] = useState({ start: false, end: false });
	const setInvalidFor = (part: "start" | "end") => (next: boolean) =>
		setInvalid((state) => (state[part] === next ? state : { ...state, [part]: next }));

	return (
		<View className="gap-3">
			<View className="flex-row gap-3">
				<MonthInput
					label={single ? t`Date` : t`Start`}
					autoFocus={autoFocus}
					value={dates.start}
					locale={locale}
					format={format}
					disabled={disabled}
					onCommit={(start) => onChange(editDates(dates, { start }))}
					onInvalid={setInvalidFor("start")}
				/>
				{!single ? (
					<MonthInput
						label={t`End`}
						value={dates.end}
						locale={locale}
						format={format}
						disabled={disabled}
						placeholderValue={dates.present ? getPresentLabel(locale) : undefined}
						onCommit={(end) => onChange(editDates(dates, { end }))}
						onInvalid={setInvalidFor("end")}
					/>
				) : null}
			</View>
			{!single ? (
				<ControlField
					isSelected={dates.present}
					isDisabled={disabled ?? false}
					onSelectedChange={(present) => onChange(editDates(dates, { present, end: present ? null : dates.end }))}
				>
					<Label className="flex-1">{t`Present`}</Label>
					<ControlField.Indicator>
						<Switch />
					</ControlField.Indicator>
				</ControlField>
			) : null}
			{invalid.start || invalid.end ? (
				<Note tone="danger">
					{t`This date hasn't been saved. Use a month and year, like Mar 2022, or just a year. The last valid date is kept.`}
				</Note>
			) : dates.raw !== undefined ? (
				<Note tone="warning">
					{dates.start
						? t`We read “${dates.raw}”. Pick a month so it sorts and prints consistently.`
						: t`Couldn't read “${dates.raw}”. Enter the dates so they sort and print consistently.`}
				</Note>
			) : isReversed(dates) ? (
				<Note tone="warning">{t`The end is before the start.`}</Note>
			) : null}
		</View>
	);
}

type NoteProps = { tone: "danger" | "warning"; children: string };

function Note({ tone, children }: NoteProps) {
	return (
		<View accessibilityLiveRegion="polite" className="flex-row gap-1.5">
			<Icon name={tone === "danger" ? "warning-circle" : "warning"} size={16} tone={tone} />
			<Text size="xs" tone={tone} className="flex-1">
				{children}
			</Text>
		</View>
	);
}
