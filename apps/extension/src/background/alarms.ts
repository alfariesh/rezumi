/**
 * Recurring work, as `chrome.alarms` (a service worker sleeps between events, so timers would not survive). Phase 01
 * only registers the schedule; the work arrives with the features that need it.
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

const alarmWork: Record<AlarmName, () => Promise<void>> = {
	// Phase 04: applications.savedKeys while connected.
	"sync-saved-keys": async () => {},
	// Phase 05: due follow-ups, badge count and notifications.
	"follow-ups": async () => {},
};

export async function runAlarm(alarm: chrome.alarms.Alarm) {
	const work = alarmWork[alarm.name as AlarmName] as (() => Promise<void>) | undefined;
	await work?.();
}
