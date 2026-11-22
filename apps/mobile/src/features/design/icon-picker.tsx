// A resume icon from the whole set, in a sheet: search, a category filter (Suggested, then each Hugeicons category, as
// `@rezumi/resume/icon-picker` orders them) and the icons drawn in the resume's icon style, as the page prints them.
import type { IconName } from "@rezumi/schema/icons";
import type { IconStyle } from "@rezumi/schema/resume/data";
import { useLingui } from "@lingui/react/macro";
import { useState } from "react";
import { FlatList, Pressable, ScrollView } from "react-native";
import { iconPickerGroups, searchIcons } from "@rezumi/resume/icon-picker";
import { ICON_GROUP_NAMES } from "./preset-names";
import { ResumeIcon, useIconGlyphs } from "./resume-icon";
import { Chip, EmptyState, Icon, SearchField, Sheet, cx, size } from "@/ui";

type IconPickerSheetProps = {
	isOpen: boolean;
	onOpenChange: (isOpen: boolean) => void;
	/** The current icon; "" for none. */
	value: string;
	iconStyle: IconStyle;
	/** The picked icon, or "" for No icon. */
	onChange: (icon: IconName | "") => void;
};

const ALL = "all";

export function IconPickerSheet({ isOpen, onOpenChange, value, iconStyle, onChange }: IconPickerSheetProps) {
	const { t, i18n } = useLingui();
	const glyphs = useIconGlyphs(iconStyle);
	const [query, setQuery] = useState("");
	const [group, setGroup] = useState(ALL);
	const [columns, setColumns] = useState(1);
	const labelOf = (id: string) => {
		const name = ICON_GROUP_NAMES[id];
		// A category synced after these names were written still gets a readable one.
		return name ? i18n._(name) : id.replaceAll("-", " ").replace(/^./, (letter) => letter.toUpperCase());
	};
	const labels = Object.fromEntries(iconPickerGroups.map((candidate) => [candidate.id, labelOf(candidate.id)]));
	const scope = group === ALL ? undefined : group;
	const icons: (IconName | "")[] = ["", ...searchIcons(query, { group: scope, labels })];
	const pick = (icon: IconName | "") => {
		onChange(icon);
		onOpenChange(false);
	};

	return (
		<Sheet
			isOpen={isOpen}
			onOpenChange={onOpenChange}
			title={t`Icon`}
			closeLabel={t`Close`}
			detents={[0.7, 1]}
			scroll={false}
		>
			<SearchField value={query} onChange={setQuery}>
				<SearchField.Group>
					<SearchField.SearchIcon />
					<SearchField.Input placeholder={t`Search for an icon`} accessibilityLabel={t`Search for an icon`} />
					<SearchField.ClearButton />
				</SearchField.Group>
			</SearchField>
			<ScrollView
				horizontal
				showsHorizontalScrollIndicator={false}
				accessibilityRole="radiogroup"
				accessibilityLabel={t`Icon category`}
				className="mt-3 grow-0"
				contentContainerClassName="gap-2"
			>
				{[ALL, ...iconPickerGroups.map((candidate) => candidate.id)].map((id) => (
					<Chip
						key={id}
						variant={id === group ? "primary" : "secondary"}
						color={id === group ? "accent" : "default"}
						accessibilityRole="radio"
						accessibilityState={{ checked: id === group }}
						onPress={() => setGroup(id)}
						className="min-h-9"
					>
						<Chip.Label>{id === ALL ? t`All categories` : labelOf(id)}</Chip.Label>
					</Chip>
				))}
			</ScrollView>
			<FlatList
				key={columns}
				className="mt-3 flex-1"
				onLayout={({ nativeEvent: { layout } }) => setColumns(Math.max(1, Math.floor(layout.width / size.hit)))}
				numColumns={columns}
				data={isOpen ? icons : []}
				extraData={`${value}:${glyphs ? 1 : 0}`}
				keyExtractor={(icon) => icon || "none"}
				keyboardShouldPersistTaps="handled"
				nestedScrollEnabled
				initialNumToRender={60}
				renderItem={({ item: icon }) => (
					<Pressable
						accessibilityRole="radio"
						accessibilityLabel={icon || t`No icon`}
						accessibilityState={{ checked: value === icon }}
						onPress={() => pick(icon)}
						style={[{ width: `${100 / columns}%` }]}
						className={cx(
							"min-h-11 items-center justify-center rounded-lg active:bg-default",
							value === icon && "bg-accent-soft",
						)}
					>
						{icon ? <ResumeIcon name={icon} glyphs={glyphs} size={size.icon.md} /> : <Icon name="prohibit" />}
					</Pressable>
				)}
				ListFooterComponent={
					icons.length <= 1 ? <EmptyState kind="filtered" title={t`No icons match “${query.trim()}”.`} /> : undefined
				}
			/>
		</Sheet>
	);
}
