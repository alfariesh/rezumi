import { describe, expect, it } from "vite-plus/test";
import { getWebFont } from "@rezumi/fonts";
import { count, expectSoundPage, fullPortfolioData, fullTestResume, renderTestPage } from "../../fixtures.test-helpers";
import { SINTAKS_CSS } from "./css";

const sintaks = { ...fullPortfolioData, theme: "sintaks" } as const;

describe("Sintaks", () => {
	it("keeps the user's order and titles, and draws works as repositories linking to their own pages", () => {
		const { html } = renderTestPage({
			...sintaks,
			sections: { order: ["about", "work", "contact"], titles: { work: "Repositories" } },
		});
		expectSoundPage(html, "sintaks");
		expect(html.indexOf('id="about"')).toBeLessThan(html.indexOf('id="work"'));
		expect(html).toContain("Repositories");
		expect(html).toContain('<a class="sk-repo__link" href="/nadia/work/kopi-app">');
		// The tags read as languages, each with a decorative dot.
		expect(html).toMatch(
			/<ul class="sk-langs"><li><i aria-hidden="true" style="--sk-dot:#[\dA-F]{6}"><\/i>Mobile<\/li>/,
		);
		// The main link is its own link beside the card's, never inside it.
		const card = html.slice(
			html.indexOf('class="sk-repo__link"'),
			html.indexOf("</a>", html.indexOf('class="sk-repo__link"')),
		);
		expect(card).not.toContain("sk-repo__code");
		expect(html).toMatch(/<a class="sk-repo__code" data-pf-event="link" href="https:\/\/behance\.example\.test\/kopi"/);
		expect(html).not.toContain("Hidden work");
	});

	it("puts the work's whole story, embeds included, on its own page", () => {
		const { html } = renderTestPage(sintaks, { resume: fullTestResume(), page: { kind: "work", workId: "w1" } });
		expectSoundPage(html, "sintaks");
		expect(html).toContain('class="pf-workpage"');
		expect(html).toContain("Orders took too long.");
		for (const marker of ["pf-gallery", "pf-video", "pf-pdf", "pf-link", "pf-workpage__more"])
			expect(html, marker).toContain(marker);
		expect(count(html, /class="pf-embed"/g)).toBe(5);
		expect(html).toContain(
			'data-embed="https://embed.figma.com/design/AbCdEf0123456789?embed-host=rezumi&amp;node-id=1-2"',
		);
		expect(html).not.toMatch(/<iframe/);
		// A work page has no intro: no terminal, no prompts.
		expect(html).not.toContain("sk-term");
	});

	it("draws the intro as a terminal whose decoration screen readers skip", () => {
		const { html } = renderTestPage(sintaks);
		expectSoundPage(html, "sintaks");
		expect(html).toContain(
			'<div class="sk-win__bar" aria-hidden="true"><i></i><i></i><i></i><span dir="ltr">nadia@portfolio: ~</span></div>',
		);
		const intro = (markup: string) => markup.slice(markup.indexOf('class="sk-hero"'), markup.indexOf("</section>"));
		expect(count(intro(html), /<p class="sk-cmd" aria-hidden="true">/g)).toBe(3);
		// Contact is a second terminal.
		expect(html).toContain("./contact.sh");
		expect(html).toContain("whoami");
		expect(html).toContain("cat role.txt");
		expect(html.indexOf("whoami")).toBeLessThan(html.indexOf("<h1"));
		// "Open to work" comes after the chips, in words.
		expect(html.indexOf('class="pf-opento"')).toBeGreaterThan(html.indexOf('class="pf-chips"'));
		// Without a headline there's no file to read.
		const plain = renderTestPage({ theme: "sintaks", basics: { headline: "" } }, { resume: null }).html;
		expectSoundPage(plain, "sintaks");
		expect(plain).not.toContain("cat role.txt");
		expect(count(intro(plain), /<p class="sk-cmd" aria-hidden="true">/g)).toBe(2);
	});

	it("puts the photo in a window beside the terminal, or leaves it out for the big name", () => {
		const right = renderTestPage(sintaks).html;
		expect(right).toContain('data-variant="photo-right"');
		expect(right).toContain('class="sk-photo__img"');
		const left = renderTestPage({ ...sintaks, design: { variants: { hero: "photo-left" } } }).html;
		expect(left).toContain('data-variant="photo-left"');
		expect(left).toContain('class="sk-photo__img"');
		const big = renderTestPage({ ...sintaks, design: { variants: { hero: "big-name" } } }).html;
		expectSoundPage(big, "sintaks");
		expect(big).toContain('data-variant="big-name"');
		expect(big).not.toContain("sk-photo");
	});

	it("keeps a hidden portrait and hidden work out of the page", () => {
		const { html } = renderTestPage({
			...sintaks,
			hero: { ...fullPortfolioData.hero, showPicture: false },
			sections: { hidden: ["work"] },
		});
		expectSoundPage(html, "sintaks");
		expect(html).toContain('data-variant="big-name"');
		expect(html).not.toContain("sk-photo");
		expect(html).not.toContain("formal.webp");
		expect(html).not.toContain("Coffee ordering app");
		expect(html).not.toContain("pf-lightbox");
	});

	it("draws the career as a git log and skills as one tech stack", () => {
		const { html } = renderTestPage(sintaks, { resume: fullTestResume() });
		expectSoundPage(html, "sintaks");
		expect(html).toContain('<ol class="sk-log" data-variant="timeline">');
		expect(html).toMatch(/<span class="sk-hash" aria-hidden="true">[\da-f]{7}<\/span>/);
		// Each experience log marks its latest entry HEAD.
		expect(count(html, /class="sk-ref"/g)).toBe(count(html, /<ol class="sk-log"/g));
		// A job's roles are commits of their own.
		expect(html).toContain('class="sk-commit sk-commit--role"');
		expect(html).toContain("Senior Engineer");
		// Every keyword once, the resume's custom skills section too.
		expect(html).toContain('<ul class="pf-tags sk-stack" data-variant="chips">');
		expect(html).toMatch(/<li><i aria-hidden="true" style="--sk-dot:#[\dA-F]{6}"><\/i>Figma<\/li>/);
		const compact = renderTestPage(
			{ ...sintaks, design: { variants: { experience: "compact", skills: "groups" } } },
			{ resume: fullTestResume() },
		).html;
		expectSoundPage(compact, "sintaks");
		expect(compact).toContain('<ol class="sk-log" data-variant="compact">');
		expect(compact).toContain('class="pf-skillgroups"');
		expect(compact).not.toContain("sk-stack");
	});

	it("starts dark and green without a resume, in Geist with JetBrains Mono, and keeps chosen colours", () => {
		const { view, page, html } = renderTestPage(
			{ theme: "sintaks", basics: { name: "Raka Pratama" } },
			{ resume: null },
		);
		expectSoundPage(html, "sintaks");
		expect(view.design.accent).toBe("#22C55E");
		expect(page.scheme).toBe("dark");
		expect(view.design.effect.id).toBe("scramble");
		expect(html).toMatch(/<h1 class="pf-name sk-name"[^>]* data-pfx="scramble"/);
		expect(view.design.fonts).toMatchObject({ heading: "Geist", body: "Geist", mono: "JetBrains Mono" });
		expect(page.css).toContain('font-family:"JetBrains Mono";font-weight:700');
		expect(page.preloadFont).toBe(getWebFont("Geist")?.files["700"]);
		expect(page.themeColors).toEqual({ light: "#FAFBFC", dark: "#0B0F14" });
		const chosen = renderTestPage({ theme: "sintaks", design: { accent: { source: "custom", color: "#7c3aed" } } });
		expect(chosen.view.design.accent).toBe("#7C3AED");
	});

	it("scopes every rule to the theme and adds no script of its own", () => {
		for (const line of SINTAKS_CSS.trim().split("\n"))
			expect(line, line.slice(0, 80)).toMatch(/^(?:\.pf\[data-theme="sintaks"\]|@media|@keyframes sk-)/);
		expect(SINTAKS_CSS).toMatch(/\[data-bg\]:not\(\[data-bg="plain"\]\)\{[^}]*background:var\(--pf-hero-bg\)\}/);
		expect(SINTAKS_CSS).not.toMatch(/\[data-variant="timeline"\] \.pf-cvitem|\[data-bg="(?:soft-gradient|pattern)"\]/);
		expect(SINTAKS_CSS).toContain(
			'@media (prefers-reduced-motion:reduce){.pf[data-theme="sintaks"] .sk-caret{animation:none}',
		);
		// Decoration made of text is left out of what assistive technology reads.
		for (const [rule] of SINTAKS_CSS.matchAll(/content:"[^"]+";content:"[^"]+"\/""/g)) expect(rule).toBeTruthy();
		expect(SINTAKS_CSS).not.toMatch(/content:"[^"]+"(?!\/|;content)/);
		const still = { hero: { ...fullPortfolioData.hero, effect: { id: "none" } } } as const;
		expect(renderTestPage({ ...sintaks, ...still }).page.script).toBe(
			renderTestPage({ ...fullPortfolioData, ...still, theme: "lugas" }).page.script,
		);
	});
});
