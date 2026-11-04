import type { ResumeData } from "@rezumi/schema/resume/data";
import { iconDesignOf } from "@rezumi/schema/resume/data";

/** What an icon on the resume stands for, which decides the switch that shows it. */
export type IconRole = "contact" | "item" | "section" | "level" | "logo";

/**
 * Whether the resume's icon settings show icons of `role`. Level icons belong to the level design the author picked,
 * so they always show.
 */
export function showsIcons(metadata: Pick<ResumeData["metadata"], "design">, role: IconRole): boolean {
	if (role === "level") return true;
	const icons = iconDesignOf(metadata.design);
	if (!icons.enabled) return false;
	if (role === "contact") return icons.contact;
	if (role === "section") return icons.sections;
	if (role === "logo") return icons.logos;
	return icons.items;
}
