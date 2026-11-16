import { describe, expect, it } from "vite-plus/test";
import { isSamePosting, normalizeCompany, normalizeRole } from "./match";

describe("normalizeCompany", () => {
	it.each([
		["PT. Lumen Health Tbk", "lumen health"],
		["Lumen Health, Inc.", "lumen health"],
		["PT Bank Rakyat Indonesia (Persero) Tbk", "bank rakyat indonesia"],
		["Café & Co", "cafe and"],
	])("%s → %s", (input, expected) => {
		expect(normalizeCompany(input)).toBe(expected);
	});
});

describe("isSamePosting", () => {
	it("matches the same role and company written differently", () => {
		expect(
			isSamePosting(
				{ role: "Senior Product Designer", company: "PT Lumen Health" },
				{ role: "senior product-designer", company: "Lumen Health Tbk." },
			),
		).toBe(true);
	});

	it("does not match another role, another company, or empty names", () => {
		expect(isSamePosting({ role: "Designer", company: "Lumen" }, { role: "Engineer", company: "Lumen" })).toBe(false);
		expect(isSamePosting({ role: "Designer", company: "Lumen" }, { role: "Designer", company: "Lumina" })).toBe(false);
		expect(isSamePosting({ role: "Designer", company: "PT" }, { role: "Designer", company: "Tbk" })).toBe(false);
		expect(normalizeRole(" (Remote) ")).toBe("remote");
	});
});
