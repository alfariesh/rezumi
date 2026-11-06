import { describe, expect, it } from "vite-plus/test";
import { getWebFont } from "@rezumi/fonts";
import { PORTFOLIO_FONT_PAIRS, PORTFOLIO_MONO_FONT } from "@rezumi/schema/portfolio/themes";

describe("portfolio font pairs", () => {
	it("only pair fonts the page can load on the web", () => {
		for (const pair of Object.values(PORTFOLIO_FONT_PAIRS)) {
			expect(getWebFont(pair.heading), pair.heading).toBeDefined();
			expect(getWebFont(pair.body), pair.body).toBeDefined();
		}
		expect(getWebFont(PORTFOLIO_MONO_FONT)).toBeDefined();
	});
});
