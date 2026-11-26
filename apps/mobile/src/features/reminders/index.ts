// Local, on-device reminders for interviews and follow-ups (owner decision: no push server), and .ics sharing.
// Permission is asked only when the user turns a reminder on. Each reminder's identifier comes from `reminderId`, so
// scheduling again replaces it, and its `data` remembers the lead time and start it was scheduled for.
import type { ReminderKind } from "./schedule";
import type { CalendarEvent } from "@rezumi/career/ics";
import { t } from "@lingui/core/macro";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { File, Paths } from "expo-file-system";
import * as Notifications from "expo-notifications";
import * as Sharing from "expo-sharing";
import Storage from "expo-sqlite/kv-store";
import { Platform } from "react-native";
import { buildIcs } from "@rezumi/career/ics";
import { createSerialQueue } from "@rezumi/utils/queue";
import { reminderId, reminderTime } from "./schedule";
import { askPermission } from "@/shell/permissions";

export * from "@rezumi/career/ics";
export * from "./schedule";

export type ReminderTarget = {
	kind: ReminderKind;
	applicationId: string;
	entryId?: string | undefined;
	start: Date;
	title: string;
	body: string;
};

type ReminderData = { applicationId: string; lead: number; start: string; title: string; body: string };

export type ScheduleResult = "scheduled" | "denied" | "passed";

const CHANNEL = "reminders";
const serial = createSerialQueue();
const preferenceKey = (kind: ReminderKind) => `reminders:${kind}`;
export const reminderEnabled = (kind: ReminderKind) => Storage.getItemSync(preferenceKey(kind)) !== "off";

export function setReminderEnabled(kind: ReminderKind, enabled: boolean) {
	return serial(async () => {
		if (!enabled) {
			const scheduled = await Notifications.getAllScheduledNotificationsAsync();
			const matches = scheduled.filter(({ identifier }) => identifier.startsWith(`${kind}:`));
			await Promise.all(matches.map(({ identifier }) => Notifications.cancelScheduledNotificationAsync(identifier)));
		}
		Storage.setItemSync(preferenceKey(kind), enabled ? "on" : "off");
	});
}

const queryKey = (applicationId: string) => ["reminders", applicationId] as const;
const idOf = (target: Pick<ReminderTarget, "kind" | "applicationId" | "entryId">) =>
	reminderId(target.kind, target.applicationId, target.entryId);

/** Asks for permission (after the explaining sheet) only if it hasn't been answered; false when notifications are off. */
const requestPermission = () =>
	askPermission(
		"notifications",
		{ get: () => Notifications.getPermissionsAsync(), request: () => Notifications.requestPermissionsAsync() },
		// The reminder screen says itself when notifications are off.
		true,
	);

/**
 * Asks for notifications when the person turns a reminder on (the primer first, the system prompt once); true when
 * reminders can fire.
 */
export const allowReminders = () =>
	reminderEnabled("interview")
		? askPermission("notifications", {
				get: () => Notifications.getPermissionsAsync(),
				request: () => Notifications.requestPermissionsAsync(),
			})
		: Promise.resolve(false);

async function schedule(target: ReminderTarget, lead: number): Promise<ScheduleResult> {
	const id = idOf(target);
	const at = reminderTime(target.start, lead);
	if (!at) {
		await Notifications.cancelScheduledNotificationAsync(id);
		return "passed";
	}
	if (Platform.OS === "android") {
		await Notifications.setNotificationChannelAsync(CHANNEL, {
			name: t`Reminders`,
			importance: Notifications.AndroidImportance.HIGH,
		});
	}
	const data: ReminderData = {
		applicationId: target.applicationId,
		lead,
		start: target.start.toISOString(),
		title: target.title,
		body: target.body,
	};
	await Notifications.scheduleNotificationAsync({
		identifier: id,
		content: { title: target.title, body: target.body, data },
		trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: at, channelId: CHANNEL },
	});
	return "scheduled";
}

/** Reminders scheduled on this device for one application: notification identifier → lead minutes. */
async function scheduledFor(applicationId: string) {
	const all = await Notifications.getAllScheduledNotificationsAsync();
	return all.flatMap((request) => {
		const data = request.content.data as Partial<ReminderData> | null;
		return data?.applicationId === applicationId && typeof data.lead === "number"
			? [{ id: request.identifier, data: data as ReminderData }]
			: [];
	});
}

/** The application's reminders, and actions to turn one on (asking permission then) or off. */
export function useReminders(applicationId: string) {
	const queryClient = useQueryClient();
	const query = useQuery({
		queryKey: queryKey(applicationId),
		queryFn: async () => new Map((await scheduledFor(applicationId)).map(({ id, data }) => [id, data.lead] as const)),
		enabled: !!applicationId,
	});
	const refresh = () => queryClient.invalidateQueries({ queryKey: queryKey(applicationId) });

	return {
		/** Lead minutes of the reminder for this target, or null when none is scheduled. */
		leadFor: (target: Pick<ReminderTarget, "kind" | "applicationId" | "entryId">) =>
			query.data?.get(reminderId(target.kind, target.applicationId, target.entryId)) ?? null,
		turnOn: async (target: ReminderTarget, lead: number): Promise<ScheduleResult> => {
			if (!reminderEnabled(target.kind) || !(await requestPermission())) return "denied";
			const result = await serial(() =>
				reminderEnabled(target.kind) ? schedule(target, lead) : Promise.resolve("denied" as const),
			);
			await refresh();
			return result;
		},
		turnOff: async (target: Pick<ReminderTarget, "kind" | "applicationId" | "entryId">) => {
			await serial(() => Notifications.cancelScheduledNotificationAsync(idOf(target)));
			await refresh();
		},
	};
}

/** Reminders of interviews hidden behind an undo toast: sync leaves them alone until the delete commits or is undone. */
const held = new Set<string>();
export const holdReminder = (entryId: string) => held.add(reminderId("interview", "", entryId));
export const releaseReminder = (entryId: string) => held.delete(reminderId("interview", "", entryId));

/**
 * Keeps scheduled reminders in step with the application: an interview moved (here or on the web) moves its reminder,
 * a deleted interview, cleared follow-up or closed application cancels it. Never asks for permission.
 */
export async function syncReminders(applicationId: string, targets: ReminderTarget[]) {
	await serial(async () => {
		const byId = new Map(targets.map((target) => [idOf(target), target]));
		for (const { id, data } of await scheduledFor(applicationId)) {
			if (held.has(id)) continue;
			const target = byId.get(id);
			if (!target || !reminderEnabled(target.kind)) await Notifications.cancelScheduledNotificationAsync(id);
			else if (data.start !== target.start.toISOString() || data.title !== target.title || data.body !== target.body)
				await schedule(target, data.lead);
		}
	});
}

/** Shares one event as an .ics file through the system share sheet; no calendar permission is needed. */
export async function shareIcs(event: CalendarEvent, fileName: string) {
	// The previous share's file can go now: recipients have read it once shareAsync resolved.
	for (const entry of Paths.cache.list()) {
		if (entry instanceof File && entry.name.endsWith(".ics")) entry.delete();
	}
	if (!(await Sharing.isAvailableAsync())) throw new Error("Sharing unavailable");
	const file = new File(Paths.cache, fileName);
	await file.write(buildIcs(event));
	await Sharing.shareAsync(file.uri, { mimeType: "text/calendar", UTI: "com.apple.ical.ics" });
}
