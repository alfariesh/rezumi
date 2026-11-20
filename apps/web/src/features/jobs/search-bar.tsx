import type { JobsSearch } from "./search";
import type { Key } from "react";
import { Button, Checkbox, ComboBox, Input, Label, ListBox, Popover } from "@heroui/react";
import { t } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import { Trans } from "@lingui/react/macro";
import { useId, useMemo, useState } from "react";
import { JOB_SENIORITIES } from "@rezumi/schema/jobs/listing";
import { Icon } from "@rezumi/ui/components/icon";
import { countryName, SEARCH_REGION_CODES } from "@rezumi/utils/region";
import { cn } from "@rezumi/utils/style";
import { arrangementLabel, seniorityLabel } from "./format";
import { currencyForCountry, PAY_CURRENCIES } from "./search";
import { FlagIcon } from "@/components/flag-icon";
import { SelectField } from "@/components/input/select-field";

/** "" in the country list: no country, so remote listings anywhere and on-site ones everywhere. */
const ANYWHERE = "anywhere";

type JobsSearchBarProps = {
	value: JobsSearch;
	onChange: (next: JobsSearch) => void;
	onSearch: () => void;
	searching: boolean;
};

/**
 * The search: role, place and country on the first row with Search; when it was posted, how it's worked, the level
 * and More (minimum pay, visa sponsorship) on the second. Changing a filter doesn't search: each search counts toward
 * the day's searches, so the person presses Search when the whole search is ready.
 */
export function JobsSearchBar({ value, onChange, onSearch, searching }: JobsSearchBarProps) {
	const id = useId();
	const set = (patch: Partial<JobsSearch>) => onChange({ ...value, ...patch });
	const ready = value.q.trim().length >= 2 && !searching;

	return (
		<form
			role="search"
			aria-label={t`Search jobs`}
			className="grid w-full gap-3"
			onSubmit={(event) => {
				event.preventDefault();
				if (ready) onSearch();
			}}
		>
			<div className="flex flex-wrap items-end gap-2">
				<div className="relative min-w-56 flex-[2_1_16rem]">
					<Icon
						name="magnifying-glass"
						size={18}
						className="pointer-events-none absolute start-2.5 top-1/2 -translate-y-1/2 text-muted"
					/>
					<Input
						id={`${id}-query`}
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
				<div className="relative min-w-40 flex-[1_1_10rem]">
					<Icon
						name="map-pin"
						size={18}
						className="pointer-events-none absolute start-2.5 top-1/2 -translate-y-1/2 text-muted"
					/>
					<Input
						variant="secondary"
						fullWidth
						aria-label={t`City`}
						placeholder={t`City (optional)`}
						maxLength={200}
						value={value.location}
						className="ps-8"
						onChange={(event) => set({ location: event.target.value })}
					/>
				</div>
				<CountryField
					value={value.country}
					onChange={(country) =>
						set({ country, ...(value.minPay === undefined ? {} : { currency: currencyForCountry(country) }) })
					}
				/>
				<Button type="submit" isDisabled={!ready} isPending={searching} className="max-sm:basis-full">
					{t({ message: "Search", context: "Button that runs a job search" })}
				</Button>
			</div>
			<div className="-mx-4 flex [scrollbar-width:none] items-center gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
				<SelectField
					aria-label={t`Posted`}
					className="w-auto shrink-0"
					triggerClassName="h-8 min-w-36"
					value={String(value.posted)}
					onChange={(posted) => set({ posted: Number(posted) as JobsSearch["posted"] })}
					options={[
						{ value: "1", label: t`Posted in the last day` },
						{ value: "7", label: t`Posted in the last week` },
						{ value: "14", label: t`Posted in the last 2 weeks` },
						{ value: "30", label: t`Posted in the last 30 days` },
					]}
				/>
				<SelectField
					aria-label={t`Work arrangement`}
					className="w-auto shrink-0"
					triggerClassName="h-8 min-w-36"
					value={value.arrangement}
					onChange={(arrangement) => set({ arrangement: arrangement as JobsSearch["arrangement"] })}
					options={[
						{ value: "any", label: t`On-site, hybrid or remote` },
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
				<SelectField
					aria-label={t`Level`}
					className="w-auto shrink-0"
					triggerClassName="h-8 min-w-32"
					value={value.level}
					onChange={(level) => set({ level: level as JobsSearch["level"] })}
					options={[
						{ value: "", label: t`Any level` },
						...JOB_SENIORITIES.map((level) => ({ value: level, label: seniorityLabel(level) })),
					]}
				/>
				<MoreFilters value={value} onChange={set} />
			</div>
		</form>
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

type MoreFiltersProps = { value: JobsSearch; onChange: (patch: Partial<JobsSearch>) => void };

/** Minimum pay (keeping listings without pay unless that's turned off) and visa sponsorship (K11). */
function MoreFilters({ value, onChange }: MoreFiltersProps) {
	const id = useId();
	const extra = (value.minPay === undefined ? 0 : 1) + (value.visa ? 1 : 0);
	const currency = value.currency ?? currencyForCountry(value.country);
	const [draftPay, setDraftPay] = useState(value.minPay === undefined ? "" : String(value.minPay));
	const [lastPay, setLastPay] = useState(value.minPay);
	if (lastPay !== value.minPay) {
		setLastPay(value.minPay);
		setDraftPay(value.minPay === undefined ? "" : String(value.minPay));
	}

	return (
		<Popover>
			<Popover.Trigger
				className={cn(
					"inline-flex h-8 shrink-0 items-center gap-1.5 rounded-field bg-default px-3 text-sm whitespace-nowrap text-field-foreground transition-colors duration-quick outline-none hover:bg-default-hover focus-visible:ring-2 focus-visible:ring-focus pointer-coarse:min-h-11",
					extra > 0 && "text-accent-soft-foreground",
				)}
			>
				<Icon name="sliders-horizontal" size={16} />
				{extra > 0 ? <Trans>More filters ({extra})</Trans> : <Trans>More filters</Trans>}
			</Popover.Trigger>
			<Popover.Content placement="bottom start" className="w-80 max-w-[calc(100vw-2rem)]">
				<Popover.Dialog aria-label={t`More filters`} className="grid gap-4 p-1">
					<div className="grid gap-1.5">
						<Label htmlFor={`${id}-pay`}>
							<Trans>Minimum yearly pay</Trans>
						</Label>
						<div className="flex gap-2">
							<Input
								id={`${id}-pay`}
								variant="secondary"
								fullWidth
								inputMode="numeric"
								placeholder={t`Any`}
								value={draftPay}
								onChange={(event) => {
									const digits = event.target.value.replace(/[^\d]/g, "").slice(0, 9);
									setDraftPay(digits);
									const amount = Number(digits);
									onChange(amount > 0 ? { minPay: amount, currency } : { minPay: undefined, currency: undefined });
								}}
							/>
							<SelectField
								aria-label={t`Currency`}
								className="w-28 shrink-0"
								value={currency}
								onChange={(next) => onChange({ currency: next })}
								options={PAY_CURRENCIES.map((code) => ({ value: code, label: code }))}
							/>
						</div>
						<Checkbox
							isSelected={value.noPay}
							isDisabled={value.minPay === undefined}
							onChange={(noPay) => onChange({ noPay })}
							className="text-sm"
						>
							<Checkbox.Content>
								<Checkbox.Control>
									<Checkbox.Indicator />
								</Checkbox.Control>
								<Trans>Include jobs that don't list pay</Trans>
							</Checkbox.Content>
						</Checkbox>
						<p className="text-body-xs text-muted">
							<Trans>Many postings don't list pay, especially outside the US.</Trans>
						</p>
					</div>
					<Checkbox isSelected={value.visa} onChange={(visa) => onChange({ visa })} className="text-sm">
						<Checkbox.Content>
							<Checkbox.Control>
								<Checkbox.Indicator />
							</Checkbox.Control>
							<Trans>Offers visa sponsorship</Trans>
						</Checkbox.Content>
					</Checkbox>
				</Popover.Dialog>
			</Popover.Content>
		</Popover>
	);
}
