import type { ResumeData } from "@rezumi/schema/resume/data";
import type { Template } from "@rezumi/schema/templates";
import { templatePresets } from "@rezumi/schema/templates";

/** Gives a resume the look its template was designed with (see `templatePresets`), for gallery samples. */
export function applyTemplatePreset(data: ResumeData, template: Template) {
	const preset = templatePresets[template];
	if (!preset) return;
	const { typography, design } = data.metadata;
	typography.heading = { ...typography.heading, ...preset.heading, fontWeights: [preset.heading.fontWeight] };
	typography.body = { ...typography.body, ...preset.body, fontWeights: ["400", "600"] };
	design.colors.primary = preset.primary;
	if (preset.entry) design.entry = { lead: "organization", accent: "none", ...design.entry, ...preset.entry };
	if (preset.keywordLayout) data.sections.skills.keywordLayout = preset.keywordLayout;
	data.picture.aspectRatio = preset.picture.aspectRatio;
	data.picture.borderRadius = Math.round(preset.picture.radius * data.picture.size);
}
