import type { TemplateSemanticManifest } from "../../semantic/template-manifest";
import type { CustomSectionType } from "@rezumi/schema/resume/data";
import { baseManifest, itemHeaderRowPart } from "../../semantic/shared-parts";

/**
 * The sections whose entries are steps on the trail: dated entries. The summary, skills and other undated sections in
 * the main column read as plain text beside it, without a dot.
 */
const TRAIL_SECTION_TYPES = [
	"experience",
	"education",
	"volunteer",
	"projects",
	"awards",
	"certifications",
	"publications",
] as const satisfies readonly CustomSectionType[];

export const jejakSemanticManifest = baseManifest("jejak", [
	itemHeaderRowPart,
	{
		name: "timeline-line",
		key: "timeline-line",
		// A single step has nothing to join: the line shows from two entries.
		owner: {
			kind: "section-items",
			key: "section-items",
			placement: "main",
			columns: 1,
			sectionTypes: TRAIL_SECTION_TYPES,
			minItems: 2,
		},
		binding: { type: "primitive", primitive: "View", source: "existing" },
		route: { parent: "owner", at: "start" },
	},
	{
		name: "timeline-marker",
		key: "timeline-marker",
		owner: { kind: "item", key: "item", placement: "main", columns: 1, sectionTypes: TRAIL_SECTION_TYPES },
		binding: { type: "primitive", primitive: "View", source: "existing" },
		route: { parent: "owner", at: "start" },
	},
	{
		name: "timeline-dot",
		key: "timeline-dot",
		owner: { kind: "item", key: "item", placement: "main", columns: 1, sectionTypes: TRAIL_SECTION_TYPES },
		binding: { type: "primitive", primitive: "View", source: "existing" },
		route: { parent: "timeline-marker", at: "start" },
	},
	{
		name: "timeline-content",
		key: "timeline-content",
		owner: { kind: "item", key: "item", placement: "main", columns: 1 },
		binding: { type: "primitive", primitive: "View", source: "existing" },
		route: { parent: "owner", at: "end", take: "all" },
	},
]) satisfies TemplateSemanticManifest;
