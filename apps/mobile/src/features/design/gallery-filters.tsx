import type { GalleryFilter } from "./types";
import type { CareerField } from "@rezumi/schema/templates";
import { useLingui } from "@lingui/react/macro";
import { ScrollView, View } from "react-native";
import { careerFields } from "@rezumi/schema/templates";
import { CAREER_FIELD_NAMES } from "./preset-names";
import { Chip, Text } from "@/ui";

type GalleryFiltersProps = {
	filter: GalleryFilter;
	onChange: (filter: GalleryFilter) => void;
	shown: number;
	listed: number;
};

type FilterChipProps = { label: string; selected: boolean; onPress: () => void };

function FilterChip({ label, selected, onPress }: FilterChipProps) {
	return (
		<Chip
			variant={selected ? "primary" : "secondary"}
			color={selected ? "accent" : "default"}
			accessibilityRole="radio"
			accessibilityState={{ checked: selected }}
			onPress={onPress}
			className="min-h-9"
		>
			<Chip.Label>{label}</Chip.Label>
		</Chip>
	);
}

/** The gallery's filters: field of work (a row that scrolls) and layout, with how many templates show. */
export function GalleryFilters({ filter, onChange, shown, listed }: GalleryFiltersProps) {
	const { t, i18n } = useLingui();
	const fields: { id: CareerField | "all"; label: string }[] = [
		{ id: "all", label: t`All fields` },
		...careerFields.map((id) => ({ id, label: i18n._(CAREER_FIELD_NAMES[id]) })),
	];
	const layouts: { id: GalleryFilter["layout"]; label: string }[] = [
		{ id: "all", label: t`All` },
		{ id: "one", label: t`One column` },
		{ id: "two", label: t`Two columns` },
		{ id: "ats", label: t`ATS-safe` },
	];

	return (
		<View className="gap-3">
			<ScrollView
				horizontal
				showsHorizontalScrollIndicator={false}
				accessibilityRole="radiogroup"
				accessibilityLabel={t`Field of work`}
				className="-mx-4"
				contentContainerClassName="gap-2 px-4"
			>
				{fields.map((field) => (
					<FilterChip
						key={field.id}
						label={field.label}
						selected={filter.field === field.id}
						onPress={() => onChange({ ...filter, field: field.id })}
					/>
				))}
			</ScrollView>
			<View accessibilityRole="radiogroup" accessibilityLabel={t`Show templates`} className="flex-row flex-wrap gap-2">
				{layouts.map((layout) => (
					<FilterChip
						key={layout.id}
						label={layout.label}
						selected={filter.layout === layout.id}
						onPress={() => onChange({ ...filter, layout: layout.id })}
					/>
				))}
			</View>
			<Text size="xs" tone="muted" tabular accessibilityLiveRegion="polite">
				{t`${shown} of ${listed} shown`}
			</Text>
		</View>
	);
}
