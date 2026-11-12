import { describe, expect, it } from "vite-plus/test";
import { canonicalJobUrl, detectSite, jobKey } from "./sites";

describe("detectSite", () => {
	it.each([
		["https://www.linkedin.com/jobs/view/1234567890/", "linkedin"],
		["https://id.linkedin.com/jobs/view/1234567890", "linkedin"],
		["https://www.indeed.com/viewjob?jk=0123456789abcdef", "indeed"],
		["https://id.indeed.com/jobs?q=designer", "indeed"],
		["https://id.jobstreet.com/id/job/81234567", "jobstreet"],
		["https://glints.com/id/opportunities/jobs/designer/1d6c1f1e-6f43-4d3c-9f5f-7b6a2d1c0e9a", "glints"],
		["https://jobs.lever.co/acme/1d6c1f1e-6f43-4d3c-9f5f-7b6a2d1c0e9a", null],
		["https://notlinkedin.com/jobs/view/1234567890", null],
		["https://linkedin.com.evil.example/jobs/view/1234567890", null],
		["chrome://extensions", null],
		["not a url", null],
	])("%s → %s", (url, site) => {
		expect(detectSite(url)).toBe(site);
	});
});

describe("jobKey and canonicalJobUrl on the four boards", () => {
	it.each([
		// LinkedIn
		[
			"https://www.linkedin.com/jobs/view/1234567890/",
			"linkedin:1234567890",
			"https://www.linkedin.com/jobs/view/1234567890/",
		],
		[
			"https://www.linkedin.com/jobs/view/1234567890",
			"linkedin:1234567890",
			"https://www.linkedin.com/jobs/view/1234567890/",
		],
		[
			"https://id.linkedin.com/jobs/view/senior-product-designer-at-lumen-health-1234567890?trk=public_jobs&refId=x",
			"linkedin:1234567890",
			"https://www.linkedin.com/jobs/view/1234567890/",
		],
		[
			"https://www.linkedin.com/jobs/search/?currentJobId=1234567890&keywords=designer",
			"linkedin:1234567890",
			"https://www.linkedin.com/jobs/view/1234567890/",
		],
		[
			"https://www.linkedin.com/jobs/collections/recommended/?currentJobId=1234567890",
			"linkedin:1234567890",
			"https://www.linkedin.com/jobs/view/1234567890/",
		],
		// Indeed
		[
			"https://www.indeed.com/viewjob?jk=0123456789ABCDEF&from=serp",
			"indeed:0123456789abcdef",
			"https://www.indeed.com/viewjob?jk=0123456789abcdef",
		],
		[
			"https://id.indeed.com/m/viewjob?jk=0123456789abcdef",
			"indeed:0123456789abcdef",
			"https://id.indeed.com/viewjob?jk=0123456789abcdef",
		],
		[
			"https://uk.indeed.com/jobs?q=designer&l=London&vjk=fedcba9876543210",
			"indeed:fedcba9876543210",
			"https://uk.indeed.com/viewjob?jk=fedcba9876543210",
		],
		// JobStreet
		["https://id.jobstreet.com/id/job/81234567", "jobstreet:81234567", "https://id.jobstreet.com/job/81234567"],
		[
			"https://my.jobstreet.com/job/81234567?type=standout#apply",
			"jobstreet:81234567",
			"https://my.jobstreet.com/job/81234567",
		],
		[
			"https://id.jobstreet.com/id/designer-jobs?jobId=81234567&type=standard",
			"jobstreet:81234567",
			"https://id.jobstreet.com/job/81234567",
		],
		// Glints
		[
			"https://glints.com/id/opportunities/jobs/product-designer/1D6C1F1E-6F43-4D3C-9F5F-7B6A2D1C0E9A?utm_source=x",
			"glints:1d6c1f1e-6f43-4d3c-9f5f-7b6a2d1c0e9a",
			"https://glints.com/id/opportunities/jobs/product-designer/1D6C1F1E-6F43-4D3C-9F5F-7B6A2D1C0E9A",
		],
		[
			"https://glints.com/id/en/opportunities/jobs/product-designer/1d6c1f1e-6f43-4d3c-9f5f-7b6a2d1c0e9a/",
			"glints:1d6c1f1e-6f43-4d3c-9f5f-7b6a2d1c0e9a",
			"https://glints.com/id/en/opportunities/jobs/product-designer/1d6c1f1e-6f43-4d3c-9f5f-7b6a2d1c0e9a",
		],
	])("%s", (url, key, canonical) => {
		expect(jobKey(url)).toBe(key);
		expect(canonicalJobUrl(url)).toBe(canonical);
		// The canonical address names the same posting.
		expect(jobKey(canonical)).toBe(key);
	});

	it.each([
		"https://www.linkedin.com/feed/",
		"https://www.linkedin.com/jobs/search/?keywords=designer",
		"https://www.linkedin.com/jobs/search/?currentJobId=abc",
		"https://www.linkedin.com/in/someone/",
		"https://www.indeed.com/jobs?q=designer",
		"https://www.indeed.com/viewjob?jk=not-hex",
		"https://id.jobstreet.com/id/designer-jobs",
		"https://id.jobstreet.com/id/job/abc",
		"https://glints.com/id/opportunities/jobs/explore",
		"https://glints.com/id/opportunities/jobs/product-designer/not-a-uuid",
	])("a board page without one posting open has no key: %s", (url) => {
		expect(jobKey(url)).toBeNull();
		expect(canonicalJobUrl(url)).toBeNull();
	});
});

describe("jobKey and canonicalJobUrl on any other site", () => {
	it.each([
		["https://www.Lumen.example/careers/designer/", "url:lumen.example/careers/designer"],
		["https://lumen.example/careers/designer?utm_source=x&ref=y#apply", "url:lumen.example/careers/designer"],
		["https://boards.greenhouse.io/acme/jobs/123", "url:boards.greenhouse.io/acme/jobs/123"],
		["https://acme.example/careers?gh_jid=42&utm_medium=email", "url:acme.example/careers?gh_jid=42"],
		["https://acme.example/careers?b=2&a=1", "url:acme.example/careers?a=1&b=2"],
		["http://acme.example/", "url:acme.example"],
	])("%s → %s", (url, key) => {
		expect(jobKey(url)).toBe(key);
	});

	it("keeps the posting's own parameters and drops tracking ones and the fragment", () => {
		expect(canonicalJobUrl("https://acme.example/careers?gh_jid=42&utm_source=li&fbclid=x#top")).toBe(
			"https://acme.example/careers?gh_jid=42",
		);
	});

	it("gives no key to non-web addresses", () => {
		expect(jobKey("ftp://acme.example/job")).toBeNull();
		expect(jobKey("javascript:alert(1)")).toBeNull();
		expect(canonicalJobUrl("mailto:jobs@acme.example")).toBeNull();
	});

	it("accepts URL objects", () => {
		expect(jobKey(new URL("https://www.linkedin.com/jobs/view/1234567890/"))).toBe("linkedin:1234567890");
	});
});
