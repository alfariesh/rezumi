// Every filter of a job search in one sheet (the web's FiltersSheet, K11): where (country, city), when it was posted,
// how it's worked, the level, minimum yearly pay with its currency, "include jobs that don't list pay" and visa
// sponsorship. Changing a filter doesn't search: each search counts toward the day's searches, so Search in the
// sheet's footer runs it. The country and currency lists open inside the same sheet (one native sheet at a time).
import type { JobsSearch } from "@rezumi/career/jobs";
import { useLingui } from "@lingui/react/macro";
import { useDeferredValue, useMemo, useState } from "react";
import { View } from "react-native";
import { currencyForCountry, PAY_CURRENCIES, withoutFilters } from "@rezumi/career/jobs";
import { JOB_SENIORITIES } from "@rezumi/schema/jobs/listing";
import { countryName, SEARCH_REGION_CODES } from "@rezumi/utils/region";
import { arrangementLabel, postedShortLabel, remoteLabel, seniorityLabel } from "./format";
import {
	Button,
	Description,
	EmptyState,
	Input,
	Label,
	ListRow,
	ListSection,
	SearchField,
	Sheet,
	Switch,
	TagGroup,
	Text,
	TextField,
	haptics,
} from "@/ui";

/** Digits the minimum pay takes: up to the search's limit (13 digits) less one. */
const MAX_PAY_DIGITS = 12;

type FiltersSheetProps = {
	isOpen: boolean;
	onOpenChange: (open: boolean) => void;
	value: JobsSearch;
	onChange: (patch: Partial<JobsSearch>) => void;
	onReset: () => void;
	canSearch: boolean;
	onSearch: () => void;
};

type FiltersView = "filters" | "country" | "currency";

export function FiltersSheet({
	isOpen,
	onOpenChange,
	value,
	onChange,
	onReset,
	canSearch,
	onSearch,
}: FiltersSheetProps) {
	const { t } = useLingui();
	const [view, setView] = useState<FiltersView>("filters");
	const close = (open: boolean) => {
		if (!open) setView("filters");
		onOpenChange(open);
	};
	const footer =
		view === "filters" ? (
			<View className="flex-row gap-2">
				<Button variant="secondary" onPress={onReset} testID="jobs-filters-clear">
					<Button.Label>{t`Clear filters`}</Button.Label>
				</Button>
				<Button
					variant="primary"
					className="flex-1"
					isDisabled={!canSearch}
					onPress={onSearch}
					testID="jobs-filters-search"
				>
					<Button.Label>{t({ message: "Search", context: "Button that runs a job search" })}</Button.Label>
				</Button>
			</View>
		) : (
			<Button variant="secondary" onPress={() => setView("filters")}>
				<Button.Label>{t`Back to filters`}</Button.Label>
			</Button>
		);

	return (
		<Sheet
			isOpen={isOpen}
			onOpenChange={close}
			title={view === "country" ? t`Country` : view === "currency" ? t`Currency` : t`Filters`}
			closeLabel={t`Close`}
			footer={footer}
			testID="jobs-filters"
		>
			{view === "country" ? (
				<CountryList
					value={value.country}
					onPick={(country) => {
						onChange({ country, ...(value.minPay === undefined ? {} : { currency: currencyForCountry(country) }) });
						setView("filters");
					}}
				/>
			) : view === "currency" ? (
				<CurrencyList
					value={value.currency ?? currencyForCountry(value.country)}
					onPick={(currency) => {
						onChange({ currency });
						setView("filters");
					}}
				/>
			) : (
				<Filters
					value={value}
					onChange={onChange}
					onPickCountry={() => setView("country")}
					onPickCurrency={() => setView("currency")}
				/>
			)}
		</Sheet>
	);
}

type FiltersProps = {
	value: JobsSearch;
	onChange: (patch: Partial<JobsSearch>) => void;
	onPickCountry: () => void;
	onPickCurrency: () => void;
};

/** The sheet's filters (exported for tests: the native sheet doesn't draw under Jest). */
export function Filters({ value, onChange, onPickCountry, onPickCurrency }: FiltersProps) {
	const { t, i18n } = useLingui();
	const currency = value.currency ?? currencyForCountry(value.country);
	const [draftPay, setDraftPay] = useState(value.minPay === undefined ? "" : String(value.minPay));
	const [lastPay, setLastPay] = useState(value.minPay);
	if (lastPay !== value.minPay) {
		setLastPay(value.minPay);
		setDraftPay(value.minPay === undefined ? "" : String(value.minPay));
	}
	const posted = [1, 7, 14, 30].map((days) => ({ id: String(days), label: postedShortLabel(days) }));
	const arrangements = [
		{ id: "any", label: t({ message: "Any", context: "Job search filter: any work arrangement" }) },
		{ id: "remote", label: remoteLabel(value.country) },
		{ id: "hybrid", label: arrangementLabel("hybrid") },
		{ id: "onsite", label: arrangementLabel("onsite") },
	];
	const levels = [
		{ id: "", label: t`Any level` },
		...JOB_SENIORITIES.map((level) => ({ id: level, label: seniorityLabel(level) })),
	];

	return (
		<View className="gap-5">
			<ListSection>
				<ListRow
					icon="globe-simple"
					title={t`Country`}
					value={value.country ? countryName(value.country, i18n.locale) : t`Anywhere`}
					onPress={onPickCountry}
					testID="jobs-filter-country"
				/>
			</ListSection>
			<TextField>
				<Label>{t`City`}</Label>
				<Input
					variant="secondary"
					value={value.location}
					placeholder={t`Anywhere in the country`}
					maxLength={200}
					accessibilityLabel={t`City`}
					onChangeText={(location) => onChange({ location })}
					testID="jobs-filter-city"
				/>
			</TextField>
			<Choices
				label={t`Posted`}
				options={posted}
				value={String(value.posted)}
				onChange={(id) => onChange({ posted: Number(id) as JobsSearch["posted"] })}
			/>
			<Choices
				label={t`Work arrangement`}
				options={arrangements}
				value={value.arrangement}
				onChange={(id) => onChange({ arrangement: id as JobsSearch["arrangement"] })}
			/>
			<Choices
				label={t`Level`}
				options={levels}
				value={value.level}
				onChange={(id) => onChange({ level: id as JobsSearch["level"] })}
			/>
			<TextField>
				<Label>{t`Minimum yearly pay`}</Label>
				<Input
					variant="secondary"
					keyboardType="number-pad"
					placeholder={t`Any`}
					accessibilityLabel={t`Minimum yearly pay`}
					// Grouped for reading ("150.000.000"); only the digits are kept.
					value={draftPay ? new Intl.NumberFormat(i18n.locale).format(Number(draftPay)) : ""}
					onChangeText={(text) => {
						const digits = text.replace(/[^\d]/g, "").slice(0, MAX_PAY_DIGITS);
						setDraftPay(digits);
						const amount = Number(digits);
						onChange(amount > 0 ? { minPay: amount, currency } : { minPay: undefined, currency: undefined });
					}}
					testID="jobs-filter-pay"
				/>
			</TextField>
			<ListSection
				footer={t`Many postings don't list pay, especially outside the US, and few say whether they sponsor a visa.`}
			>
				<ListRow icon="scales" title={t`Currency`} value={currency} onPress={onPickCurrency} />
				<ListRow
					title={t`Include jobs that don't list pay`}
					isDisabled={value.minPay === undefined}
					trailing={
						<Switch
							isSelected={value.noPay}
							isDisabled={value.minPay === undefined}
							onSelectedChange={(noPay) => onChange({ noPay })}
							accessibilityLabel={t`Include jobs that don't list pay`}
						/>
					}
				/>
				<ListRow
					title={t`Offers visa sponsorship`}
					trailing={
						<Switch
							isSelected={value.visa}
							onSelectedChange={(visa) => onChange({ visa })}
							accessibilityLabel={t`Offers visa sponsorship`}
							testID="jobs-filter-visa"
						/>
					}
				/>
			</ListSection>
		</View>
	);
}

type ChoicesProps = {
	label: string;
	options: { id: string; label: string }[];
	value: string;
	onChange: (id: string) => void;
};

/** A few short choices as tags that wrap, where a segment would cut the words. */
function Choices({ label, options, value, onChange }: ChoicesProps) {
	return (
		<View className="gap-2">
			<Text weight="medium">{label}</Text>
			<TagGroup
				selectionMode="single"
				selectedKeys={new Set([value])}
				onSelectionChange={(keys) => {
					const [id] = [...keys];
					if (id === undefined || String(id) === value) return;
					haptics.selection();
					onChange(String(id));
				}}
				accessibilityLabel={label}
			>
				<TagGroup.List>
					{options.map((option) => (
						<TagGroup.Item key={option.id || "any"} id={option.id}>
							<TagGroup.ItemLabel>{option.label}</TagGroup.ItemLabel>
						</TagGroup.Item>
					))}
				</TagGroup.List>
			</TagGroup>
		</View>
	);
}

type CountryListProps = { value: string; onPick: (country: string) => void };

/** The country to search in, by name or code, or anywhere. */
export function CountryList({ value, onPick }: CountryListProps) {
	const { t, i18n } = useLingui();
	const [search, setSearch] = useState("");
	const query = useDeferredValue(search).trim().toLocaleLowerCase(i18n.locale);
	const countries = useMemo(
		() =>
			SEARCH_REGION_CODES.map((code) => ({ code, name: countryName(code, i18n.locale) })).sort((a, b) =>
				a.name.localeCompare(b.name, i18n.locale),
			),
		[i18n.locale],
	);
	const shown = countries.filter(
		(country) =>
			!query || country.name.toLocaleLowerCase(i18n.locale).includes(query) || country.code.toLowerCase() === query,
	);
	return (
		<View className="gap-3">
			<SearchField value={search} onChange={setSearch}>
				<SearchField.Group>
					<SearchField.SearchIcon />
					<SearchField.Input
						placeholder={t`Search countries`}
						accessibilityLabel={t`Search countries`}
						autoCorrect={false}
					/>
					<SearchField.ClearButton />
				</SearchField.Group>
			</SearchField>
			<ListSection>
				{!query ? (
					<ListRow
						icon="globe-simple"
						title={t`Anywhere`}
						isSelected={value === ""}
						onPress={() => onPick("")}
						chevron={false}
					/>
				) : null}
				{shown.map((country) => (
					<ListRow
						key={country.code}
						title={country.name}
						isSelected={value === country.code}
						onPress={() => onPick(country.code)}
						chevron={false}
					/>
				))}
			</ListSection>
			{shown.length === 0 ? <EmptyState kind="inline" title={t`No country matches.`} /> : null}
		</View>
	);
}

type CurrencyListProps = { value: string; onPick: (currency: string) => void };

function CurrencyList({ value, onPick }: CurrencyListProps) {
	const { t } = useLingui();
	return (
		<View className="gap-3">
			<Description>{t`The currency of the minimum pay.`}</Description>
			<ListSection>
				{PAY_CURRENCIES.map((code) => (
					<ListRow key={code} title={code} isSelected={value === code} onPress={() => onPick(code)} chevron={false} />
				))}
			</ListSection>
		</View>
	);
}

/** Clears every filter and the place, keeping the role (the sheet's Clear filters). */
export const clearedSearch = (search: JobsSearch): JobsSearch => ({
	...withoutFilters(search),
	country: "",
	location: "",
});
