import { describe, expect, it } from "vite-plus/test";
import {
	addDays,
	deadlineDay,
	defaultFollowUpDay,
	followUpAt,
	followUpDay,
	isDue,
	markReminded,
	nextReminderTime,
	remindersToShow,
} from "./follow-ups";

describe("defaultFollowUpDay (aturan turunan #6)", () => {
	const today = "2026-11-15";

	it("is two days before the posting's closing date", () => {
		expect(defaultFollowUpDay("2026-12-31", today)).toBe("2026-12-29");
		expect(defaultFollowUpDay("2026-12-01T23:59:00+07:00", today)).toBe("2026-11-29");
	});

	it("is empty without a closing date, or when it has passed", () => {
		expect(defaultFollowUpDay(null, today)).toBe("");
		expect(defaultFollowUpDay("", today)).toBe("");
		expect(defaultFollowUpDay("not a date", today)).toBe("");
		expect(defaultFollowUpDay("2026-11-14", today)).toBe("");
	});

	it("reminds today when the deadline is sooner than two days", () => {
		expect(defaultFollowUpDay("2026-11-16", today)).toBe(today);
		expect(defaultFollowUpDay("2026-11-15", today)).toBe(today);
		expect(defaultFollowUpDay("2026-11-17", today)).toBe(today);
	});

	it("reads other date forms the page may give", () => {
		expect(deadlineDay("December 31, 2026")).toBe("2026-12-31");
		expect(deadlineDay("  ")).toBeNull();
	});
});

describe("follow-up days", () => {
	it("are stored as midnight UTC of the picked day and read back as that day", () => {
		expect(followUpAt("2026-11-20")?.toISOString()).toBe("2026-11-20T00:00:00.000Z");
		expect(followUpAt("")).toBeNull();
		expect(followUpDay("2026-11-20T00:00:00.000Z")).toBe("2026-11-20");
		expect(addDays("2026-12-30", 3)).toBe("2027-01-02");
	});

	it("are due today or earlier", () => {
		expect(isDue("2026-11-15T00:00:00.000Z", "2026-11-15")).toBe(true);
		expect(isDue("2026-11-10T00:00:00.000Z", "2026-11-15")).toBe(true);
		expect(isDue("2026-11-16T00:00:00.000Z", "2026-11-15")).toBe(false);
	});
});

describe("desktop reminders (aturan turunan #7)", () => {
	const at = (day: string, hour: number) => new Date(`${day}T${String(hour).padStart(2, "0")}:00:00`);
	const items = [
		{ id: "due", followUpAt: "2026-11-15T00:00:00.000Z" },
		{ id: "overdue", followUpAt: "2026-11-12T00:00:00.000Z" },
		{ id: "later", followUpAt: "2026-11-18T00:00:00.000Z" },
	];

	it("go out from 09:00 on this device, never earlier", () => {
		expect(remindersToShow(items, {}, at("2026-11-15", 8))).toEqual([]);
		expect(remindersToShow(items, {}, at("2026-11-15", 9)).map((item) => item.id)).toEqual(["due", "overdue"]);
	});

	it("show each application at most once a day", () => {
		const morning = at("2026-11-15", 9);
		const shown = markReminded({}, ["due", "overdue"], morning);
		expect(remindersToShow(items, shown, at("2026-11-15", 15))).toEqual([]);
		// The next day, still due: shown again, once.
		const nextDay = at("2026-11-16", 10);
		expect(remindersToShow(items, shown, nextDay).map((item) => item.id)).toEqual(["due", "overdue"]);
		expect(markReminded(shown, ["due"], nextDay)).toEqual({ due: "2026-11-16" });
	});

	it("are scheduled for the next 09:00", () => {
		expect(nextReminderTime(at("2026-11-15", 7)).getTime()).toBe(at("2026-11-15", 9).getTime());
		expect(nextReminderTime(at("2026-11-15", 9)).getTime()).toBe(at("2026-11-16", 9).getTime());
		expect(nextReminderTime(at("2026-11-15", 22)).getTime()).toBe(at("2026-11-16", 9).getTime());
	});
});
