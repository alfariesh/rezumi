// The search (the web's search-bar.tsx): the role and Search on top, then when it was posted and Filters, which names
// the place searched and how many other filters are set. Nothing is searched until Search is pressed: each search
// counts toward the day's searches.
import type { MenuKey } from "@/ui";
import type { JobsSearch } from "@rezumi/career/jobs";
import { useLingui } from "@lingui/react/macro";
import { useState } from "react";
import { Pressable, View } from "react-native";
import { sheetFilterCount } from "@rezumi/career/jobs";
import { countryName } from "@rezumi/utils/region";
import { clearedSearch, FiltersSheet } from "./filters-sheet";
import { postedLabel, postedShortLabel } from "./format";
import { Button, Icon, Menu, SearchField, Text } from "@/ui";

const POSTED = [1, 7, 14, 30] as const;

type SearchBarProps = {
	value: JobsSearch;
	onChange: (next: JobsSearch) => void;
	onSearch: () => void;
	searching: boolean;
};

export function SearchBar({ value, onChange, onSearch, searching }: SearchBarProps) {
	const { t, i18n } = useLingui();
	const [filtersOpen, setFiltersOpen] = useState(false);
	const set = (patch: Partial<JobsSearch>) => onChange({ ...value, ...patch });
	const ready = value.q.trim().length >= 2 && !searching;
	const filters = sheetFilterCount(value);
	const place = value.location.trim() || (value.country ? countryName(value.country, i18n.locale) : "");
	const filtersLabel = place
		? filters > 0
			? t({
					message: `Filters · ${place} (${filters})`,
					comment: "The job search filters button: the place searched and how many other filters are set",
				})
			: t({ message: `Filters · ${place}`, comment: "The job search filters button with the place searched" })
		: filters > 0
			? t`Filters (${filters})`
			: t`Filters`;
	const submit = () => {
		if (!ready) return;
		setFiltersOpen(false);
		onSearch();
	};

	return (
		<View className="gap-2" accessibilityRole="search">
			<View className="flex-row items-center gap-2">
				<SearchField value={value.q} onChange={(q) => set({ q })} className="flex-1">
					<SearchField.Group>
						<SearchField.SearchIcon />
						<SearchField.Input
							placeholder={t`Role or keywords`}
							accessibilityLabel={t`Role or keywords`}
							maxLength={200}
							autoCorrect={false}
							returnKeyType="search"
							onSubmitEditing={submit}
							testID="jobs-query"
						/>
						<SearchField.ClearButton />
					</SearchField.Group>
				</SearchField>
				<Button variant="primary" isDisabled={!ready} onPress={submit} testID="jobs-search">
					<Button.Label>{t({ message: "Search", context: "Button that runs a job search" })}</Button.Label>
				</Button>
			</View>
			<View className="flex-row items-center gap-2">
				<PostedMenu value={value.posted} onChange={(posted) => set({ posted })} />
				<Pressable
					accessibilityRole="button"
					accessibilityLabel={filtersLabel}
					hitSlop={6}
					onPress={() => setFiltersOpen(true)}
					className="min-h-8 max-w-full shrink flex-row items-center gap-1.5 rounded-full bg-default px-3"
					testID="jobs-filters-open"
				>
					<Icon name="sliders-horizontal" size={14} />
					<Text size="sm" weight="medium" numberOfLines={1} className="shrink">
						{filtersLabel}
					</Text>
				</Pressable>
			</View>
			<FiltersSheet
				isOpen={filtersOpen}
				onOpenChange={setFiltersOpen}
				value={value}
				onChange={set}
				onReset={() => onChange(clearedSearch(value))}
				canSearch={ready}
				onSearch={submit}
			/>
		</View>
	);
}

type PostedMenuProps = { value: JobsSearch["posted"]; onChange: (posted: JobsSearch["posted"]) => void };

/** When it was posted, on the search row: the filter people change most. */
function PostedMenu({ value, onChange }: PostedMenuProps) {
	const { t } = useLingui();
	const pick = (keys: Set<MenuKey>) => {
		const next = POSTED.find((days) => keys.has(String(days)));
		if (next && next !== value) onChange(next);
	};
	return (
		<Menu>
			<Menu.Trigger asChild>
				<Pressable
					accessibilityRole="button"
					accessibilityLabel={postedLabel(value)}
					accessibilityHint={t`Changes when the jobs were posted`}
					hitSlop={6}
					className="min-h-8 flex-row items-center gap-1.5 rounded-full bg-default px-3"
					testID="jobs-posted"
				>
					<Icon name="calendar-blank" size={14} />
					<Text size="sm" weight="medium">
						{postedShortLabel(value)}
					</Text>
					<Icon name="caret-down" size={14} tone="muted" />
				</Pressable>
			</Menu.Trigger>
			<Menu.Portal>
				<Menu.Overlay />
				<Menu.Content presentation="popover" width={240}>
					<Menu.Group selectionMode="single" selectedKeys={new Set([String(value)])} onSelectionChange={pick}>
						{POSTED.map((days) => (
							<Menu.Item key={days} id={String(days)}>
								<Menu.ItemIndicator />
								<Menu.ItemTitle>{postedLabel(days)}</Menu.ItemTitle>
							</Menu.Item>
						))}
					</Menu.Group>
				</Menu.Content>
			</Menu.Portal>
		</Menu>
	);
}
