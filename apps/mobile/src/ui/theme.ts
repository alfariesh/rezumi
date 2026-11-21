// Settings → Appearance: system (the default), light or dark. Uniwind switches the global.css theme and sets the
// native Appearance override, so system UI (alerts, keyboards, pickers) and `useColorScheme` follow the choice too.
import type { ColorSchemeName } from "react-native";
import Storage from "expo-sqlite/kv-store";
import { useSyncExternalStore } from "react";
import { useColorScheme } from "react-native";
import { Uniwind } from "uniwind";

export type ThemePreference = "system" | "light" | "dark";
export type ColorScheme = "light" | "dark";

const storageKey = "theme";
const listeners = new Set<() => void>();

const readPreference = (): ThemePreference => {
	const stored = Storage.getItemSync(storageKey);
	return stored === "light" || stored === "dark" ? stored : "system";
};

let preference = readPreference();

/** Call once at startup, before the first render. */
export function initTheme() {
	Uniwind.setTheme(preference);
}

export function setThemePreference(value: ThemePreference) {
	preference = value;
	if (value === "system") Storage.removeItemSync(storageKey);
	else Storage.setItemSync(storageKey, value);
	Uniwind.setTheme(value);
	for (const listener of listeners) listener();
}

const subscribe = (listener: () => void) => {
	listeners.add(listener);
	return () => listeners.delete(listener);
};

export function useThemePreference(): ThemePreference {
	return useSyncExternalStore(subscribe, () => preference);
}

export const resolveScheme = (value: ThemePreference, system: ColorSchemeName | null): ColorScheme =>
	(value === "system" ? system : value) === "dark" ? "dark" : "light";

/** The effective color scheme, for the rare JavaScript decision that depends on it (status bar, native views). */
export function useColorSchemeValue(): ColorScheme {
	return resolveScheme(useThemePreference(), useColorScheme() ?? null);
}
