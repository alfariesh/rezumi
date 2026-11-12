import { describe, expect, it } from "vite-plus/test";
import { getWebFont } from "@rezumi/fonts";
import { expectSoundPage, fullPortfolioData, fullTestResume, renderTestPage } from "../../fixtures.test-helpers";

describe("Brutal", () => {
	it("preserves the user's section order, titles and work content", () => {
		const { html } = renderTestPage({
			...fullPortfolioData,
			theme: "brutal",
			sections: { order: ["about", "work", "contact"], titles: { work: "Selected work" } },
		});
		expectSoundPage(html, "brutal");
		expect(html.indexOf('id="about"')).toBeLessThan(html.indexOf('id="work"'));
		expect(html).toContain("Selected work");
		expect(html).toContain("Coffee ordering app");
		// The work's own text is on its page; its card links there.
		expect(html).toContain('href="/nadia/work/kopi-app"');
		const work = renderTestPage(
			{ ...fullPortfolioData, theme: "brutal", locale: "id-ID" },
			{ page: { kind: "work", workId: "w1" } },
		).html;
		expectSoundPage(work, "brutal");
		expect(work).toContain("Orders took too long.");
	});

	it("renders all existing sections and attachment blocks through the shared renderer", () => {
		const { html } = renderTestPage({ ...fullPortfolioData, theme: "brutal" }, { resume: fullTestResume() });
		expectSoundPage(html, "brutal");
		// The blocks are on the work's own page, every kind of them, embeds included.
		const work = renderTestPage(
			{ ...fullPortfolioData, theme: "brutal" },
			{ resume: fullTestResume(), page: { kind: "work", workId: "w1" } },
		).html;
		expectSoundPage(work, "brutal");
		for (const marker of ["pf-gallery", "pf-video", "pf-embed", "pf-pdf", "pf-link", "pf-workpage__more"])
			expect(work, marker).toContain(marker);
		for (const marker of [
			"pf-loc",
			"pf-service",
			"pf-quote",
			"pf-logos",
			'class="pf-tags" data-variant="chips"',
			"resume-tools",
		])
			expect(html, marker).toContain(marker);
	});

	it("keeps hidden portraits and work out of the public page, including dialogs", () => {
		const { html } = renderTestPage({
			...fullPortfolioData,
			theme: "brutal",
			hero: { ...fullPortfolioData.hero, showPicture: false },
			sections: { hidden: ["work"] },
		});
		expectSoundPage(html, "brutal");
		expect(html).toContain('class="br-monogram"');
		expect(html).not.toContain('class="br-photo"');
		expect(html).not.toContain("Coffee ordering app");
		expect(html).not.toContain("pf-detail");
		expect(html).not.toContain("pf-lightbox");
	});

	it("uses yellow for a standalone portfolio and respects the user's chosen accent", () => {
		const { view, html, page } = renderTestPage(
			{ theme: "brutal", basics: { name: "Alya Pramesti" } },
			{ resume: null },
		);
		expectSoundPage(html, "brutal");
		expect(view.design.accent).toBe("#FFD23F");
		expect(view.design.fonts).toMatchObject({ heading: "Space Grotesk", body: "Inter" });
		expect(page.css).toContain('font-family:"IBM Plex Mono";font-weight:700');
		expect(page.preloadFont).toBe(getWebFont("Space Grotesk")?.files["700"]);
		const chosen = renderTestPage({ theme: "brutal", design: { accent: { source: "custom", color: "#7c3aed" } } });
		expect(chosen.view.design.accent).toBe("#7C3AED");
	});
});
