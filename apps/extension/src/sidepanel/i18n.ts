import { i18n } from "@lingui/core";
import { messages as en } from "../../locales/en.po";
import { messages as id } from "../../locales/id.po";
import { resolveLanguage } from "../shared/storage";

export type PanelLocale = "en" | "id";

/**
 * The panel's language when the extension's setting says "same as the browser": the browser's, when it is
 * Indonesian, else English (plan rule #9). The setting itself comes first (02-teknis.md §13, `resolveLanguage`).
 */
export function panelLocale(uiLanguage: string): PanelLocale {
	return resolveLanguage("system", uiLanguage);
}

export function activatePanelLocale(locale: PanelLocale) {
	i18n.load({ en, id });
	if (i18n.locale !== locale) i18n.activate(locale);
	document.documentElement.lang = locale;
	return i18n;
}
