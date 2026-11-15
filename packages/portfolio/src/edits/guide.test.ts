import type { PortfolioEdit } from "@rezumi/schema/portfolio/edits";
import { describe, expect, it } from "vite-plus/test";
import { PORTFOLIO_BUTTON_KINDS, parseWritablePortfolioData } from "@rezumi/schema/portfolio/data";
import { portfolioEditSchema } from "@rezumi/schema/portfolio/edits";
import { METRIC_FORMATS } from "@rezumi/schema/portfolio/metric";
import { PORTFOLIO_ACCENT_IDS, PORTFOLIO_HERO_EFFECTS, PORTFOLIO_THEMES } from "@rezumi/schema/portfolio/themes";
import { fullPortfolioData } from "../fixtures.test-helpers";
import { applyPortfolioEdits } from "./apply";
import { PORTFOLIO_EDIT_GUIDE } from "./guide";

const examples = [...PORTFOLIO_EDIT_GUIDE.matchAll(/```json\n(.+)\n```/g)].map(
	(match) => JSON.parse(match[1] as string) as unknown[],
);

describe("PORTFOLIO_EDIT_GUIDE", () => {
	it("names every value the schema takes", () => {
		for (const value of [
			...PORTFOLIO_THEMES,
			...PORTFOLIO_ACCENT_IDS,
			...PORTFOLIO_HERO_EFFECTS,
			...PORTFOLIO_BUTTON_KINDS,
			...METRIC_FORMATS,
		])
			expect(PORTFOLIO_EDIT_GUIDE, value).toContain(`\`${value}\``);
		for (const type of ["text", "images", "metrics", "video", "embed", "link"])
			expect(PORTFOLIO_EDIT_GUIDE).toContain(`\`${type}\``);
	});

	it("stays short enough for a prompt", () => {
		// About four characters a token: well under 4,000 tokens.
		expect(PORTFOLIO_EDIT_GUIDE.length).toBeLessThan(15_000);
	});

	it("has worked examples that apply as written", () => {
		expect(examples.length).toBeGreaterThanOrEqual(6);
		const images = ["k3", "k4"].map((name) => ({
			key: `uploads/u1/pictures/portfolio/${name}.webp`,
			width: 1600,
			height: 1200,
			alt: "",
		}));
		for (const edits of examples) {
			for (const edit of edits) expect(portfolioEditSchema.safeParse(edit).success, JSON.stringify(edit)).toBe(true);
			const result = applyPortfolioEdits(parseWritablePortfolioData(fullPortfolioData), edits as PortfolioEdit[], {
				mode: "strict",
				images,
			});
			expect(result.failed, JSON.stringify(edits)).toEqual([]);
		}
	});
});
