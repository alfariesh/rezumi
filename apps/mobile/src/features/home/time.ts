// Dates on Home in the account's timezone and the interface language, as on the web's Home.
import { useLingui } from "@lingui/react/macro";
import { useProfile } from "@/features/account/queries";

const ymd = (at: Date, timeZone: string) =>
	new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(at);

export function useHomeTime() {
	const profile = useProfile();
	const { i18n } = useLingui();
	const timeZone = profile.data?.timezone ?? "UTC";
	const locale = i18n.locale;
	const format = (value: Date | string, options: Intl.DateTimeFormatOptions) =>
		new Intl.DateTimeFormat(locale, { timeZone, ...options }).format(new Date(value));
	return {
		timeZone,
		locale,
		format,
		/** "21 Nov 2026, 09:00" */
		when: (value: Date | string) => format(value, { dateStyle: "medium", timeStyle: "short" }),
		/** "09:00" */
		time: (value: Date | string) => format(value, { timeStyle: "short" }),
		/** "Sat, 21 Nov" */
		day: (value: Date | string) => format(value, { weekday: "short", day: "numeric", month: "short" }),
		/** 0 today, -1 yesterday, 1 tomorrow (in the account's timezone), otherwise null. */
		dayOffset: (value: Date | string, now: Date) => {
			const days = Math.round(
				(Date.parse(ymd(new Date(value), timeZone)) - Date.parse(ymd(now, timeZone))) / 86_400_000,
			);
			return days >= -1 && days <= 1 ? days : null;
		},
	};
}

export type HomeTime = ReturnType<typeof useHomeTime>;
