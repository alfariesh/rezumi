import { describe, expect, it } from "vite-plus/test";
import { expectSoundPage, fullPortfolioData, fullTestResume, renderTestPage } from "../../fixtures.test-helpers";

describe("Paper", () => {
	it("uses the portfolio's actual content, section order and translated labels", () => {
		const { html } = renderTestPage({
			...fullPortfolioData,
			theme: "paper",
			locale: "id-ID",
			sections: { order: ["work", "about", "contact"], titles: { work: "Pilihan karya" } },
		});
		expectSoundPage(html, "paper");
		expect(html.indexOf('id="work"')).toBeLessThan(html.indexOf('id="about"'));
		expect(html).toContain("Pilihan karya");
		expect(html).toContain("Coffee ordering app");
		// The work's own text is on its page; its card links there.
		expect(html).toContain('href="/nadia/work/kopi-app"');
		const work = renderTestPage(
			{ ...fullPortfolioData, theme: "paper", locale: "id-ID" },
			{ page: { kind: "work", workId: "w1" } },
		).html;
		expectSoundPage(work, "paper");
		expect(work).toContain("Orders took too long.");
		expect(html).not.toContain("Salman");
	});

	it("publishes no hidden portrait or hidden work", () => {
		const { html } = renderTestPage({
			...fullPortfolioData,
			theme: "paper",
			hero: { ...fullPortfolioData.hero, showPicture: false },
			sections: { hidden: ["work"] },
		});
		expectSoundPage(html, "paper");
		expect(html).not.toContain('class="pp-photo"');
		expect(html).not.toContain("Coffee ordering app");
		expect(html).not.toContain("pf-detail");
		expect(html).not.toContain("pf-lightbox");
	});

	it("keeps every section and media block when switched from another theme", () => {
		const { html } = renderTestPage({ ...fullPortfolioData, theme: "paper" }, { resume: fullTestResume() });
		expectSoundPage(html, "paper");
		// The blocks are on the work's own page, every kind of them, embeds included.
		const work = renderTestPage(
			{ ...fullPortfolioData, theme: "paper" },
			{ resume: fullTestResume(), page: { kind: "work", workId: "w1" } },
		).html;
		expectSoundPage(work, "paper");
		for (const marker of ["pf-gallery", "pf-video", "pf-embed", "pf-pdf", "pf-link", "pf-workpage__more"])
			expect(work, marker).toContain(marker);
		for (const marker of ["pf-loc", "pf-service", "pf-quote", "pf-logos", "pf-skillgroups", "resume-tools"])
			expect(html, marker).toContain(marker);
	});

	it("starts without a resume in orange ink and Google Sans, while respecting chosen colours", () => {
		const { view, page, html } = renderTestPage({ theme: "paper", basics: { name: "Rani Putri" } }, { resume: null });
		expectSoundPage(html, "paper");
		expect(view.design.accent).toBe("#F54E00");
		expect(view.design.fonts).toMatchObject({ heading: "Google Sans", body: "Google Sans", mono: "JetBrains Mono" });
		expect(page.css).toContain('font-family:"JetBrains Mono"');
		const chosen = renderTestPage({ theme: "paper", design: { accent: { source: "custom", color: "#0f766e" } } });
		expect(chosen.view.design.accent).toBe("#0F766E");
		const resume = fullTestResume();
		resume.metadata.design.colors.primary = "rgba(220, 38, 38, 1)";
		expect(renderTestPage({ theme: "paper" }, { resume }).view.design.accent).toBe("#DC2626");
	});
});
