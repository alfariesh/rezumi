// Device reminders follow the application: a moved interview's reminder moves (same lead), a deleted one is cancelled,
// one held behind an undo toast is left alone, and turning a reminder on asks for notifications first.
import * as Notifications from "expo-notifications";
import {
	allowReminders,
	holdReminder,
	releaseReminder,
	reminderEnabled,
	setReminderEnabled,
	syncReminders,
} from "./index";

jest.mock("expo-notifications", () => ({
	getPermissionsAsync: jest.fn(() => Promise.resolve({ granted: true, canAskAgain: true, status: "granted" })),
	requestPermissionsAsync: jest.fn(),
	getAllScheduledNotificationsAsync: jest.fn(),
	scheduleNotificationAsync: jest.fn(() => Promise.resolve("id")),
	cancelScheduledNotificationAsync: jest.fn(() => Promise.resolve()),
	setNotificationChannelAsync: jest.fn(),
	SchedulableTriggerInputTypes: { DATE: "date" },
	AndroidImportance: { HIGH: 4 },
}));

const scheduled = (id: string, start: string, lead = 30) => ({
	identifier: id,
	content: { data: { applicationId: "a", lead, start, title: "Technical interview · Acme", body: "Designer" } },
});

beforeEach(() => {
	jest
		.mocked(Notifications.getAllScheduledNotificationsAsync)
		.mockResolvedValue([
			scheduled("interview:i1", "2030-01-15T18:00:00.000Z", 60),
			scheduled("interview:i2", "2030-01-16T18:00:00.000Z"),
		] as never);
});
afterEach(() => jest.clearAllMocks());

describe("syncReminders", () => {
	it("moves a moved interview's reminder with its lead and cancels a deleted one's", async () => {
		const start = new Date("2030-01-15T20:00:00Z");
		await syncReminders("a", [
			{
				kind: "interview",
				applicationId: "a",
				entryId: "i1",
				start,
				title: "Technical interview · Acme",
				body: "Designer",
			},
		]);
		expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
			expect.objectContaining({
				identifier: "interview:i1",
				trigger: expect.objectContaining({ date: new Date("2030-01-15T19:00:00Z") }),
			}),
		);
		expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith("interview:i2");
	});

	it("leaves a reminder held behind an undo toast alone", async () => {
		holdReminder("i2");
		await syncReminders("a", []);
		expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith("interview:i1");
		expect(Notifications.cancelScheduledNotificationAsync).not.toHaveBeenCalledWith("interview:i2");
		releaseReminder("i2");
	});
});

describe("allowReminders", () => {
	it("is true once notifications are allowed, without asking again", async () => {
		await expect(allowReminders()).resolves.toBe(true);
		expect(Notifications.requestPermissionsAsync).not.toHaveBeenCalled();
	});
});

it("turns off one reminder type and cancels only its scheduled notifications", async () => {
	jest
		.mocked(Notifications.getAllScheduledNotificationsAsync)
		.mockResolvedValue([
			scheduled("interview:i1", "2030-01-15T18:00:00.000Z"),
			scheduled("follow-up:a", "2030-01-16T18:00:00.000Z", 0),
		] as never);
	try {
		await setReminderEnabled("interview", false);
		expect(reminderEnabled("interview")).toBe(false);
		expect(reminderEnabled("follow-up")).toBe(true);
		expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledTimes(1);
		expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith("interview:i1");
		await expect(allowReminders()).resolves.toBe(false);
		await syncReminders("a", [
			{
				kind: "interview",
				applicationId: "a",
				entryId: "i1",
				start: new Date("2030-01-17T18:00:00.000Z"),
				title: "Rescheduled",
				body: "Designer",
			},
		]);
		expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
	} finally {
		await setReminderEnabled("interview", true);
	}
});
