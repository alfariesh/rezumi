import { describe, expect, it } from "vite-plus/test";
import { matchOpportunity, matchSkills, MAX_MATCHED_SKILLS } from "./matching";

const phrases = ["Senior Product Manager", "Product Lead — Onboarding", "Berlin", "Remote within Europe"];

describe("matchOpportunity", () => {
	it("matches a preference only when all its words appear, in the user's own wording", () => {
		const posting =
			"Senior Product Manager – Mosaic Cloud. Lead onboarding and product-led growth. Berlin hybrid; customer discovery.";
		expect(matchOpportunity(posting, phrases).matches).toEqual([
			"Senior Product Manager",
			"Product Lead — Onboarding",
			"Berlin",
		]);
		expect(matchOpportunity("Remote roles in Europe", phrases).matches).toEqual(["Remote within Europe"]);
	});

	it.each([
		["Remote within Europe, €90,000–€105,000", []],
		["Hybrid, 3 days on-site. 95k base", []],
		["Own the new-customer journey", ["salary", "office"]],
		["Fully remote team", ["salary"]],
		["Salary 80 000 EUR", ["office"]],
	])("names what %j leaves out", (posting, unknowns) => {
		expect(matchOpportunity(posting, []).unknowns).toEqual(unknowns);
	});
});

describe("matchSkills", () => {
	const profile = `## Experience
Data analyst at Northwind. Built dashboards in Tableau and wrote SQL for the finance team.
Customer interviews for onboarding research.

## Skills
Python, stakeholder management`;

	it("splits a listing's skills into those the Profile mentions and those it doesn't yet", () => {
		expect(
			matchSkills(["SQL", "Python", "Stakeholder Management", "Customer research", "Kubernetes"], profile),
		).toEqual({
			matched: ["SQL", "Python", "Stakeholder Management", "Customer research"],
			missing: ["Kubernetes"],
		});
	});

	it("reads provider slugs as words and counts a skill named twice once", () => {
		expect(matchSkills(["sql-server", "SQL", "sql", "power_bi"], "SQL Server, Power BI")).toEqual({
			matched: ["sql server", "SQL", "power bi"],
			missing: [],
		});
	});

	it("matches Indonesian skills, leaving out Indonesian stop words", () => {
		const profil = "Pengalaman: analisis data penjualan, pelaporan bulanan untuk manajemen. Keahlian: Excel.";
		expect(matchSkills(["Analisis data dan pelaporan", "Excel", "Manajemen proyek"], profil)).toEqual({
			matched: ["Analisis data dan pelaporan", "Excel"],
			missing: ["Manajemen proyek"],
		});
	});

	it("compares whole words, never stems", () => {
		expect(matchSkills(["Data analysis"], "I analysed data every week.")).toEqual({
			matched: [],
			missing: ["Data analysis"],
		});
	});

	it("says nothing without skills or a Profile, and stops at the main skills", () => {
		expect(matchSkills([], profile)).toBeNull();
		expect(matchSkills(["SQL"], "  ")).toBeNull();
		const many = Array.from({ length: 20 }, (_, index) => `Skill ${index}`);
		const match = matchSkills(many, "skill 1");
		expect((match?.matched.length ?? 0) + (match?.missing.length ?? 0)).toBe(MAX_MATCHED_SKILLS);
	});
});
