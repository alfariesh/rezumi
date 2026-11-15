import { describe, expect, it } from "vite-plus/test";
import { dueBefore } from "./follow-ups";

describe("dueBefore", () => {
	it("is midnight UTC of tomorrow's calendar day in the time zone", () => {
		// 2026-11-20 20:00 UTC is already 2026-11-21 in Jakarta (UTC+7), still 2026-11-20 in New York.
		const now = new Date("2026-11-20T20:00:00Z");
		expect(dueBefore("Asia/Jakarta", now).toISOString()).toBe("2026-11-22T00:00:00.000Z");
		expect(dueBefore("America/New_York", now).toISOString()).toBe("2026-11-21T00:00:00.000Z");
		expect(dueBefore("UTC", now).toISOString()).toBe("2026-11-21T00:00:00.000Z");
	});

	it("treats a missing or unknown time zone as UTC", () => {
		const now = new Date("2026-12-31T23:30:00Z");
		expect(dueBefore(undefined, now).toISOString()).toBe("2027-01-01T00:00:00.000Z");
		expect(dueBefore("Mars/Olympus", now).toISOString()).toBe("2027-01-01T00:00:00.000Z");
	});
});
