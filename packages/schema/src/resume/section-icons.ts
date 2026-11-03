import type { IconName } from "../icons";
import type { CustomSectionType } from "./data";

/** The icon each section type shows before its title when section icons are on (Hugeicons names). */
export const defaultSectionIconNames = {
	summary: "newspaper",
	profiles: "link-01",
	experience: "briefcase-01",
	education: "mortarboard-01",
	projects: "source-code",
	skills: "drafting-compass",
	languages: "translate",
	interests: "football",
	awards: "trophy",
	certifications: "certificate-01",
	publications: "library",
	volunteer: "hand-heart",
	references: "call-02",
	"cover-letter": "mail-02",
} as const satisfies Record<CustomSectionType, IconName>;

export const getDefaultSectionIconName = (sectionType: CustomSectionType): string =>
	defaultSectionIconNames[sectionType];
