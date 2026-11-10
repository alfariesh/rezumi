import type { Time } from "@internationalized/date";
import type { ReactNode } from "react";
import { Calendar, DateField, DatePicker, Description, Label, TimeField } from "@heroui/react";
import { parseDate, parseTime } from "@internationalized/date";
import { useId } from "react";
import { cn } from "@rezumi/utils/style";

/*
 * HeroUI's DatePicker and TimeField with the app's string values, so a field that held `<input type="date">`'s
 * "2026-11-10" (or `type="time"`'s "09:30") keeps its state and changes only its markup. An empty string is no value.
 * Their segments and calendar follow the app's language (`AriaI18nProvider` in the root route).
 */

type FieldProps = {
	/** The visible label. Without one, pass `aria-label`. */
	label?: ReactNode;
	"aria-label"?: string;
	description?: ReactNode;
	isRequired?: boolean;
	isDisabled?: boolean;
	isInvalid?: boolean;
	/** Focus left the field (the date or time segments, or the calendar button). */
	onBlur?: () => void;
	name?: string;
	className?: string;
	variant?: "primary" | "secondary";
};

function toCalendarDate(value: string | undefined) {
	if (!value) return null;
	try {
		return parseDate(value);
	} catch {
		return null;
	}
}

function toTime(value: string | undefined) {
	if (!value) return null;
	try {
		return parseTime(value);
	} catch {
		return null;
	}
}

/** "09:30": a `Time` as `<input type="time">` writes it. */
function formatTime(time: Time) {
	return `${String(time.hour).padStart(2, "0")}:${String(time.minute).padStart(2, "0")}`;
}

type DatePickerFieldProps = FieldProps & {
	/** An ISO date ("2026-11-10"), or "" for none. */
	value: string;
	onChange: (value: string) => void;
	/** The earliest and latest date that can be picked, as ISO dates. */
	min?: string | undefined;
	max?: string | undefined;
};

/** A date field with a calendar popover: type the day, month and year, or open the calendar. */
export function DatePickerField({
	value,
	onChange,
	min,
	max,
	label,
	description,
	variant = "secondary",
	className,
	...field
}: DatePickerFieldProps) {
	// The calendar is named like the field: by its `aria-label`, or by the visible label.
	const labelId = useId();
	const calendarName = field["aria-label"] ? { "aria-label": field["aria-label"] } : { "aria-labelledby": labelId };

	return (
		<DatePicker
			value={toCalendarDate(value)}
			onChange={(next) => onChange(next ? next.toString() : "")}
			minValue={toCalendarDate(min)}
			maxValue={toCalendarDate(max)}
			className={cn("grid w-full gap-1.5", className)}
			{...field}
		>
			{label && <Label id={labelId}>{label}</Label>}
			<DateField.Group fullWidth variant={variant}>
				<DateField.Input>{(segment) => <DateField.Segment segment={segment} />}</DateField.Input>
				<DateField.Suffix>
					<DatePicker.Trigger>
						<DatePicker.TriggerIndicator />
					</DatePicker.Trigger>
				</DateField.Suffix>
			</DateField.Group>
			{description && <Description>{description}</Description>}
			<DatePicker.Popover>
				<Calendar {...calendarName}>
					<Calendar.Header>
						<Calendar.YearPickerTrigger>
							<Calendar.YearPickerTriggerHeading />
							<Calendar.YearPickerTriggerIndicator />
						</Calendar.YearPickerTrigger>
						<Calendar.NavButton slot="previous" />
						<Calendar.NavButton slot="next" />
					</Calendar.Header>
					<Calendar.Grid>
						<Calendar.GridHeader>{(day) => <Calendar.HeaderCell>{day}</Calendar.HeaderCell>}</Calendar.GridHeader>
						<Calendar.GridBody>{(date) => <Calendar.Cell date={date} />}</Calendar.GridBody>
					</Calendar.Grid>
					<Calendar.YearPickerGrid>
						<Calendar.YearPickerGridBody>
							{({ year }) => <Calendar.YearPickerCell year={year} />}
						</Calendar.YearPickerGridBody>
					</Calendar.YearPickerGrid>
				</Calendar>
			</DatePicker.Popover>
		</DatePicker>
	);
}

type TimeFieldProps = FieldProps & {
	/** A 24-hour time ("09:30"), or "" for none. */
	value: string;
	onChange: (value: string) => void;
};

/** A time field: hour and minute segments in the language's own 12- or 24-hour style. */
export function TimePickerField({
	value,
	onChange,
	label,
	description,
	variant = "secondary",
	className,
	...field
}: TimeFieldProps) {
	return (
		<TimeField
			fullWidth
			value={toTime(value)}
			onChange={(next) => onChange(next ? formatTime(next as Time) : "")}
			className={cn("grid w-full gap-1.5", className)}
			{...field}
		>
			{label && <Label>{label}</Label>}
			<TimeField.Group fullWidth variant={variant}>
				<TimeField.Input>{(segment) => <TimeField.Segment segment={segment} />}</TimeField.Input>
			</TimeField.Group>
			{description && <Description>{description}</Description>}
		</TimeField>
	);
}
