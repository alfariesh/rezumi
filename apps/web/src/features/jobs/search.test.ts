import { describe, expect, it } from "vite-plus/test";
import { activeFilterCount, jobsSearchSchema, startingSearch, toSearchRequest, withoutFilters } from "./search";

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
