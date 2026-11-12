import type { PortfolioClient } from "@rezumi/schema/portfolio/data";
import type { Draft } from "immer";
import { getBrandIcon } from "@rezumi/resume/icons";

/**
 * A client's new name and the brand logo it shows: an uploaded logo stays; a brand logo follows the name while the
 * name names a brand, and comes back when it does again (`wanted`: the switch was on), so typing a longer name
 * ("Stripe Inc") or a typo on the way doesn't turn the switch off for good.
 */
export function renameClient(target: Draft<PortfolioClient>, name: string, wanted: boolean): void {
	target.name = name;
	if (target.logo && "key" in target.logo) return;
	const brandIcon = getBrandIcon(name);
	if (brandIcon && wanted) target.logo = { brandIcon };
	else delete target.logo;
}
