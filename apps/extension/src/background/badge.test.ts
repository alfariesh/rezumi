import { describe, expect, it } from "vite-plus/test";
import { badgeFor } from "./badge";

describe("badgeFor", () => {
	it("shows a green check for a saved posting, whatever is due", () => {
		expect(badgeFor({ saved: true, due: 3, locale: "en" })).toEqual({
			text: "✓",
			color: "#16a34a",
			title: "Rezumi: this job is saved",
		});
	});

	it("counts due follow-ups elsewhere", () => {
		expect(badgeFor({ saved: false, due: 1, locale: "en" })).toMatchObject({
			text: "1",
			title: "Rezumi: 1 follow-up due",
		});
		expect(badgeFor({ saved: false, due: 2, locale: "id" })).toMatchObject({
			text: "2",
			color: "#dc2626",
			title: "Rezumi: 2 tindak lanjut jatuh tempo",
		});
		expect(badgeFor({ saved: false, due: 140, locale: "en" }).text).toBe("99+");
	});

	it("is empty with the default title when nothing is due", () => {
		expect(badgeFor({ saved: false, due: 0, locale: "en" })).toMatchObject({ text: "", title: "" });
	});
});
