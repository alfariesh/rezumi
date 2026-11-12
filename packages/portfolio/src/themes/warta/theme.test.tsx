import { describe, expect, it } from "vite-plus/test";
import { getWebFont } from "@rezumi/fonts";
import { count, expectSoundPage, fullPortfolioData, fullTestResume, renderTestPage } from "../../fixtures.test-helpers";
import { WARTA_CSS } from "./css";

const warta = { ...fullPortfolioData, theme: "warta" } as const;

describe("Warta", () => {
	it("keeps the user's order and titles, and draws works as articles linking to their own pages", () => {
		const { html } = renderTestPage({
			...warta,
			locale: "en-US",
			sections: { order: ["about", "work", "contact"], titles: { work: "Stories" } },
		});
		expectSoundPage(html, "warta");
		expect(html.indexOf('id="about"')).toBeLessThan(html.indexOf('id="work"'));
		expect(html).toContain("Stories");
		expect(html).toContain(
			'<a class="wt-story__link" href="/nadia/work/kopi-app" aria-labelledby="work-kopi-app--card-title">',
		);
		// The first tag is the rubric; the byline says the role, the year and the reading time.
		expect(html).toContain('<span class="wt-rubric">Mobile</span>');
		expect(html).toContain('<span class="wt-story__byline">Lead designer · 2024 · 1 min read</span>');
		// A work with no text has no reading time, and no rubric without tags.
		const bare = html.slice(html.indexOf("work-no-cover--card-title"));
		expect(bare.slice(0, bare.indexOf("</li>"))).not.toContain("min read");
		expect(html).not.toContain("Hidden work");
	});

	it("leads with a cover story in the featured grid, and lists or pairs the rest in the other layouts", () => {
		const featured = renderTestPage(warta).html;
		expect(featured).toContain('<ul class="wt-stories" data-variant="featured-grid">');
		expect(count(featured, /class="wt-story wt-story--lead"/g)).toBe(1);
		for (const work of ["list", "grid-2"] as const) {
			const { html } = renderTestPage({ ...warta, design: { variants: { work } } });
			expectSoundPage(html, "warta");
			expect(html).toContain(`<ul class="wt-stories" data-variant="${work}">`);
			expect(html).not.toContain("wt-story--lead");
		}
	});

	it("puts the work's whole story, embeds included, on its own page", () => {
		const { html } = renderTestPage(warta, { resume: fullTestResume(), page: { kind: "work", workId: "w1" } });
		expectSoundPage(html, "warta");
		expect(html).toContain('class="pf-workpage"');
		expect(html).toContain("Orders took too long.");
		for (const marker of ["pf-gallery", "pf-video", "pf-pdf", "pf-link", "pf-workpage__more"])
			expect(html, marker).toContain(marker);
		expect(count(html, /class="pf-embed"/g)).toBe(5);
		expect(html).toContain('data-shape="audio-tall"');
		expect(html).not.toMatch(/<iframe/);
		expect(html).not.toContain("wt-masthead");
	});

	it("sets a masthead: the headline as kicker above the centred name, then the dateline and Open to work", () => {
		const { html } = renderTestPage(warta);
		expectSoundPage(html, "warta");
		expect(html).toContain('data-variant="big-name"');
		expect(html.indexOf('class="wt-kicker"')).toBeLessThan(html.indexOf("<h1"));
		expect(html.indexOf('class="wt-dateline"')).toBeGreaterThan(html.indexOf("<h1"));
		// The big name keeps the photo small, by the dateline.
		expect(html).toMatch(/<div class="wt-dateline"><img class="wt-byline"/);
		expect(html.indexOf('class="pf-opento"')).toBeGreaterThan(html.indexOf('class="pf-chips"'));
		// With nothing to say, there's no empty dateline.
		const plain = renderTestPage(
			{ theme: "warta", hero: { showPicture: false }, location: { label: "" } },
			{ resume: null },
		).html;
		expectSoundPage(plain, "warta");
		expect(plain).not.toContain("wt-dateline");
	});

	it("shows the photo above the masthead or beside it in the other intros, and never a hidden one", () => {
		const top = renderTestPage({ ...warta, design: { variants: { hero: "photo-top" } } }).html;
		expectSoundPage(top, "warta");
		expect(top).toMatch(/data-variant="photo-top" data-photo=""[^>]*><img class="wt-portrait"/);
		expect(top).not.toContain("wt-byline");
		const left = renderTestPage({ ...warta, design: { variants: { hero: "photo-left" } } }).html;
		expect(left).toContain('data-variant="photo-left" data-photo=""');
		const hidden = renderTestPage({
			...warta,
			hero: { ...fullPortfolioData.hero, showPicture: false },
			design: { variants: { hero: "photo-left" } },
			sections: { hidden: ["work"] },
		}).html;
		expectSoundPage(hidden, "warta");
		expect(hidden).not.toMatch(/wt-portrait|wt-byline|formal\.webp|data-photo/);
		expect(hidden).not.toContain("Coffee ordering app");
	});

	it("numbers full sections like folios and gathers short lists that follow each other in brief", () => {
		const { html, view } = renderTestPage(warta, { resume: fullTestResume() });
		expectSoundPage(html, "warta");
		const full = view.sections.filter((section) => !["certifications", "languages"].includes(section.kind));
		expect(count(html, /<span class="wt-folio" aria-hidden="true">\d\d<\/span>/g)).toBeGreaterThanOrEqual(
			full.length - 2,
		);
		expect(html).toContain('<span class="wt-folio" aria-hidden="true">01</span>');
		const brief = html.slice(html.indexOf('<div class="wt-brief">'));
		expect(html).toContain('<div class="wt-brief">');
		expect(brief.indexOf('id="certifications"')).toBeGreaterThan(0);
		expect(brief.indexOf('id="languages"')).toBeGreaterThan(0);
		// Publications stand as a section of their own, high on the page.
		expect(html).toContain('class="pf-section wt-section wt-section--publications"');
		expect(html.indexOf('id="publications"')).toBeLessThan(html.indexOf('id="experience"'));
	});

	it("starts light and red without a resume, in Newsreader with Libre Franklin, and keeps chosen colours", () => {
		const { view, page, html } = renderTestPage(
			{ theme: "warta", basics: { name: "Laras Kinanti" } },
			{ resume: null },
		);
		expectSoundPage(html, "warta");
		expect(view.design.accent).toBe("#B42318");
		expect(page.scheme).toBe("light");
		expect(view.design.effect.id).toBe("fade-up");
		expect(view.design.fonts).toMatchObject({ heading: "Newsreader", body: "Libre Franklin" });
		expect(page.css).toContain('font-family:"Newsreader";font-weight:500');
		expect(page.css).toContain('font-family:"Newsreader";font-weight:600');
		expect(page.preloadFont).toBe(getWebFont("Newsreader")?.files["500"]);
		expect(page.themeColors).toEqual({ light: "#FBFAF7", dark: "#14130F" });
		const chosen = renderTestPage({ theme: "warta", design: { accent: { source: "custom", color: "#0f766e" } } });
		expect(chosen.view.design.accent).toBe("#0F766E");
	});

	it("scopes every rule to the theme, keeps drop caps off right-to-left pages, and adds no script", () => {
		for (const line of WARTA_CSS.trim().split("\n"))
			expect(line, line.slice(0, 80)).toMatch(
				/^(?:\.pf\[data-theme="warta"\]|@media|:root:not\(\[dir="rtl"\]\) \.pf\[data-theme="warta"\])/,
			);
		expect(WARTA_CSS).toMatch(/\[data-bg\]:not\(\[data-bg="plain"\]\)\{[^}]*background:var\(--pf-hero-bg\)\}/);
		expect(WARTA_CSS).not.toMatch(/\[data-variant="timeline"\] \.pf-cvitem|\[data-bg="(?:soft-gradient|pattern)"\]/);
		const capRules = WARTA_CSS.split("\n").filter((line) => line.includes("::first-letter"));
		expect(capRules).toHaveLength(1);
		expect(capRules[0]).toMatch(/^:root:not\(\[dir="rtl"\]\) /);
		expect(WARTA_CSS).not.toMatch(/content:"[^"]+"(?!\/|;content)/);
		const still = { hero: { ...fullPortfolioData.hero, effect: { id: "none" } } } as const;
		expect(renderTestPage({ ...warta, ...still }).page.script).toBe(
			renderTestPage({ ...fullPortfolioData, ...still, theme: "lugas" }).page.script,
		);
	});
});
