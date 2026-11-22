// System icons: the Hugeicons set in @rezumi/icons, under the same kebab names as the web's Icon. `stroke` is the
// default; `duotone` marks the selected state only (active tab, selected segment), and the solid stop/play/star.
import type { AppIconName, IconNode, IconVariant } from "@rezumi/icons";
import type { ThemeColor } from "heroui-native";
import { useThemeColor } from "heroui-native";
import { memo } from "react";
import { I18nManager } from "react-native";
import Svg, { Circle, Path, Rect } from "react-native-svg";
import { getAppIcon } from "@rezumi/icons";
import { size as sizes } from "./tokens";

export type IconName = AppIconName;

/** Icons that point somewhere mirror in right-to-left layouts (web DESIGN.md → Iconography). */
const directional = new Set<IconName>([
	"arrow-left",
	"arrow-right",
	"arrow-u-up-left",
	"arrow-u-up-right",
	"caret-left",
	"caret-right",
]);

const elements = { path: Path, circle: Circle, rect: Rect } as const;

const camel = (name: string) => name.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase());

/** The source files paint with `currentColor`; react-native-svg resolves it from the `color` prop on `Svg`. */
function toProps(attributes: Readonly<Record<string, string>>) {
	return Object.fromEntries(Object.entries(attributes).map(([key, value]) => [camel(key), value]));
}

function Glyph({ nodes }: { nodes: readonly IconNode[] }) {
	return nodes.map(([tag, attributes], index) => {
		const Element = elements[tag as keyof typeof elements];
		// An element type the generator may add later (ellipse) is skipped rather than crashing the screen.
		return Element ? <Element key={index} {...toProps(attributes)} /> : null;
	});
}

export type IconProps = {
	name: IconName;
	variant?: IconVariant | undefined;
	/** 16 in chips and small buttons, 20 in rows (default), 24 on touch targets and bars. */
	size?: number | undefined;
	/** A theme color name; ignored when `color` is set. Defaults to `foreground`. */
	tone?: ThemeColor | undefined;
	/** A computed color (from `useThemeColor`), for icons on a fill whose color the parent knows. */
	color?: string | undefined;
};

/** A decorative glyph: hidden from screen readers. The control around it carries the accessible name. */
export const Icon = memo(function Icon({ name, variant = "stroke", size = sizes.icon.md, tone, color }: IconProps) {
	const themed = useThemeColor(tone ?? "foreground");
	const mirrored = I18nManager.isRTL && directional.has(name);
	return (
		<Svg
			width={size}
			height={size}
			viewBox="0 0 24 24"
			fill="none"
			color={color ?? themed}
			style={mirrored ? { transform: [{ scaleX: -1 }] } : undefined}
			accessibilityElementsHidden
			importantForAccessibility="no-hide-descendants"
			testID={`icon-${name}`}
		>
			<Glyph nodes={getAppIcon(name, variant)} />
		</Svg>
	);
});
