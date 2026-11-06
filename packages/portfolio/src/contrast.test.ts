import { describe, expect, it } from "vite-plus/test";
import { parseWritablePortfolioData } from "@rezumi/schema/portfolio/data";
import { PORTFOLIO_ACCENTS, PORTFOLIO_THEMES } from "@rezumi/schema/portfolio/themes";
import { contrastRatio } from "@rezumi/utils/contrast";
import { testResume } from "./fixtures.test-helpers";
import { portfolioMessages, portfolioViewMessages } from "./messages";
import { renderPortfolioPage } from "./page";
import { THEME_PALETTES } from "./themes/palettes";
import { buildPortfolioView } from "./view";

/**
 * Phase 06 step 6: the accent tokens every theme draws stay readable with extreme accents (a very light yellow, a
 * near-black, white) and the curated ones, in light and dark, on the page background and on cards (`--pf-surface`).
 */
const ACCENTS = [...Object.values(PORTFOLIO_ACCENTS).map((accent) => accent.color), "#FFD60A", "#111111", "#FFFFFF"];

function tokens(css: string, selector: string): Record<string, string> {
	const block = css.split("\n").find((line) => line.startsWith(`${selector}{`)) ?? "";
	return Object.fromEntries(
		[...block.matchAll(/(--pf-[\w-]+):(#[\da-fA-F]{6})/g)].map((match) => [match[1], match[2]]),
	);
}

describe("accent contrast", () => {
	for (const theme of PORTFOLIO_THEMES)
		for (const accent of ACCENTS)
			it(`${theme} with ${accent}`, () => {
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
				const { css } = renderPortfolioPage({ view, messages, year: 2026, creditUrl: "#" });
				const palette = THEME_PALETTES[theme];
				expect(palette).toBeDefined();
				for (const [mode, selector] of [
					["light", ":root"],
					["dark", ':root[data-pf-scheme="dark"]'],
				] as const) {
					const set = tokens(css, selector);
					const neutrals = palette?.[mode];
					if (!neutrals) continue;
					const accentText = set["--pf-accent-text"] ?? "";
					// Text in the accent: links, accent labels and numbers, on the page and on cards.
					expect(contrastRatio(accentText, neutrals.bg), `${mode} accent text on bg`).toBeGreaterThanOrEqual(4.5);
					expect(contrastRatio(accentText, neutrals.surface), `${mode} accent text on surface`).toBeGreaterThanOrEqual(
						4.5,
					);
					// Text on an accent fill (primary buttons, Mozaik's first number tile).
					expect(contrastRatio(set["--pf-on-accent"] ?? "", accent), `${mode} on accent`).toBeGreaterThanOrEqual(4.5);
					// A primary button's edge stands out from the page (non-text contrast, 3:1).
					expect(
						contrastRatio(set["--pf-accent-edge"] ?? "", neutrals.bg),
						`${mode} button edge`,
					).toBeGreaterThanOrEqual(3);
					// Trend chips.
					for (const trend of ["--pf-positive", "--pf-negative"])
						expect(contrastRatio(set[trend] ?? "", neutrals.bg), `${mode} ${trend}`).toBeGreaterThanOrEqual(4.5);
				}
			});
});
