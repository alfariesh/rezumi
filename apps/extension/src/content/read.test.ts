// @vitest-environment happy-dom
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vite-plus/test";
import { readPage } from "./read";
import { SITE_ADAPTERS } from "./sites";

const fixture = (name: string) =>
	new DOMParser().parseFromString(
		readFileSync(join(import.meta.dirname, "sites/__fixtures__", name), "utf8"),
		"text/html",
	);

const read = (name: string, href: string, selection = "") => readPage(fixture(name), href, selection);

describe("LinkedIn", () => {
	const view = "https://www.linkedin.com/jobs/view/4012345678/";

	it("reads the current signed-in interface by its stable hooks", () => {
		const reading = read("linkedin/view.html", view);
		expect(reading).toMatchObject({
			site: "linkedin",
			key: "linkedin:4012345678",
			canonicalUrl: "https://www.linkedin.com/jobs/view/4012345678/",
			textSource: "site",
			fields: {
				role: "Product Designer",
				company: "Lumen Health",
				location: "Jakarta, Indonesia",
				salary: "Rp 18.000.000/month - Rp 24.000.000/month",
			},
		});
		// The description without its "About the job" heading, lists kept as bullets.
		expect(reading.text).toMatch(/^Lumen Health builds calm tools/);
		expect(reading.text).toContain("• Design patient intake flows in Figma.");
		expect(reading.text).not.toContain("About the job");
		expect(reading.text).not.toContain("Lumen Health\n");
	});

	it("follows the posting picked beside the search results", () => {
		const reading = read(
			"linkedin/search-picked.html",
			"https://www.linkedin.com/jobs/search-results/?currentJobId=4012345678&keywords=designer",
		);
		expect(reading.key).toBe("linkedin:4012345678");
		expect(reading.canonicalUrl).toBe("https://www.linkedin.com/jobs/view/4012345678/");
		expect(reading.fields).toMatchObject({
			role: "Product Designer",
			company: "Lumen Health",
			location: "Jakarta, Indonesia",
		});
		expect(reading.text).toContain("Run research sessions with nurses.");
	});

	it("has no posting on a search page with none picked", () => {
		const reading = read(
			"linkedin/search-none.html",
			"https://www.linkedin.com/jobs/search-results/?keywords=designer",
		);
		expect(reading.key).toBeNull();
		expect(reading.fields).toEqual({});
		expect(reading.textSource).toBe("page");
	});

	it("reads the Indonesian interface", () => {
		const reading = read("linkedin/id.html", view);
		expect(reading.fields).toMatchObject({
			role: "Product Designer",
			company: "Lumen Health",
			location: "Jakarta, Indonesia",
		});
		expect(reading.text).not.toContain("Tentang pekerjaan");
		expect(reading.text).toMatch(/^Lumen Health builds/);
	});

	it("still reads a posting that no longer takes applications", () => {
		const reading = read("linkedin/closed.html", view);
		expect(reading.fields).toMatchObject({ role: "Product Designer", company: "Lumen Health" });
		expect(reading.text.length).toBeGreaterThan(50);
	});

	it("falls back to the older interface's classes", () => {
		const reading = read(
			"linkedin.html",
			"https://www.linkedin.com/jobs/view/product-designer-at-lumen-health-4012345678/?trk=public_jobs",
		);
		expect(reading.fields).toMatchObject({
			role: "Product Designer",
			company: "Lumen Health",
			location: "Jakarta, Indonesia",
		});
		expect(reading.text).toBe("Design calm tools for clinic teams. Figma, research, design systems.");
	});

	it("places the on-page button beside the board's own Save", () => {
		const document = fixture("linkedin/view.html");
		expect(SITE_ADAPTERS.linkedin.anchor(document)?.textContent).toContain("Save");
	});
});

describe("Indeed", () => {
	const search = "https://id.indeed.com/jobs?q=designer&l=Jakarta&vjk=0123456789abcdef";

	it("reads the posting open beside the search results", () => {
		const reading = read("indeed/search-picked.html", search);
		expect(reading).toMatchObject({
			key: "indeed:0123456789abcdef",
			canonicalUrl: "https://id.indeed.com/viewjob?jk=0123456789abcdef",
			textSource: "site",
			fields: {
				role: "Product Designer",
				company: "Lumen Health",
				location: "Jakarta Selatan",
				salary: "Rp 15.000.000 - Rp 20.000.000 a month",
				employmentType: "Full-time",
			},
		});
		expect(reading.text).toContain("• Calm tools for clinic teams.");
		expect(reading.text).not.toContain("color:red");
		expect(reading.text).not.toContain("Full job description");
	});

	it("reads the Indonesian interface", () => {
		expect(read("indeed/id.html", search).fields).toMatchObject({
			salary: "Rp. 15.000.000 - Rp. 20.000.000 per bulan",
			employmentType: "Penuh Waktu",
			location: "Jakarta Selatan",
		});
	});

	it("leaves pay empty when the posting does not state it", () => {
		const fields = read("indeed/no-pay.html", search).fields;
		expect(fields.salary).toBeUndefined();
		expect(fields.location).toBe("Jakarta Selatan");
	});

	it("reads the older posting page", () => {
		const reading = read("indeed.html", "https://id.indeed.com/viewjob?jk=0123456789abcdef&from=serp");
		expect(reading.fields).toMatchObject({ role: "Product Designer", company: "Lumen Health", location: "Jakarta" });
		expect(reading.text).toBe("Design calm tools for clinic teams. Figma, research, design systems.");
	});

	it("reads what an expired posting still shows", () => {
		const reading = read("indeed/expired.html", "https://id.indeed.com/viewjob?jk=0123456789abcdef");
		expect(reading.fields).toMatchObject({ role: "Product Designer", company: "Lumen Health" });
		expect(reading.textSource).toBe("page");
	});
});

describe("JobStreet", () => {
	it("reads a posting page", () => {
		const reading = read("jobstreet/detail.html", "https://id.jobstreet.com/id/job/81234567");
		expect(reading).toMatchObject({
			key: "jobstreet:81234567",
			canonicalUrl: "https://id.jobstreet.com/job/81234567",
			textSource: "site",
			fields: {
				role: "Product Designer",
				company: "Lumen Health",
				location: "Jakarta Selatan, Jakarta Raya",
				salary: "Rp 15.000.000 – Rp 20.000.000 per month",
				employmentType: "Full time",
				applyUrl: "https://id.jobstreet.com/id/job/81234567/apply",
				companyLogoUrl: "https://image-service.example/logos/lumen.png",
			},
		});
		expect(reading.text).toContain("• Merancang alur pendaftaran pasien.");
	});

	it("follows the posting picked beside the search results, not the cards", () => {
		const reading = read(
			"jobstreet/search-picked.html",
			"https://id.jobstreet.com/id/designer-jobs/in-Jakarta-Raya?jobId=81234567&type=standard",
		);
		expect(reading.key).toBe("jobstreet:81234567");
		expect(reading.fields.role).toBe("Product Designer");
		expect(reading.text).not.toContain("Harbor Rail");
	});

	it("has no posting on a search page with none picked", () => {
		const reading = read("jobstreet/search-none.html", "https://id.jobstreet.com/id/designer-jobs/in-Jakarta-Raya");
		expect(reading.key).toBeNull();
		expect(reading.fields).toEqual({});
	});

	it("reads the English interface", () => {
		const reading = read("jobstreet/en.html", "https://id.jobstreet.com/en/job/81234567");
		expect(reading.fields.role).toBe("Product Designer");
		expect(reading.text).toContain("• Design patient intake flows.");
	});

	it("reads what an expired posting still shows", () => {
		const reading = read("jobstreet/expired.html", "https://id.jobstreet.com/id/job/81234567");
		expect(reading.fields).toEqual({ role: "Product Designer", company: "Lumen Health" });
		expect(reading.textSource).toBe("page");
	});
});

describe("Glints", () => {
	const href =
		"https://glints.com/id/opportunities/jobs/product-designer/1d6c1f1e-6f43-4d3c-9f5f-7b6a2d1c0e9a?utm_referrer=explore&traceInfo=x";

	it("reads the markup and keeps the posting's JSON-LD for the server", () => {
		const reading = read("glints/detail.html", href);
		expect(reading).toMatchObject({
			key: "glints:1d6c1f1e-6f43-4d3c-9f5f-7b6a2d1c0e9a",
			canonicalUrl: "https://glints.com/id/opportunities/jobs/product-designer/1d6c1f1e-6f43-4d3c-9f5f-7b6a2d1c0e9a",
			textSource: "site",
			fields: { role: "Product Designer", company: "Lumen Health", salary: "IDR15.000.000 - 20.000.000/Bulan" },
		});
		// Only blocks that mention a JobPosting; the breadcrumb block stays behind.
		expect(reading.jsonLd).toHaveLength(1);
		expect(reading.jsonLd[0]).toContain('"validThrough": "2026-12-14"');
		expect(reading.text).toContain("• Merancang alur di Figma.");
	});

	it("reads the English interface and a closed posting", () => {
		expect(read("glints/en.html", href).fields.role).toBe("Product Designer");
		expect(read("glints/expired.html", href).jsonLd[0]).toContain("2026-10-01");
	});
});

describe("other sites", () => {
	it("keeps the JSON-LD and the main text without navigation, forms or footer", () => {
		const reading = read("generic/json-ld.html", "https://careers.lumen.example/jobs/42?utm_source=x");
		expect(reading).toMatchObject({
			site: null,
			key: "url:careers.lumen.example/jobs/42",
			canonicalUrl: "https://careers.lumen.example/jobs/42",
			textSource: "page",
			fields: {},
		});
		expect(reading.jsonLd).toHaveLength(1);
		expect(reading.text).toBe("Product Designer\n\nDesign calm tools for clinic teams.");
	});

	it("reads the longest article when the page has no main", () => {
		const reading = read("generic/plain.html", "https://harbor-rail.example/join/service-designer");
		expect(reading.jsonLd).toEqual([]);
		expect(reading.text).toContain("• Map journeys with station staff.");
		expect(reading.text).not.toContain("Other openings");
		expect(reading.text).not.toContain("Short teaser");
	});

	it("has no text on an empty page, and keeps what the person selected", () => {
		const reading = read("generic/empty.html", "https://app.example/", "  Service Designer\n\n\n\nNight trains  ");
		expect(reading.text).toBe("");
		expect(reading.selection).toBe("Service Designer\n\nNight trains");
	});

	it("never sends more than the server keeps", () => {
		const document = fixture("generic/empty.html");
		document.body.textContent = "word ".repeat(10_000);
		expect(readPage(document, "https://app.example/").text.length).toBe(20_000);
	});
});
