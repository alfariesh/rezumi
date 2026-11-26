// Interface language: the device locale (expo-localization) unless the user picked one in App settings.
// Catalogs are apps/mobile/locales/*.po, seeded from the web catalogs by scripts/seed-locales.mjs.
import type { Messages } from "@lingui/core";
import type { Locale } from "@rezumi/utils/locale";
import { i18n } from "@lingui/core";
import { getLocales } from "expo-localization";
import Storage from "expo-sqlite/kv-store";
import { I18nManager, Platform, Settings } from "react-native";
import { defaultLocale, isLocale, isRTL, localeSchema } from "@rezumi/utils/locale";
import { loadCatalog } from "./catalog";

const storageKey = "locale";

/** The supported locale closest to the device's preferred languages. */
export function getDeviceLocale(): Locale {
	const supported = localeSchema.options;
	for (const { languageTag, languageCode } of getLocales()) {
		if (isLocale(languageTag)) return languageTag;
		const sameLanguage = supported.find((locale) => locale.split("-")[0] === languageCode);
		if (sameLanguage) return sameLanguage;
	}
	return defaultLocale;
}

/** The user's override, or null to follow the device. */
export function getLocalePreference(): Locale | null {
	const stored = Storage.getItemSync(storageKey);
	return isLocale(stored) ? stored : null;
}

/**
 * Saves the override (null follows the device) and activates it. Changing between a left-to-right and a
 * right-to-left language only flips the layout after the app restarts: React Native reads the direction at launch.
 * Returns true when a restart is needed.
 */
export async function setLocalePreference(locale: Locale | null): Promise<boolean> {
	const selected = locale ?? getDeviceLocale();
	const messages = await loadCatalog(selected);
	if (locale) Storage.setItemSync(storageKey, locale);
	else Storage.removeItemSync(storageKey);
	return activateCatalog(selected, messages);
}

function activateCatalog(locale: Locale, messages: Messages) {
	const rtl = isRTL(locale);
	const restart = I18nManager.isRTL !== rtl;
	if (Platform.OS === "ios") {
		// expo-localization resets forceRTL at launch; UIKit's persisted direction survives that reset.
		Settings.set({ AppleTextDirection: rtl, NSForceRightToLeftWritingDirection: rtl });
	}
	// Applying these even when the current layout matches clears a deferred direction change.
	I18nManager.allowRTL(rtl);
	I18nManager.forceRTL(rtl);
	i18n.loadAndActivate({ locale, messages });
	return restart;
}

/** Activates the preferred locale at startup. */
export async function initI18n() {
	const locale = getLocalePreference() ?? getDeviceLocale();
	try {
		return activateCatalog(locale, await loadCatalog(locale));
	} catch (error) {
		if (locale === defaultLocale) throw error;
		return activateCatalog(defaultLocale, await loadCatalog(defaultLocale));
	}
}

export { i18n };
