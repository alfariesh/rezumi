// Design → Typography: the uploaded fonts, then body and heading: family (uploaded families first, with their own
// weights), weights, size and line height; and hyphenation.
import type { DesignProps } from "./types";
import type { FontWeight } from "@rezumi/fonts";
import type { ResumeData } from "@rezumi/schema/resume/data";
import { useLingui } from "@lingui/react/macro";
import { useState } from "react";
import { View } from "react-native";
import { fontList, getFont, getFontDisplayName, sortFontWeights } from "@rezumi/fonts";
import { nextFontWeights, uploadedFontFamilies, uploadedFontWeights } from "@rezumi/fonts/uploaded";
import { DesignSubScreen } from "./sub-screen";
import { UploadedFonts } from "./uploaded-fonts";
import { Chip, ListRow, ListSection, NumberStepper, PickerSheet, Switch, Text } from "@/ui";

type Typography = ResumeData["metadata"]["typography"];
type Prefix = "body" | "heading";

const CATALOG = fontList.map((font) => ({ value: font.family, label: getFontDisplayName(font.family) }));

export function TypographyScreen({ id }: { id: string }) {
	const { t } = useLingui();
	return (
		<DesignSubScreen id={id} title={t`Typography`}>
			{(props) => (
				<>
					<UploadedFonts {...props} />
					<FontGroup {...props} prefix="body" />
					<FontGroup {...props} prefix="heading" />
					<Hyphenation {...props} />
				</>
			)}
		</DesignSubScreen>
	);
}

type FontGroupProps = DesignProps & { prefix: Prefix };

function FontGroup({ data, write, disabled, prefix }: FontGroupProps) {
	const { t } = useLingui();
	const [picking, setPicking] = useState(false);
	const { typography } = data.metadata;
	const item = typography[prefix];
	const set = (key: string, mutate: (draft: Typography) => void) =>
		write(`typography.${prefix}.${key}`, (draft) => mutate(draft.metadata.typography), true);
	const uploaded = uploadedFontFamilies(typography.customFonts);
	const options = [
		...uploaded.map((family) => ({ value: family, label: family })),
		...CATALOG.filter((option) => !uploaded.includes(option.value)),
	];
	const available = sortFontWeights([
		...new Set(
			uploadedFontWeights(typography.customFonts, item.fontFamily) ??
				getFont(item.fontFamily)?.weights ??
				item.fontWeights,
		),
	]) as FontWeight[];
	const name = uploaded.includes(item.fontFamily) ? item.fontFamily : getFontDisplayName(item.fontFamily);
	const title =
		prefix === "body"
			? t({ message: "Body", context: "Body Text (paragraphs, lists, etc.)" })
			: t({ message: "Heading", context: "Headings or Titles (H1, H2, H3, H4, H5, H6)" });
	const toggle = (weight: FontWeight) => {
		const selected = item.fontWeights.includes(weight);
		// A heading has one weight; body text keeps at least one.
		const next =
			prefix === "heading"
				? [weight]
				: selected
					? item.fontWeights.filter((value) => value !== weight)
					: sortFontWeights([...item.fontWeights, weight]);
		if (next.length > 0 && next.join() !== item.fontWeights.join())
			set("weights", (draft) => void (draft[prefix].fontWeights = next));
	};

	return (
		<View className="gap-2">
			<ListSection title={title}>
				<ListRow title={t`Font family`} value={name} isDisabled={disabled} onPress={() => setPicking(true)} />
			</ListSection>
			<View className="gap-2 px-1">
				<Text size="xs" weight="semibold" tone="muted">
					{prefix === "body" ? t`Font weights` : t`Font weight`}
				</Text>
				<View accessibilityRole={prefix === "heading" ? "radiogroup" : "list"} className="flex-row flex-wrap gap-2">
					{available.map((weight) => {
						const selected = item.fontWeights.includes(weight);
						return (
							<Chip
								key={weight}
								variant={selected ? "primary" : "secondary"}
								color={selected ? "accent" : "default"}
								accessibilityRole={prefix === "heading" ? "radio" : "checkbox"}
								accessibilityState={{ checked: selected, disabled }}
								disabled={disabled}
								onPress={() => toggle(weight)}
								className="min-h-9"
							>
								<Chip.Label>{weight}</Chip.Label>
							</Chip>
						);
					})}
				</View>
				<NumberStepper
					label={t`Font size`}
					value={item.fontSize}
					unit="pt"
					min={6}
					max={24}
					step={0.1}
					isDisabled={disabled}
					variant="primary"
					decreaseLabel={t`Smaller ${title}`}
					increaseLabel={t`Larger ${title}`}
					onChange={(value) => set("size", (draft) => void (draft[prefix].fontSize = value))}
				/>
				<NumberStepper
					label={t`Line height`}
					value={item.lineHeight}
					unit="×"
					min={0.5}
					max={4}
					step={0.05}
					isDisabled={disabled}
					variant="primary"
					decreaseLabel={t`Decrease line height`}
					increaseLabel={t`Increase line height`}
					onChange={(value) => set("lineHeight", (draft) => void (draft[prefix].lineHeight = value))}
				/>
			</View>
			<PickerSheet
				isOpen={picking}
				onOpenChange={setPicking}
				title={t`Font family`}
				closeLabel={t`Close`}
				searchLabel={t`Search fonts`}
				emptyLabel={(query) => t`No font matches “${query}”.`}
				options={options}
				value={item.fontFamily}
				onPick={(family) =>
					set("family", (draft) => {
						draft[prefix].fontFamily = family;
						const weights = nextFontWeights(draft.customFonts, family, prefix === "heading");
						if (weights) draft[prefix].fontWeights = weights;
					})
				}
			/>
		</View>
	);
}

function Hyphenation({ data, write, disabled }: DesignProps) {
	const { t } = useLingui();
	return (
		<ListSection>
			<ListRow
				title={t`Hyphenation`}
				description={t`Breaks long words between syllables, using the language set in Page.`}
				trailing={
					<Switch
						isSelected={data.metadata.typography.hyphenation === true}
						isDisabled={disabled}
						accessibilityLabel={t`Hyphenation`}
						onSelectedChange={(value) =>
							write("typography.hyphenation", (draft) => void (draft.metadata.typography.hyphenation = value), true)
						}
					/>
				}
			/>
		</ListSection>
	);
}
