import type { PortfolioEditPlan, PortfolioPlanFeature } from "./types";
import type { PortfolioData } from "@rezumi/schema/portfolio/data";
import type { PortfolioHeroEffect } from "@rezumi/schema/portfolio/themes";
import { FREE_PORTFOLIO_HERO_EFFECTS, FREE_PORTFOLIO_THEMES, isFreePortfolioHeroEffect } from "@rezumi/schema/billing";
import { isFreePortfolioTheme, PORTFOLIO_THEME_INFO } from "@rezumi/schema/portfolio/themes";

/** The parts of a portfolio a plan governs. */
export type PortfolioPlanParts = Pick<PortfolioData, "theme" | "credit"> & {
	hero: { effect: { id?: PortfolioHeroEffect | undefined } };
};

/**
 * The features a change to the portfolio needs: a premium theme or intro effect chosen anew, or the badge newly hidden.
 * Keeping what's stored, removing it, and moving to something free need nothing, so a portfolio keeps working after
 * its plan ends (`00-keputusan.md` rule #2). `before` is null for a new portfolio. The API's save check
 * (`assertPortfolioPlan`) and the edit engine both use it.
 */
export function portfolioFeaturesNeeded(
	before: PortfolioPlanParts | null,
	after: PortfolioPlanParts,
): PortfolioPlanFeature[] {
	const needed: PortfolioPlanFeature[] = [];
	if (!isFreePortfolioTheme(after.theme) && after.theme !== before?.theme) needed.push("premiumPortfolioThemes");
	const effect = after.hero.effect.id;
	if (effect && !isFreePortfolioHeroEffect(effect) && effect !== before?.hero.effect.id)
		needed.push("premiumHeroEffects");
	if (!after.credit.show && (before?.credit.show ?? true)) needed.push("hidePortfolioCredit");
	return needed;
}

const SUGGEST = "Don't apply it: tell the user it needs Plus and suggest it instead.";

/** Why the plan refuses a feature, for a model: what needs Plus, the plan's name, and to suggest rather than apply. */
export function planFeatureMessage(
	feature: PortfolioPlanFeature,
	after: PortfolioPlanParts,
	plan: NonNullable<PortfolioEditPlan>,
) {
	const on = `the ${plan.name} plan doesn't include it`;
	switch (feature) {
		case "premiumPortfolioThemes": {
			const free = FREE_PORTFOLIO_THEMES.map((id) => PORTFOLIO_THEME_INFO[id].name).join(" or ");
			return `The ${PORTFOLIO_THEME_INFO[after.theme].name} theme needs Plus and ${on}. ${SUGGEST} The free themes are ${free}.`;
		}
		case "premiumHeroEffects":
			return `The "${after.hero.effect.id ?? ""}" intro effect needs Plus and ${on}. ${SUGGEST} Free effects: ${FREE_PORTFOLIO_HERO_EFFECTS.join(", ")}.`;
		case "hidePortfolioCredit":
			return `Hiding the "Made with Rezumi" badge needs Plus and ${on}. ${SUGGEST}`;
	}
}

/** Why the plan refuses another work: `used` is how many the portfolio had before this one. */
export function planWorksMessage(plan: NonNullable<PortfolioEditPlan>, max: number, used: number) {
	return `The ${plan.name} plan allows ${max} works and the portfolio has ${used}. Don't add more: tell the user, and suggest removing a work, or Plus for more works.`;
}
