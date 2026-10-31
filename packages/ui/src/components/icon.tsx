import type { AppIconName, IconNode, IconVariant } from "@rezumi/icons";
import * as React from "react";
import { getAppIcon } from "@rezumi/icons";
import { cn } from "@rezumi/utils/style";

/** Every app icon: a stable Phosphor-style name, drawn from the Hugeicons Pro set staged in `@rezumi/icons`. */
type IconName = AppIconName;

// Icons that point somewhere are mirrored in right-to-left layouts.
const DIRECTIONAL_ICONS = new Set<IconName>([
	"arrow-left",
	"arrow-right",
	"arrow-u-up-left",
	"arrow-u-up-right",
	"caret-left",
	"caret-right",
]);

type IconProps = Omit<React.ComponentProps<"span">, "children"> & {
	name: IconName;
	/**
	 * `stroke` (default) is the standard line glyph. `duotone` adds a soft fill; the design system reserves it for the
	 * selected navigation item, the active tab or segment, and the few glyphs that read as solid (stop, play, star).
	 */
	variant?: IconVariant | undefined;
	/** Glyph size in CSS pixels: 20 on desktop, 24 on touch. */
	size?: number | undefined;
};

// SVG attribute names React expects, from the kebab-case ones in the Hugeicons files.
const camelCase = (attribute: string) => attribute.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase());

function renderNode([tag, attributes]: IconNode, index: number) {
	const props: Record<string, string> = { key: String(index) };
	for (const [name, value] of Object.entries(attributes)) props[camelCase(name)] = value;
	return React.createElement(tag, props);
}

/**
 * A Hugeicons glyph sized by the span's font size, so containers can resize it with `text-*` like text.
 * Icons are decorative: the control they sit in carries the accessible name.
 */
function Icon({ name, variant = "stroke", size = 20, className, style, ...props }: IconProps) {
	return (
		<span
			aria-hidden="true"
			data-slot="icon"
			{...props}
			className={cn("inline-block size-[1em] shrink-0", DIRECTIONAL_ICONS.has(name) && "rtl:-scale-x-100", className)}
			style={{ fontSize: size, ...style }}
		>
			{/*
			 * Inline sizing and margin, so the rules buttons and menus give bare SVGs (`size-4`, and HeroUI's `-mx-0.5 my-0.5`
			 * optical nudge) can't shrink the glyph or shift it off the centre of this box.
			 */}
			<svg
				viewBox="0 0 24 24"
				fill="none"
				focusable="false"
				style={{ display: "block", width: "100%", height: "100%", margin: 0 }}
			>
				{getAppIcon(name, variant).map(renderNode)}
			</svg>
		</span>
	);
}

export { Icon, type IconName, type IconProps };
