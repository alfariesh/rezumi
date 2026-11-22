import { describe, expect, it } from "vite-plus/test";
import {
	activeFilterCount,
	alertFields,
	alertSearch,
	startingAlertSearch,
	formatPay,
	payRange,
	placeLabel,
	fromCriteria,
	jobsSearchSchema,
	startingSearch,
	toSearchRequest,
	withoutFilters,
	sameSearch,
} from "./jobs";

const search = (input: Record<string, unknown> = {}) => jobsSearchSchema.parse({ q: "data analyst", ...input });

describe("toSearchRequest", () => {
	it("asks for remote anywhere without a country, and remote in a country with one", () => {
		expect(toSearchRequest(search({ arrangement: "remote" }))).toMatchObject({ remote: "only" });
		expect(toSearchRequest(search({ arrangement: "remote" }))).not.toHaveProperty("country");
		expect(toSearchRequest(search({ arrangement: "remote", country: "GB" }))).toMatchObject({
			remote: "only",
			country: "GB",
		});
	});

	it("picks hybrid or on-site as an arrangement, not the remote filter", () => {
		const hybrid = toSearchRequest(search({ arrangement: "hybrid" }));
		expect(hybrid).toMatchObject({ remote: "any", workArrangement: "hybrid" });
		expect(toSearchRequest(search())).not.toHaveProperty("workArrangement");
	});

	it("sends minimum pay in the country's currency unless one was chosen, keeping listings without pay by default", () => {
		expect(toSearchRequest(search({ minPay: 60_000, country: "GB" }))).toMatchObject({
			salaryMin: 60_000,
			salaryCurrency: "GBP",
			includeNoSalary: true,
		});
		expect(toSearchRequest(search({ minPay: 60_000, country: "GB", currency: "EUR", noPay: false }))).toMatchObject({
			salaryCurrency: "EUR",
			includeNoSalary: false,
		});
		expect(toSearchRequest(search({ minPay: 60_000 }))).toMatchObject({ salaryCurrency: "USD" });
		expect(toSearchRequest(search())).not.toHaveProperty("salaryMin");
	});

	it("asks for visa sponsorship only when chosen", () => {
		expect(toSearchRequest(search({ visa: true }))).toMatchObject({ visaSponsorship: true });
		expect(toSearchRequest(search())).not.toHaveProperty("visaSponsorship");
	});

	it("passes the posting window, level and city", () => {
		expect(toSearchRequest(search({ posted: 7, level: "senior", location: "Berlin" }))).toMatchObject({
			postedWithinDays: 7,
			seniority: "senior",
			location: "Berlin",
		});
	});
});

describe("filters", () => {
	it("counts filters and clears them, keeping the role, place and country", () => {
		const filtered = search({ posted: 7, arrangement: "remote", visa: true, minPay: 50_000, country: "DE" });
		expect(activeFilterCount(filtered)).toBe(4);
		const cleared = withoutFilters(filtered);
		expect(activeFilterCount(cleared)).toBe(0);
		expect(cleared).toMatchObject({ q: "data analyst", country: "DE" });
	});

	it("drops values the address can't hold", () => {
		expect(jobsSearchSchema.parse({ q: "x", posted: 3, country: "germany", level: "boss" })).toMatchObject({
			posted: 30,
			country: "",
			level: "",
		});
	});
});

describe("startingSearch", () => {
	const defaults = { query: "Nurse", location: "", country: "GB", remote: "only" as const, suggestions: ["Nurse"] };

	it("starts from the preferences before any search", () => {
		expect(startingSearch(jobsSearchSchema.parse({}), defaults)).toMatchObject({
			q: "Nurse",
			country: "GB",
			arrangement: "remote",
		});
	});

	it("keeps the last search once there is one", () => {
		expect(startingSearch(search({ country: "US" }), defaults)).toMatchObject({ q: "data analyst", country: "US" });
	});
});

describe("jobsSearchSchema", () => {
	it("keeps a minimum pay in currencies with large amounts", () => {
		expect(search({ minPay: 150_000_000, currency: "IDR" }).minPay).toBe(150_000_000);
	});
});

describe("fromCriteria", () => {
	it("reads a saved search back as the same address", () => {
		for (const value of [
			search({ country: "GB", location: "Leeds", arrangement: "remote", level: "senior", visa: true }),
			search({ arrangement: "hybrid", posted: 7, minPay: 60_000, currency: "GBP", noPay: false }),
		]) {
			const request = toSearchRequest(value);
			expect(toSearchRequest(fromCriteria({ ...request, includeNoSalary: request.includeNoSalary ?? true }))).toEqual(
				request,
			);
		}
	});
});

describe("sameSearch", () => {
	it("matches a job alert with the same role in any case, place and filters", () => {
		const request = toSearchRequest(search({ country: "GB", arrangement: "remote" }));
		expect(sameSearch({ ...request, query: " Data Analyst " }, request)).toBe(true);
		expect(sameSearch({ ...request, country: "DE" }, request)).toBe(false);
		expect(sameSearch({ query: "data analyst" }, toSearchRequest(search()))).toBe(true);
	});
});

describe("payRange", () => {
	it("shows the listed range in its own currency, with what it's per", () => {
		expect(payRange({ min: 70_000, max: 85_000, currency: "GBP", period: "year" }, "en-GB")).toEqual({
			range: "£70k–£85k",
			period: "year",
		});
		expect(payRange({ min: 25, currency: "USD", period: "hour" }, "en-US")).toEqual({ range: "$25", period: "hour" });
		expect(payRange({ max: 4_000, currency: "EUR", period: "month" }, "en-US")?.range).toBe("€4,000");
	});

	it("shows nothing for a listing without pay", () => {
		expect(payRange(undefined, "en-US")).toBeNull();
		expect(payRange({ currency: "USD", period: "year" }, "en-US")).toBeNull();
	});

	it("spells out a currency the runtime doesn't know", () => {
		expect(formatPay(500, "", "en-US")).toBe("500");
		expect(formatPay(500, "XYZ1", "en-US")).toBe("XYZ1 500");
	});
});

describe("placeLabel", () => {
	it("uses the posting's own place, else its parts", () => {
		expect(placeLabel({ location: { text: "Berlin, Germany" } })).toBe("Berlin, Germany");
		expect(placeLabel({ location: { text: "", city: "Austin", region: "TX", country: "United States" } })).toBe(
			"Austin, TX, United States",
		);
	});
});

describe("job alerts", () => {
	const defaults = { query: "Nurse", location: "Leeds", country: "GB", remote: "any" as const, suggestions: [] };

	it("start from the alert's own search, else the Jobs page's, else Preferences, else the first role", () => {
		const saved = {
			query: "Designer",
			country: "DE",
			postedWithinDays: 7 as const,
			includeNoSalary: true,
			remote: "any" as const,
		};
		expect(
			startingAlertSearch({ existing: { search: saved, query: "x" }, search: undefined, defaults, targetRoles: [] }),
		).toBe(saved);
		expect(
			startingAlertSearch({
				existing: { search: null, query: "Old role" },
				search: undefined,
				defaults,
				targetRoles: [],
			}),
		).toEqual({ query: "Old role" });
		expect(startingAlertSearch({ existing: null, search: { query: "Analyst" }, defaults, targetRoles: [] })).toEqual({
			query: "Analyst",
		});
		expect(startingAlertSearch({ existing: null, search: undefined, defaults, targetRoles: [] })).toEqual({
			query: "Nurse",
			location: "Leeds",
			country: "GB",
			remote: "any",
		});
		expect(
			startingAlertSearch({ existing: null, search: undefined, defaults: undefined, targetRoles: ["Chef"] }),
		).toEqual({ query: "Chef" });
	});

	it("keep the other filters when the role, city and country change", () => {
		const fields = alertFields({
			query: "Designer",
			location: "Berlin",
			country: "DE",
			seniority: "senior",
			visaSponsorship: true,
		});
		expect(fields).toEqual({
			role: "Designer",
			city: "Berlin",
			country: "DE",
			filters: { seniority: "senior", visaSponsorship: true },
		});
		expect(alertSearch({ ...fields, role: " Product designer ", city: "  ", country: "" })).toEqual({
			query: "Product designer",
			seniority: "senior",
			visaSponsorship: true,
		});
	});
});
