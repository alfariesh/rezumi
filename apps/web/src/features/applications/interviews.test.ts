import { describe, expect, it } from "vite-plus/test";
import { fromDateTimeLocal, toDateTimeLocal } from "./interviews";

describe("interviews", () => {
	it("round-trips datetime-local values", () => {
		const iso = fromDateTimeLocal("2026-10-05T09:30");
		expect(iso).not.toBeNull();
		expect(toDateTimeLocal(iso ?? "")).toBe("2026-10-05T09:30");
		expect(fromDateTimeLocal("")).toBeNull();
	});
});
