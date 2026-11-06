import type { PortfolioHeroEffect, PortfolioTheme } from "@rezumi/schema/portfolio/themes";
import { describe, expect, it } from "vite-plus/test";
import { parseWritablePortfolioData } from "@rezumi/schema/portfolio/data";
import { PORTFOLIO_ACCENTS, PORTFOLIO_THEME_INFO, PORTFOLIO_THEMES } from "@rezumi/schema/portfolio/themes";
import { contrastRatio } from "@rezumi/utils/contrast";
import { testResume } from "../fixtures.test-helpers";
import { portfolioMessages, portfolioViewMessages } from "../messages";
import { renderPortfolioPage } from "../page";
import { PORTFOLIO_PAGE_SCRIPT } from "../script";
import { THEME_PALETTES } from "../themes/palettes";
import { buildPortfolioView } from "../view";
import { gradientColors } from "./colors";
import { EFFECT_CSS } from "./css";
import { PREVIEW_STILL_CSS } from "./editor";
import { effectScript } from "./index";

type Options = { theme?: PortfolioTheme; target?: "name" | "headline"; phrases?: string[]; headline?: string };

function render(effect: PortfolioHeroEffect, options: Options = {}) {
	const resume = testResume();
	if (options.headline !== undefined) resume.basics.headline = options.headline;
	const data = parseWritablePortfolioData({
		theme: options.theme ?? "lugas",
		hero: { effect: { id: effect, target: options.target ?? "name", phrases: options.phrases ?? [] } },
	});
	const messages = portfolioMessages("id-ID");
	const view = buildPortfolioView({
		portfolio: { data },
		resume: { data: resume },
		owner: { name: "Nadia", username: "nadia" },
		entitlements: { hidePortfolioCredit: false },
		messages: portfolioViewMessages(messages),
		fileUrl: (key) => `https://rezumi.example/${key}`,
	});
	return renderPortfolioPage({ view, messages, year: 2026, creditUrl: "https://rezumi.example" });
}

/** The name as a reader gets it: the h1's text without tags. */
const nameText = (html: string) =>
	/<h1[^>]*>([\s\S]*?)<\/h1>/
		.exec(html)?.[1]
		?.replace(/<[^>]+>/g, "")
		.trim();

const SCRIPT_EFFECTS = ["typewriter", "scramble", "vector-hover"] as const;

describe("intro effects", () => {
	for (const theme of PORTFOLIO_THEMES)
		for (const effect of PORTFOLIO_THEME_INFO[theme].effects)
			it(`${theme} × ${effect}: the real text is in the page and only that effect's code ships`, () => {
				const page = render(effect, { theme, phrases: ["UX Researcher", "Mentor"] });
				expect(nameText(page.html)).toBe("Nadia Rahmawati");
				expect(page.html).not.toMatch(/undefined|NaN/);
				if (effect === "none") {
					expect(page.html).not.toContain("data-pfx");
					expect(page.css).not.toContain("pfx");
					expect(page.script).toBe(PORTFOLIO_PAGE_SCRIPT);
					return;
				}
				expect(page.html).toContain(`data-pfx="${effect}"`);
				expect(page.css).toContain(EFFECT_CSS[effect].trim().slice(0, 40));
				for (const other of Object.keys(EFFECT_CSS) as (keyof typeof EFFECT_CSS)[])
					if (other !== effect && !EFFECT_CSS[effect].includes(EFFECT_CSS[other].trim()))
						expect(page.css).not.toContain(EFFECT_CSS[other].trim());
				const extra = page.script.slice(PORTFOLIO_PAGE_SCRIPT.length);
				expect(page.script.startsWith(PORTFOLIO_PAGE_SCRIPT)).toBe(true);
				if ((SCRIPT_EFFECTS as readonly string[]).includes(effect)) expect(extra.length).toBeGreaterThan(0);
				else expect(extra).toBe("");
				// `02-teknis.md` section 23: an effect's script stays under 3 KB.
				expect(extra.length).toBeLessThanOrEqual(3 * 1024);
			});

	it("falls back to the theme's default for an effect the theme doesn't offer", () => {
		// Prima offers none, fade-up, shimmer and typewriter; its default is none.
		const page = render("scramble", { theme: "prima" });
		expect(page.html).not.toContain("data-pfx");
	});

	it("types the headline first, keeps every phrase readable and hides the moving copy from screen readers", () => {
		const page = render("typewriter", { phrases: ["UX Researcher", "Mentor", "Too many"] });
		const headline = /<p[^>]*data-pfx="typewriter"[^>]*>([\s\S]*?)<\/p>/.exec(page.html)?.[0] ?? "";
		expect(headline).toContain('aria-hidden="true"');
		expect(headline).toContain('<span class="sr-only">Product Designer · UX Researcher · Mentor</span>');
		expect(headline).toContain('<span class="pfx-type__out">Product Designer</span>');
		expect(headline).not.toContain("Too many");
	});

	it("leaves the typewriter off when there is only one thing to type", () => {
		expect(render("typewriter", { headline: "" }).html).not.toContain("data-pfx");
		expect(render("typewriter", { phrases: ["Product Designer"] }).html).not.toContain("data-pfx");
	});

	it("plays on the headline when asked, and on the name when there's no headline", () => {
		expect(render("shimmer", { target: "headline" }).html).toMatch(/<p[^>]*data-pfx="shimmer"[^>]*>Product Designer/);
		expect(render("shimmer", { target: "headline", headline: "" }).html).toMatch(/<h1[^>]*data-pfx="shimmer"/);
	});

	it("keeps a Latin name in order on a right-to-left page", () => {
		expect(render("fade-up").html).toContain('<span dir="auto"><span class="pfx-w" style="--i:0">Nadia</span>');
	});

	it("moves only for visitors who don't ask for less motion", () => {
		for (const [effect, css] of Object.entries(EFFECT_CSS)) {
			const outside = css.replace(/@media \(prefers-reduced-motion:no-preference\)[^{]*\{(?:[^{}]|\{[^{}]*\})*\}/g, "");
			expect(outside, effect).not.toMatch(/animation:pfx/);
		}
		expect(PREVIEW_STILL_CSS).toContain("animation:none!important");
	});

	it("ships self-contained scripts that run against any document", () => {
		for (const effect of SCRIPT_EFFECTS) {
			const script = effectScript(effect);
			expect(script).toMatch(/\(document\);$/);
			expect(script).not.toMatch(/\bimport\b|\brequire\(|<\/script/i);
			const document = {
				defaultView: { matchMedia: () => ({ matches: false }), performance: { now: () => 0 } },
				querySelectorAll: () => [],
			};
			// oxlint-disable-next-line no-new-func -- runs the inlined source to prove it has no outside references.
			expect(() => new Function("document", script)(document)).not.toThrow();
		}
	});

	it("keeps Gradien hidup's colours readable in both modes of every theme, for every accent", () => {
		const accents = [
			...Object.values(PORTFOLIO_ACCENTS).map((accent) => accent.color),
			"#FFD60A",
			"#111111",
			"#FFFFFF",
		];
		for (const palette of Object.values(THEME_PALETTES))
			for (const mode of ["light", "dark"] as const)
				for (const accent of accents)
					for (const colour of gradientColors(accent, palette[mode])) {
						expect(contrastRatio(colour, palette[mode].bg)).toBeGreaterThanOrEqual(4.5);
						expect(contrastRatio(colour, palette[mode].surface)).toBeGreaterThanOrEqual(4.5);
					}
	});
});
