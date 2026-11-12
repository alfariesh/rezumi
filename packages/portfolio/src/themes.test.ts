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
	count,
	expectSoundPage,
	fullPortfolioData,
	fullTestResume,
	renderTestPage,
	testResume,
} from "./fixtures.test-helpers";
import { BASE_CSS } from "./shared/base-css";
import { BRUTAL_CSS } from "./themes/brutal/css";
import { KANVAS_CSS } from "./themes/kanvas/css";
import { LUGAS_CSS } from "./themes/lugas/css";
import { MOZAIK_CSS } from "./themes/mozaik/css";
import { PAPER_CSS } from "./themes/paper/css";
import { PRIMA_CSS } from "./themes/prima/css";
import { SINTAKS_CSS } from "./themes/sintaks/css";
import { WARTA_CSS } from "./themes/warta/css";

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

describe("every theme draws a sound work page", () => {
	for (const theme of PORTFOLIO_THEMES)
		it(`${theme}: each work's own page, left to right and right to left`, () => {
			for (const locale of [undefined, "ar-SA"]) {
				const data = { ...fullPortfolioData, theme } as PortfolioDataInput;
				const options = { resume: fullTestResume(), ...(locale ? { locale } : {}) };
				const { view } = renderTestPage(data, options);
				expect(view.works.length).toBeGreaterThan(1);
				for (const work of view.works) {
					const { html, page } = renderTestPage(data, { ...options, page: { kind: "work", workId: work.id } });
					expectSoundPage(html, theme);
					// The work's title is the page's one h1; the picture viewer, when there is one, is the only dialog.
					expect(html).toContain(`<h1 class="pf-detail__title" id="${work.anchor}--title">`);
					expect(count(html, /role="dialog"/g)).toBe(work.blocks.some((block) => block.type === "images") ? 1 : 0);
					expect(html).not.toMatch(/data-pfx|pf-detail"/);
					expect(page.script).not.toMatch(/pfx/);
				}
			}
		});
});

describe("every theme says what the person is looking for", () => {
	for (const theme of PORTFOLIO_THEMES)
		it(`${theme}: in the intro, right after its chips, and nothing when there's nothing to say`, () => {
			const { html } = renderTestPage({ ...fullPortfolioData, theme }, { locale: "en-US" });
			const line =
				'<p class="pf-opento"><span class="pf-opento__label">Looking for:</span> Product Designer · UI Designer — Full-time, Contract</p>';
			expect(html).toContain(line);
			expect(html.indexOf(line)).toBeGreaterThan(html.indexOf('class="pf-chips"'));
			expect(html.indexOf(line)).toBeLessThan(html.indexOf("</main>"));
			const off = renderTestPage({
				...fullPortfolioData,
				theme,
				hero: {
					...fullPortfolioData.hero,
					availability: { show: false, text: "", roles: ["Designer"], types: ["contract"] },
				},
			}).html;
			expect(off).not.toContain("pf-opento");
			const rtl = renderTestPage({ ...fullPortfolioData, theme }, { locale: "ar-SA" }).html;
			expect(rtl).toMatch(
				/<p class="pf-opento"><span class="pf-opento__label">[^<]+:<\/span> Product Designer · UI Designer — /,
			);
		});
});

describe("shared and theme rules", () => {
	const THEME_CSS = [
		BASE_CSS,
		LUGAS_CSS,
		PRIMA_CSS,
		KANVAS_CSS,
		MOZAIK_CSS,
		PAPER_CSS,
		BRUTAL_CSS,
		SINTAKS_CSS,
		WARTA_CSS,
	];

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

	it("styles a work's own page in shared rules, keeps no rule for the old detail dialog, and styles every short list by its own class", () => {
		expect(BASE_CSS).toContain(".pf-workpage{display:grid;");
		expect(BASE_CSS).toContain(".pf-workpage__more{");
		// A theme rule scoped to the old dialog would silently style nothing on the work's page.
		for (const css of THEME_CSS) expect(css).not.toMatch(/\.pf-detail(?:\{|:target|__panel|__bar)|\.pf-open\b/);
		expect(BASE_CSS).toContain(".pf-extralist{");
		for (const css of THEME_CSS) expect(css).not.toMatch(/\.pf-extra (?:ul|li)\b/);
	});

	it("draws the intro's backgrounds from one set of rules, each theme choosing its ground and shade", () => {
		expect(BASE_CSS).toContain(
			'[data-bg="image"]{--pf-hero-bg:linear-gradient(var(--pf-hero-shade,rgb(8 10 14/.7),rgb(8 10 14/.78))),var(--pf-hero-image) center/cover no-repeat,#111;color-scheme:dark;--pf-bg:#111;--pf-text:#fff;',
		);
		// Accent text over a picture is the dark mode's accent lifted towards white: over a light picture under the shade
		// it still reads (about 4.4:1 at worst, against 1.8:1 before).
		expect(BASE_CSS).toContain("--pf-accent-text:color-mix(in oklab,var(--pf-accent-text-dark) 45%,#fff);");
		// The picture's area is dark in both modes: its ground is too, so a fill drawn in the page colour (Paper's primary
		// button, white text on `--pf-bg`) stays readable on it.
		expect(BASE_CSS).toContain("var(--pf-hero-ground,var(--pf-bg))}");
		// Over a picture, "open to work" and trend colours take their dark-mode tones too, as text and accent do.
		expect(BASE_CSS).toContain("--pf-positive:var(--pf-positive-dark);--pf-negative:var(--pf-negative-dark);");
		for (const css of THEME_CSS.slice(1)) {
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

	it("breaks a long word anywhere in every theme, so it never pushes the page sideways", () => {
		expect(BASE_CSS).toContain(".pf{overflow-wrap:anywhere}");
		// A card's English summary on an Arabic page keeps its full stop at its end.
		expect(BASE_CSS).toContain(
			'[class$="__title"],[class$="__summary"],[class$="__desc"],[class$="__dek"]{unicode-bidi:plaintext}',
		);
	});

	it("keeps pictures still under the pointer for visitors who ask for less motion", () => {
		expect(BASE_CSS).toMatch(
			/@media \(prefers-reduced-motion:reduce\)\{[^\n]*\.pf :is\(:hover,:focus-visible\) img,[^{]*\{transform:none!important\}\}/,
		);
	});

	it("ships the shared rules without their comments, and keeps an empty form status a live region", () => {
		expect(BASE_CSS).not.toContain("/*");
		expect(BASE_CSS).not.toContain(".pf-form__status:empty{display:none}");
		expect(BASE_CSS).toContain(".pf-form__status:empty{position:absolute;");
	});

	it("keeps no rule that another one already makes, and no !important fight with the footer", () => {
		expect(KANVAS_CSS).not.toContain(".pf-video .pf-cover");
		expect(BASE_CSS).not.toMatch(/\.pf-lightbox(?:__btn)?\[hidden\]/);
		expect(PRIMA_CSS).not.toContain(".pf-nav__links a{white-space:nowrap}");
		expect(MOZAIK_CSS).not.toContain(".pf-nav__links a{white-space:nowrap}");
		expect(PRIMA_CSS).not.toContain('.pf-cvlist[data-variant="timeline"]{gap:0}');
		expect(KANVAS_CSS).not.toContain("clip:rect");
		expect(LUGAS_CSS).not.toContain(".lg-stats .pf-metric__label{order:2");
		expect(BASE_CSS).not.toMatch(/\.pf-badge\{[^}]*!important/);
		expect(BASE_CSS).toContain(".pf-foot a:not(.pf-badge){");
	});
});
