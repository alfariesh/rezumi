// Dates in Applications: a bare day typed into a field, and the user's clock (Settings → Preferences time zone, else
// the device's) for every date and time the views show.
import { t } from "@lingui/core/macro";
import { useLingui } from "@lingui/react/macro";
import { deviceTimeZone, isTimeZone } from "@rezumi/career/time";
import { useProfile } from "@/features/settings/queries";

export { useNow } from "@/features/career/hooks";

export function parseDateOnly(value: string) {
	if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
	const [year, month, day] = value.split("-").map(Number);
	const date = new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, day ?? 0));
	return date.toISOString().slice(0, 10) === value ? value : undefined;
}

const pad = (value: number) => String(value).padStart(2, "0");

/** Today on the device's calendar, as `YYYY-MM-DD`. */
export const todayKey = (date = new Date()) =>
	`${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

/** Formatters in the user's time zone (Settings → Preferences), falling back to the device's, and the UI locale. */
export function useUserTime() {
	const { i18n } = useLingui();
	const profile = useProfile();
	const preferred = profile.data?.timezone;
	const timeZone = preferred && isTimeZone(preferred) ? preferred : deviceTimeZone();
	const format = (value: Date | string, options: Intl.DateTimeFormatOptions, zone = timeZone) =>
		new Intl.DateTimeFormat(i18n.locale, { timeZone: zone, ...options }).format(new Date(value));
	const time = (value: Date | string, zone?: string) =>
		format(value, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" }, zone);
	const day = (value: Date | string, zone?: string) =>
		format(value, { weekday: "short", day: "numeric", month: "short" }, zone);
	return {
		timeZone,
		locale: i18n.locale,
		/** "Mon 19 Oct" */
		day,
		/** "16:00" */
		time,
		/** "Mon 19 Oct, 16:00" */
		when: (value: Date | string, zone?: string) => `${day(value, zone)}, ${time(value, zone)}`,
		/** "12 Oct 2026" */
		date: (value: Date | string) => format(value, { day: "numeric", month: "short", year: "numeric" }),
		/** Stage and note entries are whole days stored at noon UTC: "12 Oct". */
		utcDay: (value: Date | string) => format(value, { day: "numeric", month: "short" }, "UTC"),
		/** "Tue" */
		weekday: (value: Date | string) => format(value, { weekday: "short" }),
	};
}

/** "10 min", "1 h", "1 day": how long before an interview its reminder fires. */
export const leadLabel = (minutes: number) => (minutes >= 1440 ? t`1 day` : minutes >= 60 ? t`1 h` : t`${minutes} min`);
