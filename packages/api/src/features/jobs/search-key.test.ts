import { describe, expect, it } from "vite-plus/test";
import { jobSearchInputSchema } from "@rezumi/schema/jobs/search";
import { cleanJobQuery, jobSearchKey, normalizeJobSearch, stableJson } from "./search-key";

const input = (value: Record<string, unknown>) => jobSearchInputSchema.parse(value);
const key = (value: Record<string, unknown>, after?: Record<string, string>) =>
	jobSearchKey(normalizeJobSearch(input(value)), ["hirebase", "jobspipe"], after);

describe("stableJson", () => {
	it("writes keys in sorted order at every level", () => {
		expect(stableJson({ b: 1, a: { d: [2, { y: 1, x: 2 }], c: "x" } })).toBe(
			'{"a":{"c":"x","d":[2,{"x":2,"y":1}]},"b":1}',
		);
		expect(stableJson({ a: undefined, b: null })).toBe('{"b":null}');
	});
});

describe("jobSearchKey", () => {
	it("is the same for the same search written differently", async () => {
		const first = await key({ query: "Software  Engineer ", country: "US", location: " New York" });
		expect(await key({ location: "new york", country: "US", query: "software engineer" })).toBe(first);
		expect(await key({ query: "SOFTWARE\tENGINEER", country: "US", location: "NEW   YORK" })).toBe(first);
		expect(first).toMatch(/^[a-f0-9]{64}$/);
	});

	it("ignores fields that can't change the answer", async () => {
		const plain = await key({ query: "nurse" });
		// Without a minimum, the pay currency and "include jobs without pay" don't matter.
		expect(await key({ query: "nurse", salaryCurrency: "EUR", includeNoSalary: false })).toBe(plain);
		expect(await key({ query: "nurse", visaSponsorship: false })).toBe(plain);
		expect(await key({ query: "nurse", cursor: "3" })).toBe(plain);
		// A chosen arrangement wins over the remote switch, as the providers are asked.
		expect(await key({ query: "nurse", workArrangement: "hybrid", remote: "only" })).toBe(
			await key({ query: "nurse", workArrangement: "hybrid" }),
		);
	});

	it("differs for every filter that changes the answer", async () => {
		const keys = await Promise.all([
			key({ query: "nurse" }),
			key({ query: "nurse", country: "GB" }),
			key({ query: "nurse", remote: "only" }),
			key({ query: "nurse", postedWithinDays: 7 }),
			key({ query: "nurse", seniority: "senior" }),
			key({ query: "nurse", salaryMin: 50_000 }),
			key({ query: "nurse", salaryMin: 50_000, includeNoSalary: false }),
			key({ query: "nurse", salaryMin: 50_000, salaryCurrency: "GBP" }),
			key({ query: "nurse", visaSponsorship: true }),
			key({ query: "nurse" }, { hirebase: "2" }),
			key({ query: "nurse" }, { hirebase: "3" }),
		]);
		expect(new Set(keys).size).toBe(keys.length);
	});

	it("keys later pages by the provider cursors in any order", async () => {
		expect(await key({ query: "nurse" }, { hirebase: "2", jobspipe: "abc" })).toBe(
			await key({ query: "nurse" }, { jobspipe: "abc", hirebase: "2" }),
		);
	});
});

describe("cleanJobQuery", () => {
	it("leaves out words that only say 'a job' at either end", () => {
		expect(cleanJobQuery("HR jobs")).toBe("HR");
		expect(cleanJobQuery("Lowongan kerja  admin gudang")).toBe("admin gudang");
		expect(cleanJobQuery("loker HR")).toBe("HR");
		expect(cleanJobQuery("hiring: data engineer")).toBe("data engineer");
		expect(cleanJobQuery("nurse vacancies")).toBe("nurse");
	});

	it("keeps words that are part of the role", () => {
		expect(cleanJobQuery("kerja remote")).toBe("kerja remote");
		expect(cleanJobQuery("job coach")).toBe("job coach");
		expect(cleanJobQuery("part time job")).toBe("part time job");
		expect(cleanJobQuery("product manager")).toBe("product manager");
	});

	it("keeps the text as typed when nothing would be left", () => {
		expect(cleanJobQuery("jobs")).toBe("jobs");
		expect(cleanJobQuery("hiring")).toBe("hiring");
		expect(cleanJobQuery("lowongan kerja")).toBe("lowongan kerja");
	});

	it("gives 'HR jobs' and 'hr' one cache key", async () => {
		expect(await key({ query: "HR jobs" })).toBe(await key({ query: "hr" }));
	});
});
