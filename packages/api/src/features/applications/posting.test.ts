import { describe, expect, it, vi } from "vite-plus/test";
import { MAX_CAPTURE_TEXT_CHARS } from "@rezumi/job-sites/capture";
import { readPage } from "../web/service";
import { fetchJobPosting, htmlToText, MAX_POSTING_CHARS, readJobPosting } from "./posting";

vi.mock("../web/service", () => ({
	readPage: vi.fn(),
}));

describe("htmlToText", () => {
	it.each(["&#x110000;", "&#999999999;", "&#xD800;", "&#0;"])("retains invalid numeric entity %s as text", (entity) => {
		expect(htmlToText(`<p>Role ${entity} description</p>`)).toBe(`Role ${entity} description`);
	});
	it("keeps the words and line breaks, and drops scripts, styles and entities", () => {
		const html =
			"<head><title>x</title></head><h1>Designer</h1><p>Figma &amp; research</p><script>alert(1)</script><ul><li>5+ years</li></ul>";
		expect(htmlToText(html)).toBe("Designer\nFigma & research\n5+ years");
	});
});

describe("readJobPosting", () => {
	it("does not select an arbitrary role from a multi-job page", () => {
		const html = `<script type="application/ld+json">${JSON.stringify([
			{ "@type": "JobPosting", title: "Designer" },
			{ "@type": "JobPosting", title: "Engineer" },
		])}</script>`;
		expect(readJobPosting(html)).toBeNull();
	});
	it("reads a JobPosting from the page's JSON-LD, including inside a graph", () => {
		const html = `<script type="application/ld+json">${JSON.stringify({
			"@graph": [
				{ "@type": "Organization", name: "Ignore" },
				{
					"@type": "JobPosting",
					title: "Senior Product Designer",
					hiringOrganization: { name: "Lumen Health" },
					jobLocation: {
						address: { addressLocality: "Berlin", addressCountry: "DE" },
					},
					description: "<p>Design calm tools.</p><ul><li>Figma</li></ul>",
				},
			],
		})}</script>`;

		expect(readJobPosting(html)).toEqual({
			role: "Senior Product Designer",
			company: "Lumen Health",
			location: "Berlin, DE",
			description: "Design calm tools.\nFigma",
			closesAt: "",
			salary: "",
			employmentType: "",
			logoUrl: "",
		});
	});
});

describe("posting retrieval", () => {
	it("rejects a board search page instead of sending its many roles for extraction", async () => {
		vi.mocked(readPage).mockResolvedValue({
			requestedUrl: "https://www.linkedin.com/jobs/search/",
			content: "Many jobs",
			format: "text",
			retrievedAt: "2026-10-08T12:00:00Z",
			method: "builtin",
			truncated: false,
			completeness: "unknown",
		});
		await expect(fetchJobPosting("https://www.linkedin.com/jobs/search/", { userId: "user" })).rejects.toMatchObject({
			reason: "not-a-page",
		});
	});
	it.each(["broken JSON", { "@graph": { unrelated: true } }, { "@graph": "not an array" }, null])(
		"preserves retrieved text when page metadata is malformed: %j",
		async (metadata) => {
			vi.mocked(readPage).mockResolvedValue({
				requestedUrl: "https://jobs.example.com/role",
				content: "Designer\nWork on accessible products.",
				html: `<h1>Designer</h1><p>Work on accessible products.</p><script type="application/ld+json">${typeof metadata === "string" ? metadata : JSON.stringify(metadata)}</script>`,
				format: "text",
				retrievedAt: "2026-09-30T12:00:00.000Z",
				method: "builtin",
				truncated: false,
				completeness: "unknown",
			});
			expect(await fetchJobPosting("https://jobs.example.com/role", { userId: "user" })).toMatchObject({
				page: null,
				text: "Designer\nWork on accessible products.",
				source: {
					method: "builtin",
					truncated: false,
					completeness: "unknown",
				},
			});
		},
	);

	it("retains page fields and marks a bounded structured description as incomplete", async () => {
		vi.mocked(readPage).mockResolvedValue({
			requestedUrl: "https://jobs.example.com/role",
			content: "Other page content",
			html: `<script type="application/ld+json">${JSON.stringify({
				"@type": "JobPosting",
				title: "Designer",
				hiringOrganization: { name: "Example" },
				description: `<p>${"x".repeat(20_001)}</p>`,
			})}</script>`,
			format: "text",
			retrievedAt: "2026-09-30T12:00:00.000Z",
			method: "browser",
			truncated: false,
			completeness: "unknown",
		});
		const result = await fetchJobPosting("https://jobs.example.com/role", { userId: "user" });
		expect(result.page).toMatchObject({ role: "Designer", company: "Example" });
		expect(result.text).toHaveLength(20_000);
		expect(result.source).toMatchObject({
			method: "browser",
			format: "text",
			truncated: true,
			completeness: "incomplete",
		});
		expect(result.source).not.toHaveProperty("html");
		expect(result.source).not.toHaveProperty("content");
	});
});

describe("MAX_POSTING_CHARS", () => {
	it("matches the most text the browser extension captures", () => {
		expect(MAX_POSTING_CHARS).toBe(MAX_CAPTURE_TEXT_CHARS);
	});
});
