// One value from a long list (a language, a font family) in a sheet: a search field over the options, the current one
// checked. Picking closes the sheet. Short lists (up to about seven) belong in a Menu or a Select instead.
import { useState } from "react";
import { FlatList, Pressable, View } from "react-native";
import { EmptyState } from "./feedback";
import { SearchField } from "./fields";
import { Icon } from "./icon";
import { Separator } from "./lists";
import { Sheet } from "./sheet";
import { Text } from "./text";

export type PickerOption = {
	value: string;
	label: string;
	/** A short code or note after the label (a language code), in the mono face. */
	detail?: string | undefined;
};

export type PickerSheetProps = {
	isOpen: boolean;
	onOpenChange: (isOpen: boolean) => void;
	title: string;
	closeLabel: string;
	/** The search field's placeholder and accessibility label ("Search languages"). */
	searchLabel: string;
	/** Shown when the search matches nothing; gets the trimmed query ("No language matches “xyz”."). */
	emptyLabel: (query: string) => string;
	options: readonly PickerOption[];
	value: string | null;
	onPick: (value: string) => void;
};

export const filterPickerOptions = (options: readonly PickerOption[], query: string) => {
	const needle = query.trim().toLowerCase();
	if (!needle) return options;
	return options.filter((option) => `${option.label} ${option.detail ?? ""}`.toLowerCase().includes(needle));
};

export function PickerSheet(props: PickerSheetProps) {
	const { isOpen, onOpenChange, title, closeLabel, searchLabel, emptyLabel, options, value, onPick } = props;
	const [query, setQuery] = useState("");
	const shown = filterPickerOptions(options, query);
	const close = (open: boolean) => {
		if (!open) setQuery("");
		onOpenChange(open);
	};

	return (
		<Sheet isOpen={isOpen} onOpenChange={close} title={title} closeLabel={closeLabel} detents={[0.7, 1]} scroll={false}>
			<SearchField value={query} onChange={setQuery}>
				<SearchField.Group>
					<SearchField.SearchIcon />
					<SearchField.Input placeholder={searchLabel} accessibilityLabel={searchLabel} autoCorrect={false} />
					<SearchField.ClearButton />
				</SearchField.Group>
			</SearchField>
			<FlatList
				className="mt-3 flex-1"
				data={isOpen ? shown : []}
				extraData={value}
				keyExtractor={(option) => option.value}
				keyboardShouldPersistTaps="handled"
				nestedScrollEnabled
				initialNumToRender={20}
				ItemSeparatorComponent={Separator}
				renderItem={({ item }) => {
					const selected = item.value === value;
					return (
						<Pressable
							accessibilityRole="button"
							accessibilityLabel={item.detail ? `${item.label}, ${item.detail}` : item.label}
							accessibilityState={{ selected }}
							onPress={() => {
								onPick(item.value);
								close(false);
							}}
							className="min-h-12 flex-row items-center gap-3 px-1 active:bg-default"
						>
							<Text numberOfLines={1} weight={selected ? "medium" : "normal"} className="flex-1">
								{item.label}
							</Text>
							{item.detail ? (
								<Text mono size="xs" tone="muted">
									{item.detail}
								</Text>
							) : null}
							<View className="w-5">{selected ? <Icon name="check" tone="accent" /> : null}</View>
						</Pressable>
					);
				}}
				ListEmptyComponent={query.trim() ? <EmptyState kind="filtered" title={emptyLabel(query.trim())} /> : undefined}
			/>
		</Sheet>
	);
}
