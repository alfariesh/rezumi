import { describe, expect, it, vi } from "vite-plus/test";

vi.mock("@rezumi/env/server", () => ({ env: { APP_URL: "https://rezumi.app/" } }));
vi.mock("@rezumi/api/features/resume/web-page", () => ({
	listIndexableResumes: async () => [
		{ username: "tess", slug: "game-dev", isPrimary: true, updatedAt: new Date("2026-10-01T00:00:00Z") },
		{ username: "tess", slug: "level-design", isPrimary: false, updatedAt: new Date("2026-10-02T00:00:00Z") },
	],
	countIndexableResumes: async () => 2,
	SITEMAP_PAGE_SIZE: 50_000,
}));
vi.mock("@rezumi/api/features/portfolio/public", () => ({
	listIndexablePortfolios: async (page: number) =>
		page === 0 ? [{ username: "nadia.r", updatedAt: new Date("2026-11-06T00:00:00Z") }] : [],
	countIndexablePortfolios: async () => 1,
	PORTFOLIO_SITEMAP_PAGE_SIZE: 50_000,
}));

const { handlePagesSitemap, handlePortfoliosSitemap, handleResumesSitemap, handleSitemap, handleLlms } =
	await import("./seo");

it("lists published portfolios at /<username>, on pages of their own in the sitemap index", async () => {
	const index = await (await handleSitemap()).text();
	expect(index).toContain("<loc>https://rezumi.app/sitemaps/resumes-1.xml</loc>");
	expect(index).toContain("<loc>https://rezumi.app/sitemaps/portfolios-1.xml</loc>");
	const xml = await (await handlePortfoliosSitemap(1)).text();
	expect(xml).toContain("<url><loc>https://rezumi.app/nadia.r</loc><lastmod>2026-11-06T00:00:00.000Z</lastmod></url>");
	expect((await handlePortfoliosSitemap(2)).status).toBe(404);
	expect((await handlePortfoliosSitemap(0)).status).toBe(404);
});

it("lists each indexed resume at its canonical address: the primary at /<username>", async () => {
	const xml = await (await handleResumesSitemap(1)).text();
	expect([...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1])).toEqual([
		"https://rezumi.app/tess",
		"https://rezumi.app/tess/level-design",
	]);
});

it("publishes Context7 Ask after the llms title and summary", async () => {
	const text = await handleLlms().text();
	expect(text).toMatch(
		/^# Rezumi\n\n> [^\n]+\n\n## Search\n\nThis site has a search endpoint: https:\/\/context7.com\/api\/v2\/ask\?siteKey=ask_b3fd9335a63f1b21b1a814ac&query=<URL-encoded question>\./,
	);
	expect(text).toContain("Plus, Pro AI and Rezumi AI trial credits are coming soon.");
	expect(text).toContain(
		"It returns documentation that answers the question, with a source link for each part. No API key is needed. If nothing matches, it says so.\n\n## Product",
	);
});

describe("localized sitemap", () => {
	it("gives every localized public page its own entry with reciprocal alternates", async () => {
		const response = handlePagesSitemap();
		const xml = await response.text();
		const entries = [...xml.matchAll(/<url>([\s\S]*?)<\/url>/g)].map((match) => ({
			loc: match[1]?.match(/<loc>(.*?)<\/loc>/)?.[1],
			alternates: [...(match[1] ?? "").matchAll(/hreflang="([^"]+)" href="([^"]+)"/g)].map((link) => ({
				language: link[1],
				href: link[2],
			})),
		}));
		const locations = entries.map((entry) => entry.loc);

		expect(response.headers.get("Content-Type")).toBe("application/xml; charset=UTF-8");
		expect(entries).toHaveLength(162); // Three public pages, 54 real locales; x-default shares English's URL.
		expect(new Set(locations).size).toBe(entries.length);
		for (const path of ["/", "/ats-checker", "/resume-templates"]) {
			const base = `https://rezumi.app${path}`;
			expect(locations).toContain(base);
			expect(locations).toContain(`${base}?locale=de-DE`);
			expect(locations).toContain(`${base}?locale=ar-SA`);
			expect(locations).toContain(`${base}?locale=en-GB`);
			const group = entries.filter((entry) => entry.loc?.split("?")[0] === base);
			expect(group).toHaveLength(54);
			for (const entry of group) {
				expect(entry.alternates).toHaveLength(55);
				expect(entry.alternates).toEqual(group[0]?.alternates);
				expect(entry.alternates).toContainEqual({ language: "x-default", href: base });
				expect(entry.alternates).toContainEqual({ language: "sr", href: `${base}?locale=sr-SP` });
				for (const alternate of entry.alternates) expect(locations).toContain(alternate.href);
			}
		}
		expect(xml).not.toContain("zu-ZA");
		expect(xml).not.toContain("/dashboard");
	});
});

it("lists the docs pages in the pages sitemap, without language alternates", async () => {
	const xml = await handlePagesSitemap(["/docs", "/docs/guides/editor-overview"]).text();
	expect(xml).toContain("<url><loc>https://rezumi.app/docs</loc></url>");
	expect(xml).toContain("<url><loc>https://rezumi.app/docs/guides/editor-overview</loc></url>");
});
