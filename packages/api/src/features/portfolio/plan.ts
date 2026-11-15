import type { Transaction } from "../billing/account";
import type { PortfolioData } from "@rezumi/schema/portfolio/data";
import { portfolioFeaturesNeeded } from "@rezumi/portfolio/edits";
import { parsePortfolioData } from "@rezumi/schema/portfolio/data";
import { lockBillingAccount } from "../billing/account";
import { getEntitlements, isBillingAppliedTo } from "../billing/entitlements";
import { planFeatureRequired, portfolioLimitReached } from "../billing/limits";
import { readStoredData } from "./file-store";

/** The parts of a portfolio a plan governs. */
type PlanPortfolio = Pick<PortfolioData, "theme" | "credit"> & {
	hero: { effect: Pick<PortfolioData["hero"]["effect"], "id"> };
	works: { items: readonly { id: string }[] };
};

/**
 * Refuses a write the plan doesn't allow, in the transaction that makes it (after the portfolio's lock, for a save).
 * Every writer goes through here, whichever client or feature called it. A work counts as added when its id is new
 * (`before` doesn't have it), so swapping works counts as adding: works already over the limit stay and can be edited
 * or removed, never replaced by new ones (`00-keputusan.md` rule #2). Adding takes the billing lock like the document
 * limits, so a plan change can't slip between the check and the write. Writes nothing, so a plan ending never moves the
 * data's version. Reads nothing more while plans don't apply to the account.
 */
export async function assertPortfolioPlan(tx: Transaction, userId: string, after: PlanPortfolio, isNew = false) {
	if (!(await isBillingAppliedTo(userId, tx))) return;
	const before = isNew ? null : parsePortfolioData(await readStoredData(tx, userId));
	const used = before?.works.items.length ?? 0;
	const kept = new Set(before?.works.items.map((work) => work.id));
	const adding = after.works.items.some((work) => !kept.has(work.id));
	if (adding) await lockBillingAccount(tx, userId);
	const entitlements = await getEntitlements(userId, new Date(), tx);
	const missing = portfolioFeaturesNeeded(before, after).find((feature) => !entitlements.features[feature]);
	if (missing) throw planFeatureRequired(missing, entitlements.planId);

	const max = entitlements.limits.portfolioWorks;
	if (adding && max !== null && after.works.items.length > max)
		throw portfolioLimitReached({ limit: "portfolioWorks", max, used, planId: entitlements.planId });
}
