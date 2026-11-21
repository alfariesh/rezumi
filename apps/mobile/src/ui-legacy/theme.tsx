// Legacy token set for screens not yet rebuilt on src/ui. The preference itself lives in src/ui/theme.ts.
import type { ColorScheme } from "./tokens";
import { colors, fonts, motion, radius, shadows, size, space, type } from "./tokens";
import { useColorSchemeValue } from "@/ui/theme";

export { setThemePreference, useThemePreference, type ThemePreference } from "@/ui/theme";

const themes = {
	light: { scheme: "light", colors: colors.light, shadows: shadows.light, fonts, type, space, size, radius, motion },
	dark: { scheme: "dark", colors: colors.dark, shadows: shadows.dark, fonts, type, space, size, radius, motion },
} as const satisfies Record<ColorScheme, { scheme: ColorScheme } & Record<string, unknown>>;

export type Theme = (typeof themes)[ColorScheme];

/** The legacy token set for the effective colour scheme. */
export function useTheme(): Theme {
	return themes[useColorSchemeValue()];
}
