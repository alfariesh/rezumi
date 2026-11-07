import type { PortfolioDataInput } from "@rezumi/schema/portfolio/data";
import { describe, expect, it } from "vite-plus/test";
import { getWebFont } from "@rezumi/fonts";
import {
	PORTFOLIO_FONT_PAIRS,
	PORTFOLIO_MONO_FONT,
	PORTFOLIO_THEME_INFO,
	PORTFOLIO_THEMES,
} from "@rezumi/schema/portfolio/themes";
import {
	expectSoundPage,
	fullPortfolioData,
	fullTestResume,
	renderTestPage,
	testResume,
} from "./fixtures.test-helpers";
import { BASE_CSS } from "./shared/base-css";
import { KANVAS_CSS } from "./themes/kanvas/css";
import { LUGAS_CSS } from "./themes/lugas/css";
import { MOZAIK_CSS } from "./themes/mozaik/css";
import { PRIMA_CSS } from "./themes/prima/css";

describe("portfolio font pairs", () => {
	it("only pair fonts the page can load on the web", () => {
		for (const pair of Object.values(PORTFOLIO_FONT_PAIRS)) {
			expect(getWebFont(pair.heading), pair.heading).toBeDefined();
			expect(getWebFont(pair.body), pair.body).toBeDefined();
		}
		expect(getWebFont(PORTFOLIO_MONO_FONT)).toBeDefined();
	});
});

/** The theme's default, then each variant it offers on its own. */
function variantSets(theme: (typeof PORTFOLIO_THEMES)[number]): Record<string, string>[] {
	const options = PORTFOLIO_THEME_INFO[theme].variants as Record<string, readonly string[]>;
	return [{}, ...Object.entries(options).flatMap(([key, values]) => values.map((value) => ({ [key]: value })))];
}

describe("every theme draws a sound page (`expectSoundPage`)", () => {
	for (const theme of PORTFOLIO_THEMES)
		it(`${theme}: every variant, left to right and right to left, full and nearly empty`, () => {
			for (const locale of [undefined, "ar-SA"]) {
				for (const variants of variantSets(theme)) {
					const data = {
						...fullPortfolioData,
						theme,
						sections: { hidden: [] },
						design: { variants },
					} as PortfolioDataInput;
					const { html } = renderTestPage(data, { resume: fullTestResume(), ...(locale ? { locale } : {}) });
					expectSoundPage(html, theme);
				}
				const empty = testResume();
				empty.sections.experience.items = [];
				empty.sections.profiles.items = [];
				empty.basics.email = "";
				empty.basics.headline = "";
				empty.basics.website = { url: "", label: "" };
				empty.picture.url = "";
				const { html } = renderTestPage(
					{ theme, about: { content: "" }, works: { items: [] } },
					{ resume: empty, ...(locale ? { locale } : {}) },
				);
				expectSoundPage(html, theme);
			}
		});
});

describe("shared and theme rules", () => {
	const THEME_CSS = [BASE_CSS, LUGAS_CSS, PRIMA_CSS, KANVAS_CSS, MOZAIK_CSS];

	it("draws the timeline on a list's own items only, so a job's roles get no dots or second rail", () => {
		for (const css of THEME_CSS) expect(css).not.toMatch(/\[data-variant="timeline"\] \.pf-cvitem/);
		expect(BASE_CSS).toContain('.pf-cvlist[data-variant="timeline"]>.pf-cvitem{');
		const { html } = renderTestPage(
			{ ...fullPortfolioData, design: { variants: { experience: "timeline" } } },
			{ resume: fullTestResume() },
		);
		expect(html).toMatch(
			/<ol class="pf-cvlist" data-variant="timeline">[\s\S]*?<ul class="pf-cvitem__roles"><li class="pf-cvitem">/,
		);
	});

	it("shows an open detail without waiting for :target, and styles every short list by its own class", () => {
		expect(BASE_CSS).toContain(".pf-detail:target,.pf-detail.pf-open{display:block}");
		expect(BASE_CSS).toContain(".pf-extralist{");
		for (const css of THEME_CSS) expect(css).not.toMatch(/\.pf-extra (?:ul|li)\b/);
	});

	it("draws the intro's backgrounds from one set of rules, each theme choosing its ground and shade", () => {
		expect(BASE_CSS).toContain(
			'[data-bg="image"]{--pf-hero-bg:linear-gradient(var(--pf-hero-shade,rgb(8 10 14/.62),rgb(8 10 14/.7))),var(--pf-hero-image) center/cover no-repeat,#111;color-scheme:dark;--pf-text:#fff;',
		);
		expect(BASE_CSS).toContain("var(--pf-hero-ground,var(--pf-bg))}");
		for (const css of [LUGAS_CSS, PRIMA_CSS, KANVAS_CSS, MOZAIK_CSS]) {
			expect(css).toMatch(/\[data-bg\]:not\(\[data-bg="plain"\]\)\{[^}]*background:var\(--pf-hero-bg\)\}/);
			expect(css).not.toMatch(/\[data-bg="(?:soft-gradient|pattern)"\]|--pf-text:#fff/);
		}
		// The shades each theme had, kept: Lugas and Kanvas use the shared one.
		expect(PRIMA_CSS).toContain(
			"--pf-hero-ground:var(--pf-surface);--pf-hero-shade:rgb(8 10 14/.68),rgb(8 10 14/.76)}",
		);
		expect(MOZAIK_CSS).toContain(
			"--pf-hero-ground:var(--pf-surface);--pf-hero-shade:rgb(8 10 14/.7),rgb(8 10 14/.78);",
		);
	});

	it("keeps no rule that another one already makes, and no !important fight with the footer", () => {
		expect(KANVAS_CSS).not.toContain(".pf-video .pf-cover");
		expect(KANVAS_CSS).not.toContain("clip:rect");
		expect(LUGAS_CSS).not.toContain(".lg-stats .pf-metric__label{order:2");
		expect(BASE_CSS).not.toMatch(/\.pf-badge\{[^}]*!important/);
		expect(BASE_CSS).toContain(".pf-foot a:not(.pf-badge){");
	});
});
