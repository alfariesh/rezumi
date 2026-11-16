import { nextReminderTime } from "../shared/follow-ups";

/**
 * Recurring work, as `chrome.alarms` (a service worker sleeps between events, so timers would not survive). The saved
 * keys sync arrived in Phase 04; the follow-ups in Phase 05.
 */
const ALARMS = {
	/** Refresh the saved posting keys behind the "Saved" marks (02-teknis.md §9). */
	syncSavedKeys: { name: "sync-saved-keys", periodInMinutes: 30 },
	/** Refresh the due follow-ups behind the badge count, and show reminders that are late (02-teknis.md §11). */
	followUps: { name: "follow-ups", periodInMinutes: 60 },
} as const;

/** The desktop reminders' daily 09:00 (aturan turunan #7), set again each time it fires so it follows clock changes. */
const REMINDER_ALARM = "follow-up-reminder";

type AlarmName = (typeof ALARMS)[keyof typeof ALARMS]["name"] | typeof REMINDER_ALARM;

/** Sets the reminder alarm for the next 09:00 on this device. */
async function scheduleReminder(now = new Date()) {
	await chrome.alarms.create(REMINDER_ALARM, { when: nextReminderTime(now).getTime() });
}

/** Creates each alarm once; an existing alarm keeps its schedule across service worker restarts. */
export async function registerAlarms() {
	for (const { name, periodInMinutes } of Object.values(ALARMS)) {
		if (!(await chrome.alarms.get(name))) await chrome.alarms.create(name, { periodInMinutes });
	}
	if (!(await chrome.alarms.get(REMINDER_ALARM))) await scheduleReminder();
}

/** What the alarms run, supplied by the service worker. */
export type AlarmWork = {
	syncSavedKeys: () => Promise<void>;
	/** Fetches the due follow-ups again, updates the badge and shows the reminders due now. */
	syncFollowUps: () => Promise<void>;
};

export async function runAlarm(alarm: chrome.alarms.Alarm, work: AlarmWork) {
	const jobs: Record<AlarmName, () => Promise<void>> = {
		// applications.savedKeys while connected (skipped when signed out).
		"sync-saved-keys": work.syncSavedKeys,
		// applications.dueFollowUps while connected; an hourly catch-up for reminders missed at 09:00.
		"follow-ups": work.syncFollowUps,
		[REMINDER_ALARM]: async () => {
			await scheduleReminder();
			await work.syncFollowUps();
		},
	};
	await (jobs[alarm.name as AlarmName] as (() => Promise<void>) | undefined)?.();
}
