import type { JobsSearch } from "@rezumi/career/jobs";
import type { IconName } from "@rezumi/ui/components/icon";
import type { Key } from "react";
import { Sheet } from "@heroui-pro/react";
import { Button, ComboBox, Input, Label, ListBox, Select } from "@heroui/react";
import { t } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import { Trans } from "@lingui/react/macro";
import { useId, useMemo, useState } from "react";
import { currencyForCountry, PAY_CURRENCIES, sheetFilterCount, withoutFilters } from "@rezumi/career/jobs";
import { JOB_SENIORITIES } from "@rezumi/schema/jobs/listing";
import { Icon } from "@rezumi/ui/components/icon";
import { CellSwitchRow } from "@rezumi/ui/components/switch";
import { useBreakpoint } from "@rezumi/ui/hooks/use-breakpoint";
import { countryName, SEARCH_REGION_CODES } from "@rezumi/utils/region";
import { arrangementLabel, seniorityLabel } from "./format";
import { FlagIcon } from "@/components/flag-icon";
import { CellSelectField } from "@/components/input/select-field";

/** "" in the country list: no country, so remote listings anywhere and on-site ones everywhere. */
const ANYWHERE = "anywhere";
/** Digits the minimum pay takes: up to the search's limit (MAX_JOB_SEARCH_SALARY, 13 digits) less one. */
const MAX_PAY_DIGITS = 12;

type JobsSearchBarProps = {
	value: JobsSearch;
	onChange: (next: JobsSearch) => void;
	onSearch: () => void;
	searching: boolean;
};

/** The row's choices, which say what they filter; the sheet's own cell names it, so its choices are shorter. */
const postedOptions = () => [
	{ value: "1", label: t`Posted in the last day` },
	{ value: "7", label: t`Posted in the last week` },
	{ value: "14", label: t`Posted in the last 2 weeks` },
	{ value: "30", label: t`Posted in the last 30 days` },
];

/**
 * The search on one row: when it was posted and Filters on the left, the role and Search on the right (the role first
 * on phones). Filters opens a sheet with every other filter: place, how it's worked, level, pay and visa. Changing a
 * filter doesn't search: each search counts toward the day's searches, so the person presses Search when it's ready.
 */
export function JobsSearchBar({ value, onChange, onSearch, searching }: JobsSearchBarProps) {
	const set = (patch: Partial<JobsSearch>) => onChange({ ...value, ...patch });
	const ready = value.q.trim().length >= 2 && !searching;
	const [filtersOpen, setFiltersOpen] = useState(false);
	const { i18n } = useLingui();
	const filters = sheetFilterCount(value);
	// Where the search looks, on the button: the sheet holds the place, so the row would otherwise hide it.
	const place = value.location.trim() || (value.country ? countryName(value.country, i18n.locale) : "");

	return (
		<form
			role="search"
			aria-label={t`Search jobs`}
			className="flex w-full flex-wrap items-center gap-2"
			onSubmit={(event) => {
				event.preventDefault();
				if (ready) {
					setFiltersOpen(false);
					onSearch();
				}
			}}
		>
			<div className="flex min-w-0 items-center gap-2 max-sm:w-full">
				<PostedSelect value={value.posted} onChange={(posted) => set({ posted })} />
				<Button variant="secondary" className="min-w-0 shrink" onPress={() => setFiltersOpen(true)}>
					<Icon name="sliders-horizontal" size={16} className="shrink-0" />
					<span className="truncate">
						{place ? (
							filters > 0 ? (
								<Trans comment="The job search filters button: the place searched and how many other filters are set">
									Filters · {place} ({filters})
								</Trans>
							) : (
								<Trans comment="The job search filters button with the place searched">Filters · {place}</Trans>
							)
						) : filters > 0 ? (
							<Trans>Filters ({filters})</Trans>
						) : (
							<Trans>Filters</Trans>
						)}
					</span>
				</Button>
			</div>
			<div className="flex min-w-0 flex-[1_1_20rem] items-center justify-end gap-2 max-sm:order-first max-sm:basis-full">
				<div className="relative min-w-0 flex-1 sm:max-w-md">
					<Icon
						name="magnifying-glass"
						size={18}
						className="pointer-events-none absolute start-2.5 top-1/2 -translate-y-1/2 text-muted"
					/>
					<Input
						variant="secondary"
						fullWidth
						type="search"
						aria-label={t`Role or keywords`}
						placeholder={t`Role or keywords`}
						maxLength={200}
						value={value.q}
						className="ps-8"
						onChange={(event) => set({ q: event.target.value })}
					/>
				</div>
				<Button type="submit" isDisabled={!ready} isPending={searching} className="shrink-0">
					{t({ message: "Search", context: "Button that runs a job search" })}
				</Button>
			</div>
			<FiltersSheet
				isOpen={filtersOpen}
				onOpenChange={setFiltersOpen}
				value={value}
				onChange={set}
				onReset={() => onChange({ ...withoutFilters(value), country: "", location: "" })}
				canSearch={ready}
				onSearch={() => {
					setFiltersOpen(false);
					onSearch();
				}}
			/>
		</form>
	);
}

type PostedSelectProps = { value: JobsSearch["posted"]; onChange: (posted: JobsSearch["posted"]) => void };

/** When it was posted, on the search row: the filter people change most. */
function PostedSelect({ value, onChange }: PostedSelectProps) {
	return (
		<Select
			aria-label={t`Posted`}
			className="w-auto min-w-0 max-sm:flex-1"
			value={String(value)}
			onChange={(key: Key | Key[] | null) => {
				if (typeof key === "string") onChange(Number(key) as JobsSearch["posted"]);
			}}
		>
			<Select.Trigger className="gap-2 sm:min-w-44 pointer-coarse:min-h-11">
				<Icon name="calendar-blank" size={16} className="shrink-0 text-muted" />
				<Select.Value className="truncate" />
				<Select.Indicator />
			</Select.Trigger>
			<Select.Popover>
				<ListBox>
					{postedOptions().map((option) => (
						<ListBox.Item key={option.value} id={option.value} textValue={option.label}>
							{option.label}
							<ListBox.ItemIndicator />
						</ListBox.Item>
					))}
				</ListBox>
			</Select.Popover>
		</Select>
	);
}

type FiltersSheetProps = {
	isOpen: boolean;
	onOpenChange: (open: boolean) => void;
	value: JobsSearch;
	onChange: (patch: Partial<JobsSearch>) => void;
	onReset: () => void;
	canSearch: boolean;
	onSearch: () => void;
};

type FieldHeadingProps = { icon: IconName; htmlFor?: string; children: React.ReactNode };

/** A field's name with its icon, above a text field or the country picker. */
function FieldHeading({ icon, htmlFor, children }: FieldHeadingProps) {
	return (
		<Label htmlFor={htmlFor} className="flex items-center gap-2">
			<Icon name={icon} size={16} className="shrink-0 text-muted" />
			{children}
		</Label>
	);
}

/**
 * Every filter in one place, from the right (from the bottom on phones), each on its own row: where, when, how it's
 * worked, the level, pay and visa sponsorship (K11). Search runs the search from here; closing keeps the changes for it.
 */
function FiltersSheet({ isOpen, onOpenChange, value, onChange, onReset, canSearch, onSearch }: FiltersSheetProps) {
	const id = useId();
	const phone = useBreakpoint() === "mobile";
	const { i18n } = useLingui();
	const currency = value.currency ?? currencyForCountry(value.country);
	const [draftPay, setDraftPay] = useState(value.minPay === undefined ? "" : String(value.minPay));
	const [lastPay, setLastPay] = useState(value.minPay);
	if (lastPay !== value.minPay) {
		setLastPay(value.minPay);
		setDraftPay(value.minPay === undefined ? "" : String(value.minPay));
	}

	return (
		<Sheet isOpen={isOpen} onOpenChange={onOpenChange} placement={phone ? "bottom" : "right"}>
			<Sheet.Backdrop>
				<Sheet.Content className={phone ? "max-h-[90svh]" : "w-full sm:max-w-[420px]"}>
					<Sheet.Dialog className="bg-surface">
						{phone && <Sheet.Handle />}
						<Sheet.CloseTrigger aria-label={t`Close`} />
						<Sheet.Header>
							<Sheet.Heading>
								<Trans>Filters</Trans>
							</Sheet.Heading>
						</Sheet.Header>
						<Sheet.Body className="grid content-start gap-4">
							<div className="grid gap-1.5">
								<FieldHeading icon="globe-simple">
									<Trans>Country</Trans>
								</FieldHeading>
								<CountryField
									className="w-full"
									value={value.country}
									onChange={(country) =>
										onChange({
											country,
											...(value.minPay === undefined ? {} : { currency: currencyForCountry(country) }),
										})
									}
								/>
							</div>
							<div className="grid gap-1.5">
								<FieldHeading icon="map-pin" htmlFor={`${id}-city`}>
									<Trans>City</Trans>
								</FieldHeading>
								<Input
									id={`${id}-city`}
									variant="secondary"
									fullWidth
									placeholder={t`Anywhere in the country`}
									maxLength={200}
									value={value.location}
									onChange={(event) => onChange({ location: event.target.value })}
								/>
							</div>
							<div className="grid gap-2">
								<CellSelectField
									icon="calendar-blank"
									label={t`Posted`}
									value={String(value.posted)}
									onChange={(posted) => onChange({ posted: Number(posted) as JobsSearch["posted"] })}
									options={[
										{ value: "1", label: t({ message: "Last day", context: "Job search filter: posted within" }) },
										{ value: "7", label: t({ message: "Last week", context: "Job search filter: posted within" }) },
										{ value: "14", label: t({ message: "Last 2 weeks", context: "Job search filter: posted within" }) },
										{ value: "30", label: t({ message: "Last 30 days", context: "Job search filter: posted within" }) },
									]}
								/>
								<CellSelectField
									icon="briefcase"
									label={t`Work arrangement`}
									value={value.arrangement}
									onChange={(arrangement) => onChange({ arrangement: arrangement as JobsSearch["arrangement"] })}
									options={[
										{ value: "any", label: t({ message: "Any", context: "Job search filter: any work arrangement" }) },
										{
											value: "remote",
											label: value.country
												? t({ message: "Remote in this country", context: "Job search filter" })
												: t({ message: "Remote anywhere", context: "Job search filter" }),
										},
										{ value: "hybrid", label: arrangementLabel("hybrid") },
										{ value: "onsite", label: arrangementLabel("onsite") },
									]}
								/>
								<CellSelectField
									icon="chart-line-up"
									label={t`Level`}
									value={value.level}
									onChange={(level) => onChange({ level: level as JobsSearch["level"] })}
									options={[
										{ value: "", label: t`Any level` },
										...JOB_SENIORITIES.map((level) => ({ value: level, label: seniorityLabel(level) })),
									]}
								/>
							</div>
							<div className="grid gap-1.5">
								<FieldHeading icon="tag" htmlFor={`${id}-pay`}>
									<Trans>Minimum yearly pay</Trans>
								</FieldHeading>
								<Input
									id={`${id}-pay`}
									variant="secondary"
									fullWidth
									inputMode="numeric"
									placeholder={t`Any`}
									// Grouped for reading ("150.000.000"); only the digits are kept.
									value={draftPay ? new Intl.NumberFormat(i18n.locale).format(Number(draftPay)) : ""}
									onChange={(event) => {
										const digits = event.target.value.replace(/[^\d]/g, "").slice(0, MAX_PAY_DIGITS);
										setDraftPay(digits);
										const amount = Number(digits);
										onChange(amount > 0 ? { minPay: amount, currency } : { minPay: undefined, currency: undefined });
									}}
								/>
							</div>
							<div className="grid gap-2">
								<CellSelectField
									icon="scales"
									label={t`Currency`}
									value={currency}
									onChange={(next) => onChange({ currency: next })}
									options={PAY_CURRENCIES.map((code) => ({ value: code, label: code }))}
								/>
								<CellSwitchRow
									label={<Trans>Include jobs that don't list pay</Trans>}
									isSelected={value.noPay}
									isDisabled={value.minPay === undefined}
									onChange={(noPay) => onChange({ noPay })}
								/>
								<CellSwitchRow
									label={<Trans>Offers visa sponsorship</Trans>}
									isSelected={value.visa}
									onChange={(visa) => onChange({ visa })}
								/>
								<p className="px-1 text-body-xs text-muted">
									<Trans>
										Many postings don't list pay, especially outside the US, and few say whether they sponsor a visa.
									</Trans>
								</p>
							</div>
						</Sheet.Body>
						<Sheet.Footer className="flex gap-2">
							<Button variant="secondary" onPress={onReset}>
								<Trans>Clear filters</Trans>
							</Button>
							<Button className="flex-1" isDisabled={!canSearch} onPress={onSearch}>
								{t({ message: "Search", context: "Button that runs a job search" })}
							</Button>
						</Sheet.Footer>
					</Sheet.Dialog>
				</Sheet.Content>
			</Sheet.Backdrop>
		</Sheet>
	);
}

type CountryFieldProps = {
	value: string;
	onChange: (country: string) => void;
	/** A visible label above the field; without one it's named for screen readers only. */
	label?: string;
	className?: string;
};

/** The country to search in, by name or code, or anywhere. */
export function CountryField({ value, onChange, label, className }: CountryFieldProps) {
	const { i18n } = useLingui();
	const countries = useMemo(
		() =>
			SEARCH_REGION_CODES.map((code) => ({ code, name: countryName(code, i18n.locale) })).sort((a, b) =>
				a.name.localeCompare(b.name, i18n.locale),
			),
		[i18n.locale],
	);
	const selected = value || ANYWHERE;
	const selectedName = value ? countryName(value, i18n.locale) : t`Anywhere`;
	const [query, setQuery] = useState<string | null>(null);
	const matches = (text: string, input: string) => {
		const needle = input.trim().toLocaleLowerCase(i18n.locale);
		return !needle || text.toLocaleLowerCase(i18n.locale).includes(needle);
	};

	return (
		<ComboBox
			{...(label ? {} : { "aria-label": t`Country` })}
			selectedKey={selected}
			inputValue={query ?? selectedName}
			onInputChange={setQuery}
			onSelectionChange={(key: Key | null) => {
				setQuery(null);
				if (key !== null) onChange(key === ANYWHERE ? "" : String(key));
			}}
			onOpenChange={(open) => {
				if (!open) setQuery(null);
			}}
			defaultFilter={matches}
			// Opens on typing or the chevron, never on focus: Enter in an open list would pick whichever country is
			// highlighted, and Enter is how people run the search.
			menuTrigger="input"
			allowsEmptyCollection
			className={className ?? "min-w-44 flex-[1_1_11rem]"}
		>
			{label && <Label>{label}</Label>}
			<ComboBox.InputGroup>
				<Input variant="secondary" fullWidth placeholder={t`Country`} />
				<ComboBox.Trigger />
			</ComboBox.InputGroup>
			<ComboBox.Popover aria-label={t`Countries`}>
				<ListBox
					renderEmptyState={() => (
						<p className="p-2 text-body-sm text-muted">
							<Trans>No country matches.</Trans>
						</p>
					)}
				>
					<ListBox.Item id={ANYWHERE} textValue={t`Anywhere`}>
						<Icon name="globe-simple" size={16} className="text-muted" />
						<Trans>Anywhere</Trans>
					</ListBox.Item>
					{countries.map((country) => (
						<ListBox.Item key={country.code} id={country.code} textValue={`${country.name} ${country.code}`}>
							<FlagIcon code={country.code} />
							{country.name}
						</ListBox.Item>
					))}
				</ListBox>
			</ComboBox.Popover>
		</ComboBox>
	);
}
