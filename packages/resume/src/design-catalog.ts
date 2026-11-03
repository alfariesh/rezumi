import { FREE_TEMPLATES } from "@rezumi/schema/billing";
import { iconCategories } from "@rezumi/schema/icons";
import { defaultIconDesign, iconStyleSchema } from "@rezumi/schema/resume/data";
import { defaultSectionIconNames } from "@rezumi/schema/resume/section-icons";
import {
	legacyTemplateSuccessors,
	templateLayouts,
	templateLineup,
	templatePresets,
	templateSummaries,
} from "@rezumi/schema/templates";
import { BRAND_ICONS } from "./icons";

/**
 * What an AI agent needs to design a resume without guessing: the templates on offer, the icon set and its settings,
 * and how logos appear. Published as the `resume://_meta/design` MCP resource.
 */
export function createDesignCatalog() {
	const free = new Set<string>(FREE_TEMPLATES);
	return {
		templates: {
			path: "/metadata/template",
			default: "meridian",
			lineup: templateLineup.map((id) => ({
				id,
				summary: templateSummaries[id],
				...templateLayouts[id],
				plan: free.has(id) ? "free" : "paid",
				preset: templatePresets[id],
			})),
			formerTemplates: {
				note: "Former template IDs are still accepted and are saved as their successor.",
				successors: legacyTemplateSuccessors,
			},
			notes: [
				"Switching templates keeps the resume's fonts and colours; `preset` is the look a template was designed with, which a user may ask for.",
				"Paid templates need a paid plan for new choices; a resume that already uses one keeps it.",
			],
		},
		icons: {
			path: "/metadata/design/icons",
			defaults: defaultIconDesign,
			styles: iconStyleSchema.options,
			notes: [
				"`enabled: false` hides every icon; `contact`, `sections` and `items` switch groups of icons; `style` draws all of them.",
				"Icon fields (`icon` on sections, items, custom fields and the level design) take a name from `names`, or '' for none. Section icons also take 'none' to hide that section's default.",
				"Unknown names draw nothing and are cleared on save; former Phosphor names are converted to their closest match.",
				"Icons never replace text: applicant tracking systems read only the text.",
			],
			sectionDefaults: defaultSectionIconNames,
			names: iconCategories,
		},
		logos: {
			profiles:
				"A profile without its own icon gets its network's logo (GitHub, LinkedIn, X, Behance, Dribbble, Medium, …) when `items` is on.",
			tools: {
				setting: "/metadata/design/icons/logos",
				note: "With `logos` on, a skill whose name or keyword names a known tool shows that tool's logo beside the text. Matching ignores case, spaces, dots and dashes.",
				matches: BRAND_ICONS,
			},
		},
	};
}
