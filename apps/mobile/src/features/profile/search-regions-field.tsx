// The countries web searches target, in Preferences: the time zone's country by default, up to three chosen, or none
// for anywhere (the web's SearchRegionsField). Adding a country opens a searchable list in a sheet.
import type { SearchRegionsAction } from "@rezumi/utils/region";
import { useLingui } from "@lingui/react/macro";
import { useDeferredValue, useMemo, useState } from "react";
import { View } from "react-native";
import {
	countryName,
	MAX_SEARCH_REGIONS,
	nextSearchRegions,
	SEARCH_REGION_CODES,
	shownSearchRegions,
} from "@rezumi/utils/region";
import { deviceTimeZone } from "@/features/reminders/schedule";
import {
	Button,
	Description,
	EmptyState,
	Icon,
	Label,
	ListRow,
	ListSection,
	SearchField,
	Sheet,
	TagGroup,
	Text,
} from "@/ui";

export type SearchRegionsFieldProps = {
	value: string[] | null | undefined;
	accountTimeZone: string;
	onChange: (next: string[] | null) => void;
};

export function SearchRegionsField({ value, accountTimeZone, onChange }: SearchRegionsFieldProps) {
	const { t, i18n } = useLingui();
	const shown = shownSearchRegions(value, accountTimeZone, deviceTimeZone());
	const full = shown.codes.length >= MAX_SEARCH_REGIONS;
	const [picking, setPicking] = useState(false);
	const [search, setSearch] = useState("");
	const query = useDeferredValue(search).trim().toLocaleLowerCase(i18n.locale);

	const countries = useMemo(
		() =>
			SEARCH_REGION_CODES.map((code) => ({ code, name: countryName(code, i18n.locale) })).sort((a, b) =>
				a.name.localeCompare(b.name, i18n.locale),
			),
		[i18n.locale],
	);
	const choices = countries.filter(
		(country) =>
			!shown.codes.includes(country.code) &&
			(!query || country.name.toLocaleLowerCase(i18n.locale).includes(query) || country.code.toLowerCase() === query),
	);

	const apply = (action: SearchRegionsAction) => {
		const next = nextSearchRegions(shown.codes, action);
		if (next !== shown.codes) onChange(next);
	};

	return (
		<View className="gap-2">
			<Label>{t`Where you're looking for work`}</Label>
			{shown.codes.length > 0 ? (
				<View className="gap-1.5">
					<TagGroup
						variant="default"
						onRemove={(keys) => {
							const [code] = [...keys];
							if (code !== undefined) apply({ type: "remove", code: String(code) });
						}}
					>
						<TagGroup.List>
							{shown.codes.map((code) => {
								const name = countryName(code, i18n.locale);
								return (
									<TagGroup.Item
										key={code}
										id={code}
										accessibilityActions={[{ name: "delete", label: t`Remove ${name}` }]}
										onAccessibilityAction={(event) => {
											if (event.nativeEvent.actionName === "delete") apply({ type: "remove", code });
										}}
									>
										{shown.automatic ? <Icon name="clock" size={14} tone="muted" /> : null}
										<TagGroup.ItemLabel>{name}</TagGroup.ItemLabel>
										<TagGroup.ItemRemoveButton aria-label={t`Remove ${name}`} />
									</TagGroup.Item>
								);
							})}
						</TagGroup.List>
					</TagGroup>
					{shown.automatic ? (
						<Text size="xs" tone="muted">
							{t`From your timezone`}
						</Text>
					) : null}
				</View>
			) : (
				<Text tone="muted">{t`Anywhere`}</Text>
			)}
			<View className="-ms-1 flex-row flex-wrap gap-2">
				<Button size="sm" variant="secondary" isDisabled={full} onPress={() => setPicking(true)}>
					<Icon name="plus" size={16} />
					<Button.Label>{t`Add a country`}</Button.Label>
				</Button>
				{shown.automatic ? null : (
					<Button size="sm" variant="ghost" onPress={() => apply({ type: "automatic" })}>
						<Button.Label>{t`Use my timezone`}</Button.Label>
					</Button>
				)}
			</View>
			<Description>{t`Web searches look for work here, up to three countries.`}</Description>

			<Sheet
				isOpen={picking}
				onOpenChange={(isOpen) => {
					setPicking(isOpen);
					if (!isOpen) setSearch("");
				}}
				title={t`Add a country`}
				closeLabel={t`Close`}
				detents={[0.9]}
			>
				<SearchField value={search} onChange={setSearch}>
					<SearchField.Group>
						<SearchField.SearchIcon />
						<SearchField.Input
							placeholder={t`Search countries`}
							accessibilityLabel={t`Search countries`}
							autoCorrect={false}
						/>
						<SearchField.ClearButton accessibilityLabel={t`Clear search`} />
					</SearchField.Group>
				</SearchField>
				{choices.length === 0 ? (
					<EmptyState kind="filtered" title={t`No country matches.`} description={t`Try another name.`} />
				) : (
					<ListSection>
						{choices.map((country) => (
							<ListRow
								key={country.code}
								title={country.name}
								chevron={false}
								onPress={() => {
									apply({ type: "add", code: country.code });
									setPicking(false);
									setSearch("");
								}}
							/>
						))}
					</ListSection>
				)}
			</Sheet>
		</View>
	);
}
