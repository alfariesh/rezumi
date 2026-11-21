// Legacy Icon API (`filled`, a hex `color`) for screens not yet rebuilt; it draws the new Hugeicons glyphs of
// src/ui/icon.tsx, so every screen already shows the web's icons. New code imports Icon from "@/ui".
import { Icon as NextIcon, type IconName } from "@/ui/icon";

export type { IconName };

export type IconProps = {
	name: IconName;
	/** The duotone glyph, reserved for the selected navigation item. */
	filled?: boolean | undefined;
	/** Glyph size in pt: 16 inline meta, 20 list rows, 22 toolbars, 24 tab bar and nav bar (tokens `size.icon`). */
	size?: number | undefined;
	/** Defaults to the theme foreground. */
	color?: string | undefined;
};

export function Icon({ name, filled = false, size = 20, color }: IconProps) {
	return <NextIcon name={name} variant={filled ? "duotone" : "stroke"} size={size} color={color} />;
}
