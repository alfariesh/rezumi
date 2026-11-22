import type { OfferTerms } from "@rezumi/schema/career";
import { describe, expect, it } from "vite-plus/test";
import { dateOnlyDeadline, defaultPair, matchingPlace, meetsMinimum, moneyDifference } from "./offers";

const terms = (patch: Partial<OfferTerms>) => ({ currency: "USD", period: "year", base: null, ...patch }) as OfferTerms;

describe("dateOnlyDeadline", () => {
	// West of UTC the evening is already tomorrow in UTC: a bare day must not slide back or forward.
	it("keeps the day itself west of UTC", () => {
		const evening = new Date("2026-11-21T03:30:00Z"); // 19:30 on Nov 20 in Los Angeles
		const deadline = dateOnlyDeadline("2026-11-21", evening, "America/Los_Angeles");
		expect(deadline.days).toBe(1);
		expect(deadline.date.toISOString().slice(0, 10)).toBe("2026-11-21");
		expect(deadline.date.getUTCDate()).toBe(21);
	});

	it("counts today, tomorrow and past days on the user's clock", () => {
		const now = new Date("2026-11-20T18:00:00Z");
		expect(dateOnlyDeadline("2026-11-20", now, "America/New_York").days).toBe(0);
		expect(dateOnlyDeadline("2026-11-18", now, "America/New_York").days).toBe(-2);
		expect(dateOnlyDeadline("2026-11-21", new Date("2026-11-21T02:00:00Z"), "Asia/Jakarta").days).toBe(0);
	});
});

describe("comparing offers", () => {
	it("compares money only in the same currency and period", () => {
		expect(moneyDifference(terms({ base: 120 }), terms({ base: 100 }), "base")).toBe(20);
		expect(moneyDifference(terms({ base: 120 }), terms({ base: 100, currency: "EUR" }), "base")).toBeNull();
		expect(meetsMinimum(terms({ base: 90 }), { amount: 100, currency: "USD", period: "year" })).toBe(false);
		expect(meetsMinimum(terms({ base: 90 }), { amount: null, currency: "USD", period: "year" })).toBeNull();
	});

	it("matches places either way and opens two offers from different applications", () => {
		expect(matchingPlace("Berlin, Germany", ["berlin"])).toBe("berlin");
		expect(matchingPlace("", ["berlin"])).toBeUndefined();
		expect(
			defaultPair([
				{ id: "1", applicationId: "a" },
				{ id: "2", applicationId: "a" },
				{ id: "3", applicationId: "b" },
			]),
		).toEqual(["1", "3"]);
	});
});
