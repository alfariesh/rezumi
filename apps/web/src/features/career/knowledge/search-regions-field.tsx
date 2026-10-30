import type { SearchRegionsAction } from "@rezumi/utils/region";
import type { Key } from "react";
import { Button, ComboBox, Input, Label, ListBox } from "@heroui/react";
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
import { Token, TokenFrame } from "./token-field";

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
			<Label id={labelId}>
				<Trans>Where you're looking for work</Trans>
			</Label>
			<TokenFrame>
				{shown.codes.map((code) => {
					const country = name(code);
					return (
						<Token key={code} removeLabel={t`Remove ${country}`} onRemove={() => apply({ type: "remove", code })}>
							<span>{country}</span>
							{shown.automatic && (
								<span className="flex items-center gap-0.5 text-xs font-normal opacity-70">
									<Icon name="clock" size={14} />
									<Trans>From your timezone</Trans>
								</span>
							)}
						</Token>
					);
				})}
				{shown.codes.length === 0 && (
					<span className="px-2 text-sm text-muted">
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
			</TokenFrame>
			<p className="flex flex-wrap items-center gap-x-1 text-xs text-muted">
				<Trans>Web searches look for work here, up to three countries.</Trans>
				{!shown.automatic && (
					<Button
						variant="ghost"
						size="sm"
						className="h-auto min-h-0 px-1 py-0 text-xs underline underline-offset-2"
						onPress={() => apply({ type: "automatic" })}
					>
						<Trans>Use my timezone</Trans>
					</Button>
				)}
			</p>
		</div>
	);
}
