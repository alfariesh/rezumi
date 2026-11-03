import type { IconRole } from "../../icon-visibility";
import type { ResumeData } from "@rezumi/schema/resume/data";
import { getBrandIcon, getNetworkIcon } from "@rezumi/resume/icons";
import { showsIcons } from "../../icon-visibility";

type IconItem = { readonly [field: string]: unknown };

/**
 * The icon an item draws before its title, and the switch that shows it: the author's own pick, else a profile's
 * network logo, else (with tool logos on) the logo of the tool a skill names.
 */
export function itemIcon(
	type: string,
	item: IconItem,
	metadata: Pick<ResumeData["metadata"], "design">,
): { name: string; role: IconRole } {
	if (typeof item.icon === "string" && item.icon) return { name: item.icon, role: "item" };
	if (type === "profiles" && typeof item.network === "string")
		return { name: getNetworkIcon(item.network), role: "item" };
	if (type === "skills" && typeof item.name === "string" && showsIcons(metadata, "logo"))
		return { name: getBrandIcon(item.name), role: "logo" };
	return { name: "", role: "item" };
}
