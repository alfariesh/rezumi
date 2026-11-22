// Words around a listing's own data (plans/mobile Phase 09): when it was posted in calendar days, how fresh a page is,
// and a saved search's filters.
import { i18n } from "@lingui/core";
import { postedAgo, searchFilterLabels, sourceLabel, updatedAgo } from "./format";

beforeAll(() => i18n.loadAndActivate({ locale: "en", messages: {} }));

describe("postedAgo", () => {
	const now = new Date(2026, 10, 22, 9, 0);
	it("counts calendar days on this device", () => {
		expect(postedAgo(new Date(2026, 10, 22, 0, 30).toISOString(), now, "en-US")).toBe("Posted today");
		expect(postedAgo(new Date(2026, 10, 21, 23, 30).toISOString(), now, "en-US")).toBe("Posted yesterday");
		expect(postedAgo(new Date(2026, 10, 18, 12, 0).toISOString(), now, "en-US")).toBe("Posted 4 days ago");
		expect(postedAgo(new Date(2026, 8, 1).toISOString(), now, "en-US")).toBe("Posted Sep 1, 2026");
	});
});

describe("updatedAgo", () => {
	it("says how fresh the results are", () => {
		const now = new Date("2026-11-22T09:00:00Z");
		expect(updatedAgo("2026-11-22T08:59:40Z", now)).toBe("updated just now");
		expect(updatedAgo("2026-11-22T08:55:00Z", now)).toBe("updated 5 min ago");
		expect(updatedAgo("2026-11-22T06:00:00Z", now)).toBe("updated 3 hours ago");
	});
});

describe("labels", () => {
	it("names where a listing came from and a search's filters", () => {
		expect(sourceLabel({ source: "greenhouse" })).toBe("via the company's careers site");
		expect(
			searchFilterLabels(
				{ remote: "only", country: "DE", seniority: "senior", visaSponsorship: true, postedWithinDays: 7 },
				"en-US",
			),
		).toEqual(["Remote in this country", "Senior", "Visa sponsorship", "Posted in the last week"]);
	});
});
