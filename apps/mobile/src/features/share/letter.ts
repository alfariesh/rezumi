import type { LetterWords } from "@rezumi/resume/cover-letter";
import { setupI18n } from "@lingui/core";
import { t } from "@lingui/core/macro";
import { defaultLocale, isLocale } from "@rezumi/utils/locale";
import { loadCatalog } from "@/i18n/catalog";

export async function letterWords(locale: string): Promise<LetterWords> {
	const resolved = isLocale(locale) ? locale : defaultLocale;
	const messages = await loadCatalog(resolved);
	const i18n = setupI18n();
	i18n.loadAndActivate({ locale: resolved, messages });
	return {
		greeting: (name) => t(i18n)`Dear ${name},`,
		teamGreeting: t(i18n)`Dear hiring team,`,
		hiringTeam: t(i18n)`Hiring team`,
		signOff: t(i18n)`Kind regards,`,
		formatDate: (date) =>
			new Date(`${date}T12:00:00Z`).toLocaleDateString(resolved, {
				day: "numeric",
				month: "long",
				year: "numeric",
				timeZone: "UTC",
			}),
	};
}
