// Resume icons as the page draws them: the Hugeicons set in the resume's icon style, loaded once per style.
import type { IconStyle } from "@rezumi/schema/resume/data";
import { useQuery } from "@tanstack/react-query";
import { SvgXml } from "react-native-svg";
import { upgradeIconName } from "@rezumi/schema/resume/icon-names";
import { size, useThemeColor } from "@/ui";

const loadGlyphs = async (style: IconStyle) => (await import("@rezumi/pdf/icon-glyphs")).loadIconGlyphs(style);

/** Every resume icon's drawing in `style`, once loaded (≈300 KB per style, kept for the session). */
export function useIconGlyphs(style: IconStyle) {
	return useQuery({
		queryKey: ["resume-icon-glyphs", style],
		queryFn: () => loadGlyphs(style),
		staleTime: Number.POSITIVE_INFINITY,
		gcTime: Number.POSITIVE_INFINITY,
	}).data;
}

type ResumeIconProps = {
	/** A resume icon name; a former Phosphor name draws its closest match. */
	name: string;
	glyphs: Readonly<Record<string, string>> | undefined;
	size?: number | undefined;
};

/** One resume icon in the text colour; nothing while its style loads or for an unknown name. Decorative. */
export function ResumeIcon({ name, glyphs, size: iconSize = size.icon.lg }: ResumeIconProps) {
	const color = useThemeColor("foreground");
	const icon = upgradeIconName(name);
	const markup = icon && icon !== "none" ? glyphs?.[icon] : undefined;
	if (!markup) return null;
	return (
		<SvgXml
			xml={`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">${markup}</svg>`}
			color={color}
			width={iconSize}
			height={iconSize}
			accessibilityElementsHidden
			importantForAccessibility="no-hide-descendants"
		/>
	);
}
