import type { Locale } from "../i18n/config";

/** BCP 47 tags for date formatting; Indonesian dates read "5 November 2026". */
const DATE_LOCALES: Record<Locale, string> = { en: "en-US", id: "id-ID" };

/** The newsroom's timezone, so a post published late in Jakarta is not dated the day before. */
export const DEFAULT_TIMEZONE = "Asia/Jakarta";

export function formatDate(date: Date, locale: Locale, timeZone: string = DEFAULT_TIMEZONE): string {
	return new Intl.DateTimeFormat(DATE_LOCALES[locale], { dateStyle: "long", timeZone }).format(date);
}
