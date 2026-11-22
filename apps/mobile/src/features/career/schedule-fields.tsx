import type { PickerOption } from "@/ui";
// The schedule sheet's fields (the web's career/schedule-sheet.tsx): what runs, then a job alert's search, an
// interview briefing or a follow-up reminder, when it runs, and whether it is on and emailed. Lists open in a picker
// sheet stacked on this one; menus and selects would portal behind the native sheet.
import type { AlertFields } from "@rezumi/career/jobs";
import { useLingui } from "@lingui/react/macro";
import { useState } from "react";
import { View } from "react-native";
import { countryName, SEARCH_REGION_CODES } from "@rezumi/utils/region";
import { searchFilterLabels } from "@/features/jobs/format";
import {
	Alert,
	DatePicker,
	FieldError,
	Icon,
	Input,
	Label,
	ListRow,
	ListSection,
	PickerSheet,
	Segment,
	Switch,
	Text,
	TextField,
} from "@/ui";

export type Kind = "discovery" | "prepare" | "follow-up";
export type Lead = "24h" | "2h" | "morning";

export type Draft = AlertFields & {
	kind: Kind;
	every: string;
	/** First run (or the reminder) as `YYYY-MM-DD` and `HH:mm` in the account time zone. */
	date: string;
	time: string;
	interviewId: string;
	applicationId: string;
	lead: Lead;
	aiProviderId: string;
	enabled: boolean;
	email: boolean;
};

type Patch = (patch: Partial<Draft>) => void;

type NoteProps = { status: "accent" | "warning" | "danger"; title?: string | undefined; message: string };

/** A banner in the sheet: the job alert's explanation, something missing, a failed save. */
export function Note({ status, title, message }: NoteProps) {
	return (
		<Alert status={status}>
			<Alert.Indicator />
			<Alert.Content>
				{title ? <Alert.Title>{title}</Alert.Title> : null}
				<Alert.Description>{message}</Alert.Description>
			</Alert.Content>
		</Alert>
	);
}

type KindChoiceProps = { value: Kind; onChange: (kind: Kind) => void; isDisabled: boolean };

export function KindChoice({ value, onChange, isDisabled }: KindChoiceProps) {
	const { t } = useLingui();
	return (
		<View className="gap-2">
			<Label>{t`What should run`}</Label>
			<Segment<Kind>
				accessibilityLabel={t`What should run`}
				value={value}
				isDisabled={isDisabled}
				onValueChange={onChange}
				options={[
					{
						value: "discovery",
						label: t({ message: "Job alert", context: "Short schedule kind in a segmented choice" }),
					},
					{ value: "prepare", label: t`Prepare` },
					{ value: "follow-up", label: t`Remind me` },
				]}
			/>
		</View>
	);
}

type PickRowProps = {
	title: string;
	value: string;
	options: readonly PickerOption[];
	onPick: (value: string) => void;
	/** Shown while nothing is chosen. */
	placeholder: string;
	searchLabel: string;
	footer?: string | undefined;
	isDisabled?: boolean | undefined;
};

/** A field-like row naming the current choice; it opens a searchable list. */
export function PickRow({ title, value, options, onPick, placeholder, searchLabel, footer, isDisabled }: PickRowProps) {
	const { t } = useLingui();
	const [open, setOpen] = useState(false);
	const chosen = options.find((option) => option.value === value);
	return (
		<>
			<ListSection footer={footer}>
				<ListRow
					title={title}
					description={chosen?.label ?? placeholder}
					isDisabled={isDisabled}
					onPress={() => setOpen(true)}
				/>
			</ListSection>
			<PickerSheet
				isOpen={open}
				onOpenChange={setOpen}
				title={title}
				closeLabel={t`Close`}
				searchLabel={searchLabel}
				emptyLabel={(query) => t`Nothing matches “${query}”.`}
				options={options}
				value={chosen ? value : null}
				onPick={onPick}
			/>
		</>
	);
}

type JobAlertFieldsProps = {
	draft: Draft;
	set: Patch;
	roleError: string | null;
	onRoleBlur: () => void;
	unavailable: boolean;
};

/** Role, city and country to look in; the search's other filters are listed, not edited. */
export function JobAlertFields({ draft, set, roleError, onRoleBlur, unavailable }: JobAlertFieldsProps) {
	const { t, i18n } = useLingui();
	const countries = SEARCH_REGION_CODES.map((code) => ({
		value: code,
		label: countryName(code, i18n.locale),
		detail: code,
	})).sort((a, b) => a.label.localeCompare(b.label, i18n.locale));
	const filters = searchFilterLabels(
		{ ...draft.filters, ...(draft.country ? { country: draft.country } : {}) },
		i18n.locale,
	);
	const list = filters.join(" · ");
	return (
		<>
			<TextField isInvalid={!!roleError}>
				<Label>{t`Role`}</Label>
				<Input
					variant="secondary"
					value={draft.role}
					maxLength={200}
					accessibilityLabel={t`Role`}
					onChangeText={(role) => set({ role })}
					onBlur={onRoleBlur}
				/>
				{roleError ? (
					<FieldError>{roleError}</FieldError>
				) : (
					<Text size="xs" tone="muted">{t`A job title works best, such as “Product designer”.`}</Text>
				)}
			</TextField>
			<TextField>
				<Label>{t`City (optional)`}</Label>
				<Input
					variant="secondary"
					value={draft.city}
					maxLength={200}
					accessibilityLabel={t`City (optional)`}
					onChangeText={(city) => set({ city })}
				/>
			</TextField>
			<PickRow
				title={t`Country`}
				value={draft.country}
				placeholder={t`Anywhere`}
				searchLabel={t`Search countries`}
				options={[{ value: "", label: t`Anywhere` }, ...countries]}
				onPick={(country) => set({ country })}
			/>
			{filters.length > 0 ? (
				<View className="flex-row items-start gap-1.5">
					<Icon name="sliders-horizontal" size={15} tone="muted" />
					<Text size="xs" tone="muted" className="flex-1">{t`Also filtered by: ${list}`}</Text>
				</View>
			) : null}
			<View className="gap-2">
				<Label>{t`How often`}</Label>
				<Segment
					accessibilityLabel={t`How often`}
					value={draft.every}
					onValueChange={(every) => set({ every })}
					options={[
						// Short: three segments share the sheet's width under "How often".
						{ value: "1", label: t({ message: "Daily", context: "How often a job alert runs" }) },
						{ value: "3", label: t({ message: "3 days", context: "How often a job alert runs: every 3 days" }) },
						{ value: "7", label: t({ message: "Weekly", context: "How often a job alert runs" }) },
					]}
				/>
			</View>
			{unavailable ? (
				<Note status="warning" message={t`Job alerts aren't available on this server yet.`} />
			) : (
				<Note
					status="accent"
					message={t`Each run looks for jobs that appeared since the last one. New ones wait in Home for your review; applications and documents are never created for you.`}
				/>
			)}
		</>
	);
}

/** Half-hour steps through the day, plus the current time when it is between them. */
function timeOptions(current: string, locale: string): PickerOption[] {
	const format = new Intl.DateTimeFormat(locale, { hour: "numeric", minute: "2-digit", timeZone: "UTC" });
	const values = new Set(
		Array.from({ length: 48 }, (_, index) => {
			const hours = String(Math.floor(index / 2)).padStart(2, "0");
			return `${hours}:${index % 2 ? "30" : "00"}`;
		}),
	);
	if (/^\d{2}:\d{2}$/.test(current)) values.add(current);
	return [...values].sort().map((value) => {
		const [hours = 0, minutes = 0] = value.split(":").map(Number);
		return { value, label: format.format(Date.UTC(2000, 0, 1, hours, minutes)) };
	});
}

type WhenFieldsProps = {
	draft: Draft;
	set: Patch;
	timeZone: string;
	locale: string;
	/** Today in the account time zone, `YYYY-MM-DD`: the earliest day to pick. */
	today: string;
	error: string | null;
};

/** The day and time a job alert first runs, or a reminder is due, in the account time zone. */
export function WhenFields({ draft, set, timeZone, locale, today, error }: WhenFieldsProps) {
	const { t } = useLingui();
	return (
		<View className="gap-3">
			<DatePicker
				variant="secondary"
				label={draft.kind === "follow-up" ? t`Remind me on` : t`First run`}
				value={draft.date}
				placeholder={t`Pick a day`}
				locale={locale}
				minimumDate={today}
				isInvalid={!!error}
				onChange={(date) => set({ date: date ?? draft.date })}
			/>
			<PickRow
				title={t`Time · ${timeZone}`}
				value={draft.time}
				placeholder={draft.time}
				searchLabel={t`Search times`}
				options={timeOptions(draft.time, locale)}
				onPick={(time) => set({ time })}
			/>
			{error ? <FieldError isInvalid>{error}</FieldError> : null}
		</View>
	);
}

type SwitchesProps = {
	draft: Draft;
	set: Patch;
	smtp: boolean;
	verified: boolean;
	email: string;
};

/** On or paused, and the optional email copy (only when the server sends mail). */
export function ScheduleSwitches({ draft, set, smtp, verified, email }: SwitchesProps) {
	const { t } = useLingui();
	const emailLabel = t`Also email ${email}`;
	return (
		<ListSection>
			<ListRow
				title={t`Turn this schedule on`}
				description={t`Paused schedules keep their settings.`}
				trailing={
					<Switch
						isSelected={draft.enabled}
						accessibilityLabel={t`Turn this schedule on`}
						onSelectedChange={(enabled) => set({ enabled })}
					/>
				}
			/>
			{smtp ? (
				<ListRow
					title={emailLabel}
					description={
						verified
							? t`You'll always see it in Today. Email depends on your server's mail setup.`
							: t`Verify your email in Settings first`
					}
					trailing={
						<Switch
							isSelected={verified && draft.email}
							isDisabled={!verified}
							accessibilityLabel={emailLabel}
							onSelectedChange={(next) => set({ email: next })}
						/>
					}
				/>
			) : null}
		</ListSection>
	);
}
