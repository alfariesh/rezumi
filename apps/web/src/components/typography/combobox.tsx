import type { MultiComboboxProps, SingleComboboxProps } from "@/components/ui/combobox";
import type { CustomFontFace } from "@rezumi/schema/resume/data";
import { fontList, getFont, getFontDisplayName, getFontSearchKeywords, sortFontWeights } from "@rezumi/fonts";
import { uploadedFontFamilies, uploadedFontWeights } from "@rezumi/fonts/uploaded";
import { cn } from "@rezumi/utils/style";
import { FontDisplay } from "./font-display";
import { Combobox } from "@/components/ui/combobox";

// Options depend only on the static font list, so compute them once per process
// instead of per component instance (the body + heading pickers rendered identical output twice).
const FONT_FAMILY_OPTIONS = fontList.map((font) => ({
	value: font.family,
	keywords: getFontSearchKeywords(font.family),
	label: (
		<FontDisplay
			family={font.family}
			label={getFontDisplayName(font.family)}
			type={font.type}
			url={"preview" in font ? font.preview : undefined}
		/>
	),
}));

type FontFamilyComboboxProps = Omit<SingleComboboxProps, "options"> & {
	/** The document's uploaded faces; their families are listed first and draw with the uploaded regular face. */
	customFonts?: CustomFontFace[] | undefined;
};

export function FontFamilyCombobox({ className, customFonts, ...props }: FontFamilyComboboxProps) {
	const families = uploadedFontFamilies(customFonts);
	const options =
		families.length === 0
			? FONT_FAMILY_OPTIONS
			: [
					...families.map((family) => {
						const face = customFonts?.find((item) => item.family === family && !item.italic) ?? customFonts?.[0];
						return {
							value: family,
							keywords: [family],
							label: <FontDisplay family={family} label={family} type="web" url={face?.url} />,
						};
					}),
					...FONT_FAMILY_OPTIONS.filter((option) => !families.includes(option.value)),
				];
	return <Combobox {...props} options={options} className={cn("w-full", className)} />;
}

type FontWeightComboboxProps = Omit<MultiComboboxProps, "options" | "multiple"> & {
	fontFamily: string;
	single?: boolean;
	customFonts?: CustomFontFace[] | undefined;
};

export function FontWeightCombobox({
	fontFamily,
	single = false,
	customFonts,
	onValueChange,
	value,
	defaultValue,
	...props
}: FontWeightComboboxProps) {
	const fontData = getFont(fontFamily);
	// Fall back to every possible weight when the font lists none.
	const weights =
		uploadedFontWeights(customFonts, fontFamily) ??
		(fontData && Array.isArray(fontData.weights) && fontData.weights.length > 0
			? sortFontWeights(fontData.weights)
			: ["100", "200", "300", "400", "500", "600", "700", "800", "900"]);
	const options = weights.map((variant: string) => ({ value: variant, label: variant, keywords: [variant] }));

	const sortedValue = value ? sortFontWeights(value).slice(single ? -1 : 0) : value;
	const sortedDefaultValue = defaultValue ? sortFontWeights(defaultValue).slice(single ? -1 : 0) : defaultValue;

	const handleValueChange = (nextValue: string[] | null) => {
		if (single && nextValue?.length) {
			const selected = nextValue.find((weight) => !sortedValue?.includes(weight)) ?? nextValue.at(-1);
			onValueChange?.(selected ? [selected] : []);
			return;
		}
		onValueChange?.(nextValue ? sortFontWeights(nextValue) : nextValue);
	};

	return (
		<Combobox
			{...props}
			value={sortedValue}
			defaultValue={sortedDefaultValue}
			onValueChange={handleValueChange}
			multiple
			options={options}
		/>
	);
}
