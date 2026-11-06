import { describe, expect, it } from "vite-plus/test";
import { formatDate } from "./dates";

describe("formatDate", () => {
	// 20:00 UTC on 4 November is 03:00 on 5 November in Jakarta.
	const lateEvening = new Date("2026-11-04T20:00:00Z");

	it("dates in the newsroom's timezone and the reader's language", () => {
		expect(formatDate(lateEvening, "en")).toBe("November 5, 2026");
		expect(formatDate(lateEvening, "id")).toBe("5 November 2026");
	});

	it("accepts the timezone from site settings", () => {
		expect(formatDate(lateEvening, "en", "UTC")).toBe("November 4, 2026");
	});
});
