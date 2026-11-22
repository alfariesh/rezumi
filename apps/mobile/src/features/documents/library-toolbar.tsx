// Above the library: search (titles, tags, linked applications), then one row that scrolls sideways with Sort, Public
// (once a resume's link is on), the tags in use, and the list or grid switch, as the web's toolbar and tag chips.
import type { DocumentSort } from "./filter";
import type { MenuKey } from "@/ui";
import { useLingui } from "@lingui/react/macro";
import { Pressable, ScrollView, View } from "react-native";
import { Chip, Icon, IconButton, Menu, SearchField, Text } from "@/ui";

export type LibraryView = "list" | "grid";

type LibraryToolbarProps = {
	q: string;
	onQueryChange: (q: string) => void;
	sort: DocumentSort;
	onSortChange: (sort: DocumentSort) => void;
	tags: readonly string[];
	activeTags: readonly string[];
	onTagsChange: (tags: string[]) => void;
	showPublic: boolean;
	publicOnly: boolean;
	onPublicChange: (publicOnly: boolean) => void;
	view: LibraryView;
	onViewChange: (view: LibraryView) => void;
};

export function LibraryToolbar(props: LibraryToolbarProps) {
	const { t } = useLingui();
	const { tags, activeTags, onTagsChange } = props;
	const toggleTag = (tag: string) =>
		onTagsChange(activeTags.includes(tag) ? activeTags.filter((item) => item !== tag) : [...activeTags, tag]);
	return (
		<View className="gap-3">
			<SearchField value={props.q} onChange={props.onQueryChange}>
				<SearchField.Group>
					<SearchField.SearchIcon />
					<SearchField.Input placeholder={t`Search`} accessibilityLabel={t`Search documents`} />
					<SearchField.ClearButton accessibilityLabel={t`Clear search`} />
				</SearchField.Group>
			</SearchField>
			<ScrollView
				horizontal
				showsHorizontalScrollIndicator={false}
				keyboardShouldPersistTaps="handled"
				className="-mx-4"
				contentContainerClassName="items-center gap-2 px-4"
				accessibilityLabel={t`Filter by tag`}
			>
				<SortMenu sort={props.sort} onSortChange={props.onSortChange} />
				{props.showPublic ? (
					<FilterChip
						label={t`Public`}
						icon="globe"
						selected={props.publicOnly}
						onPress={() => props.onPublicChange(!props.publicOnly)}
					/>
				) : null}
				{tags.map((tag) => (
					<FilterChip key={tag} label={`#${tag}`} selected={activeTags.includes(tag)} onPress={() => toggleTag(tag)} />
				))}
				<IconButton
					icon={props.view === "grid" ? "list-dashes" : "squares-four"}
					label={props.view === "grid" ? t`List` : t`Grid`}
					onPress={() => props.onViewChange(props.view === "grid" ? "list" : "grid")}
					testID="library-view"
				/>
			</ScrollView>
		</View>
	);
}

type FilterChipProps = { label: string; icon?: "globe" | undefined; selected: boolean; onPress: () => void };

function FilterChip({ label, icon, selected, onPress }: FilterChipProps) {
	return (
		<Chip
			variant={selected ? "primary" : "secondary"}
			color={selected ? "accent" : "default"}
			onPress={onPress}
			accessibilityRole="button"
			accessibilityState={{ selected }}
			hitSlop={6}
		>
			{selected ? (
				<Icon name="check" size={14} tone="accent-foreground" />
			) : icon ? (
				<Icon name={icon} size={14} />
			) : null}
			<Chip.Label>{label}</Chip.Label>
		</Chip>
	);
}

type SortMenuProps = { sort: DocumentSort; onSortChange: (sort: DocumentSort) => void };

const sorts = ["edited", "name", "created"] as const satisfies readonly DocumentSort[];

function SortMenu({ sort, onSortChange }: SortMenuProps) {
	const { t } = useLingui();
	const labels: Record<DocumentSort, string> = { edited: t`Last edited`, name: t`Name`, created: t`Created` };
	const pick = (keys: Set<MenuKey>) => {
		const next = sorts.find((value) => keys.has(value));
		if (next && next !== sort) onSortChange(next);
	};
	return (
		<Menu>
			<Menu.Trigger asChild>
				<Pressable
					accessibilityRole="button"
					accessibilityLabel={t`Sort: ${labels[sort]}`}
					hitSlop={6}
					className="min-h-8 flex-row items-center gap-1 rounded-full bg-default px-3"
					testID="library-sort"
				>
					<Icon name="arrows-down-up" size={14} />
					<Text size="sm" weight="medium">
						{labels[sort]}
					</Text>
				</Pressable>
			</Menu.Trigger>
			<Menu.Portal>
				<Menu.Overlay />
				<Menu.Content presentation="popover" width={200}>
					<Menu.Label>{t`Sort`}</Menu.Label>
					<Menu.Group selectionMode="single" selectedKeys={new Set([sort])} onSelectionChange={pick}>
						{sorts.map((value) => (
							<Menu.Item key={value} id={value}>
								<Menu.ItemIndicator />
								<Menu.ItemTitle>{labels[value]}</Menu.ItemTitle>
							</Menu.Item>
						))}
					</Menu.Group>
				</Menu.Content>
			</Menu.Portal>
		</Menu>
	);
}
