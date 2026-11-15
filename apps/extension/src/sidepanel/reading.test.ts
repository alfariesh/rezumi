// @vitest-environment happy-dom
import type { PageReading } from "./reading";
import { describe, expect, it } from "vite-plus/test";
import { summarizeReading } from "./reading";

const base: PageReading = {
	url: "https://careers.lumen.example/jobs/42",
	canonicalUrl: "https://careers.lumen.example/jobs/42",
	site: null,
	key: "url:careers.lumen.example/jobs/42",
	pageTitle: "Careers",
	jsonLd: [],
	text: "",
	textSource: "page",
	fields: {},
};

const posting = JSON.stringify({
	"@context": "https://schema.org",
	"@type": "JobPosting",
	title: "Product Designer",
	hiringOrganization: { name: "Lumen Health" },
	jobLocation: { address: { addressLocality: "Jakarta", addressCountry: "ID" } },
	description: "<p>Design calm tools.</p><p>Figma.</p>",
	validThrough: "2026-12-31",
});

describe("summarizeReading", () => {
	it("takes the board's fields first, then JSON-LD, and says where each came from", () => {
		const summary = summarizeReading({
			...base,
			site: "glints",
			key: "glints:1d6c1f1e-6f43-4d3c-9f5f-7b6a2d1c0e9a",
			jsonLd: [posting],
			text: "Design calm tools. Figma.",
			textSource: "site",
			fields: { role: "Senior Product Designer", salary: "IDR 15.000.000" },
		});
		expect(summary.kind).toBe("posting");
		expect(summary.fields).toEqual({
			role: { value: "Senior Product Designer", source: "site" },
			company: { value: "Lumen Health", source: "json-ld" },
			location: { value: "Jakarta, ID", source: "json-ld" },
			salary: { value: "IDR 15.000.000", source: "site" },
			validThrough: { value: "2026-12-31", source: "json-ld" },
			description: { value: "Design calm tools.\nFigma.", source: "json-ld" },
		});
		expect(summary.missing).toEqual([]);
	});

	it("prefers what the person selected for the description", () => {
		const summary = summarizeReading({ ...base, jsonLd: [posting], selection: "Only this part." });
		expect(summary.fields.description).toEqual({ value: "Only this part.", source: "selection" });
	});

	it("lists the expected fields a board posting is missing", () => {
		const summary = summarizeReading({
			...base,
			site: "jobstreet",
			key: "jobstreet:81234567",
			fields: { role: "Product Designer", company: "Lumen Health" },
		});
		expect(summary.kind).toBe("posting");
		expect(summary.missing).toEqual(["location", "description"]);
	});

	it("tells a page with text from an empty one", () => {
		expect(summarizeReading({ ...base, text: "Some page" }).kind).toBe("page");
		const empty = summarizeReading(base);
		expect(empty.kind).toBe("none");
		expect(empty.missing).toEqual(["role", "company", "location", "description"]);
	});

	it("ignores unreadable or several JSON-LD postings", () => {
		expect(summarizeReading({ ...base, jsonLd: ["{not json"] }).kind).toBe("none");
		expect(summarizeReading({ ...base, jsonLd: [`[${posting},${posting.replace("Product", "Service")}]`] }).kind).toBe(
			"none",
		);
	});
});
