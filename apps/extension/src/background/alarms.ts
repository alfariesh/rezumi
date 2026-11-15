/**
 * Recurring work, as `chrome.alarms` (a service worker sleeps between events, so timers would not survive). The saved
 * keys sync arrived in Phase 04; the follow-ups in Phase 05.
 */
const ALARMS = {
	/** Refresh the saved posting keys behind the "Saved" marks (02-teknis.md §9). */
	syncSavedKeys: { name: "sync-saved-keys", periodInMinutes: 30 },
	/** Refresh the due follow-ups badge and desktop reminders (02-teknis.md §11). */
	followUps: { name: "follow-ups", periodInMinutes: 60 },
} as const;

type AlarmName = (typeof ALARMS)[keyof typeof ALARMS]["name"];

/** Creates each alarm once; an existing alarm keeps its schedule across service worker restarts. */
export async function registerAlarms() {
	for (const { name, periodInMinutes } of Object.values(ALARMS)) {
		if (!(await chrome.alarms.get(name))) await chrome.alarms.create(name, { periodInMinutes });
	}
}

/** What the alarms run, supplied by the service worker. */
export type AlarmWork = { syncSavedKeys: () => Promise<void> };

export async function runAlarm(alarm: chrome.alarms.Alarm, work: AlarmWork) {
	const jobs: Record<AlarmName, () => Promise<void>> = {
		// applications.savedKeys while connected (skipped when signed out).
		"sync-saved-keys": work.syncSavedKeys,
		// Phase 05: due follow-ups, badge count and notifications.
		"follow-ups": async () => {},
	};
	await (jobs[alarm.name as AlarmName] as (() => Promise<void>) | undefined)?.();
}
