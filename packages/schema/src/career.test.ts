import { describe, expect, it } from "vite-plus/test";
import z from "zod";
import { careerProfileDataSchema, isDateOnly, offerTermsSchema, savedItemDataSchema } from "./career";

describe("careerProfileDataSchema searchRegions", () => {
	it("leaves searchRegions absent when the input has none", () => {
		const parsed = careerProfileDataSchema.parse({});

		expect(parsed.searchRegions).toBeUndefined();
		expect(Object.hasOwn(parsed, "searchRegions")).toBe(false);
	});

	it("keeps chosen countries, an empty list and null", () => {
		expect(careerProfileDataSchema.parse({ searchRegions: ["SG"] }).searchRegions).toEqual(["SG"]);
		expect(careerProfileDataSchema.parse({ searchRegions: [] }).searchRegions).toEqual([]);
		expect(careerProfileDataSchema.parse({ searchRegions: null }).searchRegions).toBeNull();
	});

	it("rejects invalid search regions", () => {
		expect(careerProfileDataSchema.safeParse({ searchRegions: ["XX"] }).success).toBe(false);
		expect(careerProfileDataSchema.safeParse({ searchRegions: ["SG", "SG"] }).success).toBe(false);
		expect(careerProfileDataSchema.safeParse({ searchRegions: ["SG", "AU", "DE", "FR"] }).success).toBe(false);
	});
});

describe("offerTermsSchema respondBy", () => {
	const terms = (respondBy: unknown) =>
		offerTermsSchema.safeParse({ currency: "IDR", period: "month", base: null, variable: null, respondBy });

	it("keeps a deadline with no stated time as a bare date", () => {
		const parsed = terms("2026-11-23");

		expect(parsed.success && parsed.data.respondBy).toBe("2026-11-23");
		expect(isDateOnly("2026-11-23")).toBe(true);
	});

	it("still reads deadlines saved as date-times with an offset", () => {
		const parsed = terms("2026-11-23T09:00:00+07:00");

		expect(parsed.success && parsed.data.respondBy).toBe("2026-11-23T09:00:00+07:00");
		expect(isDateOnly("2026-11-23T09:00:00+07:00")).toBe(false);
		expect(
			savedItemDataSchema.safeParse({
				kind: "offer",
				currency: "IDR",
				period: "month",
				base: null,
				variable: null,
				respondBy: "2026-11-23T09:00:00+07:00",
			}).success,
		).toBe(true);
	});

	it("rejects a time without an offset and an impossible date", () => {
		expect(terms("2026-11-23T09:00:00").success).toBe(false);
		expect(terms("2026-02-30").success).toBe(false);
		expect(terms("23 November 2026").success).toBe(false);
	});

	it("tells the model a date is enough and a time must not be invented", () => {
		const schema = JSON.stringify(z.toJSONSchema(offerTermsSchema));

		expect(schema).toContain('"format":"date"');
		expect(schema).toContain('"format":"date-time"');
		expect(schema).toContain("Never invent a time");
	});
});
