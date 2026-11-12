import { i18n } from "@lingui/core";
import { messages as en } from "../../locales/en.po";
import { messages as id } from "../../locales/id.po";

export type PanelLocale = "en" | "id";

/**
 * The panel's language: the browser's, when it is Indonesian, else English (plan rule #9). From Phase 04 the
 * extension's own setting comes first (02-teknis.md §13).
 */
export function panelLocale(uiLanguage: string): PanelLocale {
	return /^id\b|^in\b/i.test(uiLanguage) ? "id" : "en";
}

export function activatePanelLocale(locale: PanelLocale) {
	i18n.load({ en, id });
	i18n.activate(locale);
	document.documentElement.lang = locale;
	return i18n;
}
