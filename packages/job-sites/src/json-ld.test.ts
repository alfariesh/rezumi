import { describe, expect, it } from "vite-plus/test";
import { jobPostingsIn, jobPostingsInJson, readJobPosting, toPagePosting } from "./json-ld";

/** A tag stripper good enough for these tests; each runtime passes its own. */
const stripTags = (html: string) =>
	html
		.replace(/<\/(?:p|li|div)>|<br\s*\/?>/gi, "\n")
		.replace(/<[^>]+>/g, "")
		.replaceAll("&lt;", "<")
		.replaceAll("&gt;", ">")
		.split("\n")
		.map((line) => line.trim())
		.filter(Boolean)
		.join("\n");

const script = (value: unknown) => `<script type="application/ld+json">${JSON.stringify(value)}</script>`;

describe("jobPostingsInJson", () => {
	it("finds postings in an object, an array and a graph, and counts a repeated posting once", () => {
		const posting = { "@type": "JobPosting", title: "Designer", hiringOrganization: { name: "Lumen" } };
		expect(
			jobPostingsInJson([
				posting,
				[{ "@type": "Organization" }, { ...posting }],
				{ "@graph": [{ "@type": ["JobPosting", "Thing"], title: "Engineer" }] },
				null,
				"text",
			]).map((item) => item.title),
		).toEqual(["Designer", "Engineer"]);
	});
});

describe("jobPostingsIn", () => {
	it("skips blocks that are not JSON and stops at an unclosed script", () => {
		const html = `<script type="application/ld+json">{nope</script>${script({ "@type": "JobPosting", title: "A" })}<script type='application/ld+json' data-x="1">{`;
		expect(jobPostingsIn(html).map((item) => item.title)).toEqual(["A"]);
	});
});

describe("toPagePosting", () => {
	it.each([
		["an organisation object", { hiringOrganization: { name: " Lumen " } }, { company: "Lumen" }],
		["an organisation string", { hiringOrganization: "Lumen" }, { company: "Lumen" }],
		[
			"a list of places, with placeholder parts dropped",
			{
				jobLocation: [
					{
						address: {
							addressLocality: "Jakarta",
							addressRegion: "State not Applicable",
							addressCountry: { name: "ID" },
						},
					},
					{ address: { addressLocality: "Bandung" } },
				],
			},
			{ location: "Jakarta, ID" },
		],
		[
			"remote work",
			{ jobLocation: { address: { addressCountry: "ID" } }, jobLocationType: "telecommute" },
			{ location: "ID · Remote" },
		],
		["a closing date", { validThrough: "2026-12-31T23:59" }, { closesAt: "2026-12-31T23:59" }],
		[
			"escaped description HTML",
			{ description: "&lt;p&gt;Design&lt;/p&gt;&lt;ul&gt;&lt;li&gt;Figma&lt;/li&gt;&lt;/ul&gt;" },
			{ description: "Design\nFigma" },
		],
		["a salary it does not read", { baseSalary: { value: { minValue: 1 } } }, {}],
	])("reads %s", (_, fields, expected) => {
		expect(toPagePosting({ "@type": "JobPosting", title: "Designer", ...fields }, stripTags)).toEqual({
			role: "Designer",
			company: "",
			location: "",
			description: "",
			closesAt: "",
			...expected,
		});
	});
});

describe("readJobPosting", () => {
	it("reads the one posting a page describes", () => {
		const html = script({ "@type": "JobPosting", title: "Designer", description: "<p>Calm tools.</p>" });
		expect(readJobPosting(html, stripTags)).toMatchObject({ role: "Designer", description: "Calm tools." });
	});
	it("does not pick one role from a page with several, or from none", () => {
		const several = script([
			{ "@type": "JobPosting", title: "Designer" },
			{ "@type": "JobPosting", title: "Engineer" },
		]);
		expect(readJobPosting(several, stripTags)).toBeNull();
		expect(readJobPosting("<p>No data</p>", stripTags)).toBeNull();
	});
});
