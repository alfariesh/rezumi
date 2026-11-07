import { describe, expect, it } from "vite-plus/test";
import { parseWritablePortfolioData } from "@rezumi/schema/portfolio/data";
import { PORTFOLIO_ACCENTS, PORTFOLIO_THEMES } from "@rezumi/schema/portfolio/themes";
import { contrastRatio, mixColors } from "@rezumi/utils/contrast";
import { ACCENT_SOFT_AMOUNT, TREND_TINT_AMOUNT } from "./design";
import { testResume } from "./fixtures.test-helpers";
import { portfolioMessages, portfolioViewMessages } from "./messages";
import { renderPortfolioPage } from "./page";
import { BASE_CSS } from "./shared/base-css";
import { KANVAS_CSS } from "./themes/kanvas/css";
import { MOZAIK_CSS } from "./themes/mozaik/css";
import { THEME_PALETTES } from "./themes/palettes";
import { buildPortfolioView } from "./view";

/**
 * Phase 06 step 6, widened by the hardening review: the colour tokens every theme draws stay readable with extreme
 * accents (a very light yellow, a near-black, white, bright greens and cyans) and the curated ones, in light and dark,
 * on everything they're drawn on: the page, cards (`--pf-surface`), the accent's soft tint, and a trend chip's tint
 * of its own colour.
 */
const ACCENTS = [
	...Object.values(PORTFOLIO_ACCENTS).map((accent) => accent.color),
	"#FFD60A",
	"#111111",
	"#FFFFFF",
	"#22C55E",
	"#06B6D4",
	"#F472B6",
];

const MODES = [
	["light", ":root"],
	["dark", ':root[data-pf-scheme="dark"]'],
] as const;

function tokens(css: string, selector: string): Record<string, string> {
	const block = css.split("\n").find((line) => line.startsWith(`${selector}{`)) ?? "";
	return Object.fromEntries(
		[...block.matchAll(/(--pf-[\w-]+):(#[\da-fA-F]{6})/g)].map((match) => [match[1], match[2]]),
	);
}

function pageCss(theme: (typeof PORTFOLIO_THEMES)[number], accent: string): string {
	const data = parseWritablePortfolioData({ theme, design: { accent: { source: "custom", color: accent } } });
	const messages = portfolioMessages("en-US");
	const view = buildPortfolioView({
		portfolio: { data },
		resume: { data: testResume() },
		owner: { name: "Nadia", username: "nadia" },
		entitlements: { hidePortfolioCredit: false },
		messages: portfolioViewMessages(messages),
		fileUrl: (key) => key,
	});
	return renderPortfolioPage({ view, messages, year: 2026, creditUrl: "#" }).css;
}

describe("accent contrast", () => {
	for (const theme of PORTFOLIO_THEMES)
		for (const accent of ACCENTS)
			it(`${theme} with ${accent}`, () => {
				const css = pageCss(theme, accent);
				for (const [mode, selector] of MODES) {
					const set = tokens(css, selector);
					const neutrals = THEME_PALETTES[theme][mode];
					const ratio = (token: string, background: string) => contrastRatio(set[token] ?? "", background);
					// Text in the accent: links, accent labels and numbers, on the page and on cards.
					expect(ratio("--pf-accent-text", neutrals.bg), `${mode} accent text on bg`).toBeGreaterThanOrEqual(4.5);
					expect(ratio("--pf-accent-text", neutrals.surface), `${mode} accent text on surface`).toBeGreaterThanOrEqual(
						4.5,
					);
					// The soft tint is the accent over the page; accent text on it has its own tone.
					const soft = set["--pf-accent-soft"] ?? "";
					expect(soft, `${mode} soft tint`).toBe(mixColors(accent, neutrals.bg, ACCENT_SOFT_AMOUNT));
					for (const background of [soft, neutrals.bg, neutrals.surface])
						expect(ratio("--pf-accent-text-soft", background), `${mode} soft accent text`).toBeGreaterThanOrEqual(4.5);
					// Text on an accent fill (primary buttons, Mozaik's first number tile).
					expect(contrastRatio(set["--pf-on-accent"] ?? "", accent), `${mode} on accent`).toBeGreaterThanOrEqual(4.5);
					// A primary button's edge stands out from the page (non-text contrast, 3:1).
					expect(ratio("--pf-accent-edge", neutrals.bg), `${mode} button edge`).toBeGreaterThanOrEqual(3);
					// Trend chips: the colour on the page, on cards, and on the chip's tint of itself over either.
					for (const trend of ["--pf-positive", "--pf-negative"]) {
						const colour = set[trend] ?? "";
						for (const base of [neutrals.bg, neutrals.surface]) {
							expect(contrastRatio(colour, base), `${mode} ${trend}`).toBeGreaterThanOrEqual(4.5);
							expect(
								contrastRatio(colour, mixColors(colour, base, TREND_TINT_AMOUNT)),
								`${mode} ${trend} on its chip`,
							).toBeGreaterThanOrEqual(4.5);
						}
					}
				}
			});

	it("keeps muted text readable on the neutral trend chip and on the soft tint, in every theme", () => {
		for (const theme of PORTFOLIO_THEMES)
			for (const [mode] of MODES) {
				const neutrals = THEME_PALETTES[theme][mode];
				for (const base of [neutrals.bg, neutrals.surface])
					expect(
						contrastRatio(neutrals.muted, mixColors(neutrals.muted, base, 0.12)),
						`${theme} ${mode}`,
					).toBeGreaterThanOrEqual(4.5);
				for (const accent of ACCENTS)
					expect(
						contrastRatio(neutrals.muted, mixColors(accent, neutrals.bg, ACCENT_SOFT_AMOUNT)),
						`${theme} ${mode} ${accent}`,
					).toBeGreaterThanOrEqual(4.5);
			}
	});

	it("draws accent text on the soft tint in its own tone, and chips with the tint their colours were checked on", () => {
		const percent = `${Math.round(TREND_TINT_AMOUNT * 100)}%`;
		expect(BASE_CSS).toContain(
			`.pf-trend[data-good="true"]{color:var(--pf-positive);background:color-mix(in oklab,var(--pf-positive) ${percent},transparent)}`,
		);
		expect(BASE_CSS).toContain(
			`.pf-trend[data-good="false"]{color:var(--pf-negative);background:color-mix(in oklab,var(--pf-negative) ${percent},transparent)}`,
		);
		expect(BASE_CSS).toContain(".pf-trend{");
		expect(BASE_CSS).toMatch(
			/\.pf-trend\{[^}]*color:var\(--pf-muted\);background:color-mix\(in oklab,var\(--pf-muted\) 12%/,
		);
		expect(BASE_CSS).toContain(".pf-work-metric b{color:var(--pf-accent-text-soft);");
		expect(BASE_CSS).toMatch(/\.pf-avatar\{[^}]*background:var\(--pf-accent-soft\);color:var\(--pf-accent-text-soft\)/);
		expect(BASE_CSS).toContain('[data-bg="soft-gradient"]{--pf-accent-text:var(--pf-accent-text-soft)}');
		expect(MOZAIK_CSS).toMatch(/\.mz-more span\{[^}]*color:var\(--pf-accent-text-soft\)/);
		expect(MOZAIK_CSS).toContain(".mz-contact__main[data-note] .mz-title{color:var(--pf-accent-text-soft);");
		expect(KANVAS_CSS).toContain(".kv-tile[data-noimg] .kv-cap .pf-work-metric b{color:var(--pf-accent-text-soft)}");
	});
});
