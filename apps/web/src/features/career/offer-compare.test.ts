import type { OfferTerms } from "@rezumi/schema/career";
import { describe, expect, it } from "vite-plus/test";
import { dateOnlyDeadline, meetsMinimum, moneyDifference } from "./offer-compare";

const offer = (patch: Partial<OfferTerms>): OfferTerms => ({
	version: "written",
	currency: "EUR",
	period: "year",
	base: 100_000,
	variable: null,
	variableConditions: "",
	equity: "",
	location: "",
	officeDays: null,
	leave: "",
	learning: null,
	other: "",
	respondBy: null,
	...patch,
});

describe("money is only compared in the same currency and pay period", () => {
	it("gives the difference when both match", () => {
		expect(moneyDifference(offer({ base: 108_000 }), offer({ base: 101_000 }), "base")).toBe(7000);
	});

	it("refuses a different currency, a different period, or an unknown amount", () => {
		expect(moneyDifference(offer({}), offer({ currency: "USD" }), "base")).toBeNull();
		expect(moneyDifference(offer({}), offer({ period: "month" }), "base")).toBeNull();
		expect(moneyDifference(offer({}), offer({ base: null }), "base")).toBeNull();
	});

	it("checks the Preferences minimum by the same rule", () => {
		expect(meetsMinimum(offer({}), { amount: 95_000, currency: "EUR", period: "year" })).toBe(true);
		expect(meetsMinimum(offer({}), { amount: 95_000, currency: "EUR", period: "month" })).toBeNull();
	});
});

describe("a deadline given as a day with no time", () => {
	// 16 November 2026, 20:00 in Jakarta (UTC+7); still the 16th in New York.
	const now = new Date("2026-11-16T13:00:00Z");

	it("shows the day itself, never shifted by the time zone", () => {
		expect(dateOnlyDeadline("2026-11-23", now, "America/New_York", "en-GB").label).toBe("Mon 23 Nov");
		expect(dateOnlyDeadline("2026-11-23", now, "Asia/Jakarta", "en-GB").label).toBe("Mon 23 Nov");
	});

	it("counts whole days from today in the user's time zone", () => {
		expect(dateOnlyDeadline("2026-11-23", now, "Asia/Jakarta", "en-GB")).toMatchObject({
			days: 7,
			relative: "In 7 days",
		});
		expect(dateOnlyDeadline("2026-11-17", now, "Asia/Jakarta", "en-GB").relative).toBe("Tomorrow");
		// 13:00 UTC is already the 17th in Kiritimati (UTC+14), so the same deadline is today there.
		expect(dateOnlyDeadline("2026-11-17", now, "Pacific/Kiritimati", "en-GB")).toMatchObject({
			days: 0,
			relative: "Today",
		});
		expect(dateOnlyDeadline("2026-11-15", now, "Asia/Jakarta", "en-GB").days).toBe(-1);
	});
});
