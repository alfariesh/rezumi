import type { SearchRegionsAction } from "@rezumi/utils/region";
import type { Key } from "react";
import { ComboBox, Input, ListBox } from "@heroui/react";
import { t } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import { Trans } from "@lingui/react/macro";
import { useId, useMemo, useState } from "react";
import { Icon } from "@rezumi/ui/components/icon";
import {
	countryName,
	MAX_SEARCH_REGIONS,
	nextSearchRegions,
	SEARCH_REGION_CODES,
	shownSearchRegions,
} from "@rezumi/utils/region";

export type SearchRegionsFieldProps = {
	value: string[] | null | undefined;
	accountTimeZone: string;
	onChange: (next: string[] | null) => void;
};

/** Countries web searches target: the time zone's country by default, up to three chosen, or none for anywhere. */
export function SearchRegionsField({ value, accountTimeZone, onChange }: SearchRegionsFieldProps) {
	const { i18n } = useLingui();
	const labelId = useId();
	const [query, setQuery] = useState("");
	const device = Intl.DateTimeFormat().resolvedOptions().timeZone;
	const shown = shownSearchRegions(value, accountTimeZone, device);
	const full = shown.codes.length >= MAX_SEARCH_REGIONS;

	const countries = useMemo(
		() =>
			SEARCH_REGION_CODES.map((code) => ({ value: code, label: countryName(code, i18n.locale) })).sort((a, b) =>
				a.label.localeCompare(b.label, i18n.locale),
			),
		[i18n.locale],
	);
	const name = (code: string) => countryName(code, i18n.locale);

	const apply = (action: SearchRegionsAction) => {
		const next = nextSearchRegions(shown.codes, action);
		if (next !== shown.codes) onChange(next);
	};

	// Picking a country adds it; the field stays empty so the next one can be searched straight away.
	const onPick = (key: Key | null) => {
		setQuery("");
		if (key === null) return;
		const code = String(key);
		if (!shown.codes.includes(code)) apply({ type: "add", code });
	};

	// Matches the country's name, or its code ("DE").
	const matches = (text: string, input: string) => {
		const needle = input.trim().toLocaleLowerCase(i18n.locale);
		return !needle || text.toLocaleLowerCase(i18n.locale).includes(needle);
	};

	return (
		<div role="group" aria-labelledby={labelId} className="grid content-start gap-1.5">
			<span id={labelId} className="text-xs font-medium text-ink-2">
				<Trans>Where you're looking for work</Trans>
			</span>
			<div className="flex min-h-10 flex-wrap items-center gap-[5px] rounded-md border border-line-2 bg-raised p-[5px]">
				{shown.codes.map((code) => {
					const country = name(code);
					return (
						<span
							key={code}
							className="flex h-7 items-center gap-1 rounded-sm bg-sunken ps-2.5 pe-1 text-[13px] font-medium"
						>
							<span>{country}</span>
							{shown.automatic && (
								<span className="flex items-center gap-0.5 text-xs font-normal text-ink-3">
									<Icon name="clock" size={14} />
									<Trans>From your timezone</Trans>
								</span>
							)}
							<button
								type="button"
								aria-label={t`Remove ${country}`}
								onClick={() => apply({ type: "remove", code })}
								className="touch-target relative flex size-[22px] items-center justify-center rounded-md text-ink-3 transition-colors duration-quick hover:bg-hover hover:text-ink"
							>
								<Icon name="x" size={16} />
							</button>
						</span>
					);
				})}
				{shown.codes.length === 0 && (
					<span className="px-1.5 text-[13px] text-ink-3">
						<Trans>Anywhere</Trans>
					</span>
				)}
				<ComboBox
					aria-label={t`Add a country`}
					selectedKey={null}
					onSelectionChange={onPick}
					inputValue={query}
					onInputChange={setQuery}
					defaultFilter={matches}
					disabledKeys={full ? countries.filter((c) => !shown.codes.includes(c.value)).map((c) => c.value) : []}
					allowsEmptyCollection
					className="ms-auto w-44"
				>
					<ComboBox.InputGroup>
						<Input fullWidth placeholder={t`Add a country`} className="h-7 shadow-none" />
						<ComboBox.Trigger />
					</ComboBox.InputGroup>
					<ComboBox.Popover aria-label={t`Countries`}>
						<ListBox
							renderEmptyState={() => (
								<p className="p-2 text-sm text-muted">
									<Trans>No country matches.</Trans>
								</p>
							)}
						>
							{countries.map((country) => (
								<ListBox.Item key={country.value} id={country.value} textValue={`${country.label} ${country.value}`}>
									{country.label}
								</ListBox.Item>
							))}
						</ListBox>
					</ComboBox.Popover>
				</ComboBox>
			</div>
			<p className="flex flex-wrap items-center gap-x-1 text-xs text-ink-3">
				<Trans>Web searches look for work here, up to three countries.</Trans>
				{!shown.automatic && (
					<button
						type="button"
						onClick={() => apply({ type: "automatic" })}
						className="text-ink-2 underline underline-offset-2 hover:text-ink"
					>
						<Trans>Use my timezone</Trans>
					</button>
				)}
			</p>
		</div>
	);
}
