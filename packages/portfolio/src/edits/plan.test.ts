import { describe, expect, it } from "vite-plus/test";
import { portfolioFeaturesNeeded } from "./plan";

type Portfolio = Parameters<typeof portfolioFeaturesNeeded>[1];

const page = (
	overrides: { theme?: Portfolio["theme"]; effect?: Portfolio["hero"]["effect"]["id"]; show?: boolean } = {},
) =>
	({
		theme: overrides.theme ?? "lugas",
		hero: { effect: overrides.effect ? { id: overrides.effect } : {} },
		credit: { show: overrides.show ?? true },
	}) satisfies Portfolio;

// Moved from `packages/api/src/features/portfolio/plan.test.ts` with the function (Phase 14): the API's save check and
// the edit engine share it.
describe("portfolioFeaturesNeeded", () => {
	it("needs nothing for a free page", () => {
		expect(portfolioFeaturesNeeded(null, page())).toEqual([]);
		expect(portfolioFeaturesNeeded(page(), page({ theme: "prima", effect: "shimmer" }))).toEqual([]);
	});

	it("needs the plan to choose a premium theme, also on a new portfolio", () => {
		expect(portfolioFeaturesNeeded(null, page({ theme: "kanvas" }))).toEqual(["premiumPortfolioThemes"]);
		expect(portfolioFeaturesNeeded(page(), page({ theme: "brutal" }))).toEqual(["premiumPortfolioThemes"]);
		expect(portfolioFeaturesNeeded(page({ theme: "kanvas" }), page({ theme: "mozaik" }))).toEqual([
			"premiumPortfolioThemes",
		]);
	});

	it("keeps what's already stored, so a portfolio survives its plan ending", () => {
		const stored = page({ theme: "kanvas", effect: "gradient", show: false });
		expect(portfolioFeaturesNeeded(stored, stored)).toEqual([]);
		expect(portfolioFeaturesNeeded(stored, page({ theme: "lugas", effect: "gradient", show: true }))).toEqual([]);
	});

	it("needs the plan for a premium effect chosen anew, and not for a free one", () => {
		expect(portfolioFeaturesNeeded(page(), page({ effect: "typewriter" }))).toEqual(["premiumHeroEffects"]);
		expect(portfolioFeaturesNeeded(page({ effect: "typewriter" }), page({ effect: "scramble" }))).toEqual([
			"premiumHeroEffects",
		]);
		expect(portfolioFeaturesNeeded(page({ effect: "typewriter" }), page({ effect: "fade-up" }))).toEqual([]);
	});

	it("needs the plan to hide the badge, only when it newly goes", () => {
		expect(portfolioFeaturesNeeded(page(), page({ show: false }))).toEqual(["hidePortfolioCredit"]);
		expect(portfolioFeaturesNeeded(page({ show: false }), page({ show: false }))).toEqual([]);
	});
});
