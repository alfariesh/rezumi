import type { ResumeData } from "@rezumi/schema/resume/data";
import type { Template } from "@rezumi/schema/templates";
import { defaultEntryHeader, entryHeaderOf } from "@rezumi/schema/resume/data";
import { templatePresets } from "@rezumi/schema/templates";

type PresetTarget = {
	metadata: Pick<ResumeData["metadata"], "typography" | "design">;
	sections: { skills: Pick<ResumeData["sections"]["skills"], "keywordLayout"> };
	picture: Pick<ResumeData["picture"], "aspectRatio" | "borderRadius" | "size">;
};

/** The values a template's preset sets, worked out for this resume (the picture's corners follow its size). */
function presetLook(data: PresetTarget, template: Template) {
	const preset = templatePresets[template];
	return {
		heading: {
			fontFamily: preset.heading.fontFamily,
			fontWeights: [preset.heading.fontWeight],
			fontSize: preset.heading.fontSize,
		},
		body: {
			fontFamily: preset.body.fontFamily,
			fontWeights: ["400", "600"],
			fontSize: preset.body.fontSize,
			lineHeight: preset.body.lineHeight,
		},
		primary: preset.primary,
		// A preset without an entry layout or keyword layout was designed with the defaults.
		entryLayout: preset.entry?.layout ?? defaultEntryHeader.layout,
		keywordLayout: preset.keywordLayout ?? "inline",
		aspectRatio: preset.picture.aspectRatio,
		borderRadius: Math.round(preset.picture.radius * data.picture.size),
	} as const;
}

/**
 * Gives a resume the look its template was designed with (`templatePresets`): heading and body fonts and sizes, the
 * accent colour, the entry layout, how skill keywords print and the picture's shape. Content, text and background
 * colours, margins, icons and section placement stay. Mutates `data`, an Immer draft in the apps.
 */
export function applyTemplatePreset(data: PresetTarget, template: Template): void {
	const look = presetLook(data, template);
	const { typography, design } = data.metadata;
	typography.heading = { ...typography.heading, ...look.heading, fontWeights: [...look.heading.fontWeights] };
	typography.body = { ...typography.body, ...look.body, fontWeights: [...look.body.fontWeights] };
	design.colors.primary = look.primary;
	design.entry = { ...entryHeaderOf(design), layout: look.entryLayout };
	data.sections.skills.keywordLayout = look.keywordLayout;
	data.picture.aspectRatio = look.aspectRatio;
	data.picture.borderRadius = look.borderRadius;
}

/** Whether the resume already has every value its template's preset would set, so applying it changes nothing. */
export function hasTemplatePreset(data: PresetTarget, template: Template): boolean {
	const look = presetLook(data, template);
	const { heading, body } = data.metadata.typography;
	const sameWeights = (weights: readonly string[], expected: readonly string[]) =>
		weights.length === expected.length && weights.every((weight, index) => weight === expected[index]);
	return (
		heading.fontFamily === look.heading.fontFamily &&
		heading.fontSize === look.heading.fontSize &&
		sameWeights(heading.fontWeights, look.heading.fontWeights) &&
		body.fontFamily === look.body.fontFamily &&
		body.fontSize === look.body.fontSize &&
		body.lineHeight === look.body.lineHeight &&
		sameWeights(body.fontWeights, look.body.fontWeights) &&
		data.metadata.design.colors.primary === look.primary &&
		entryHeaderOf(data.metadata.design).layout === look.entryLayout &&
		data.sections.skills.keywordLayout === look.keywordLayout &&
		data.picture.aspectRatio === look.aspectRatio &&
		data.picture.borderRadius === look.borderRadius
	);
}
