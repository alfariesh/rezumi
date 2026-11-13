import type { ProfileData } from "@rezumi/schema/profile/data";
import type { ResumeData } from "@rezumi/schema/resume/data";
import type { Template } from "@rezumi/schema/templates";
import type { Locale } from "@rezumi/utils/locale";
import { resumeDataFromProfile } from "@rezumi/resume/profile";
import { applyTemplatePreset } from "@rezumi/resume/template-preset";
import { defaultResumeData } from "@rezumi/schema/resume/default";
import { sampleResumeData } from "@rezumi/schema/resume/sample";
import { EMPTY_SEMANTIC_CSS_SOURCE } from "@rezumi/schema/resume/stylesheet";

type CreateResumeDataOptions = {
	/** The example resume, for trying templates out. */
	withSampleData?: boolean;
	/**
	 * The account's Profile, which a resume starts from: its details and every item, on the default design. Parts left
	 * as they are stay linked to it (`@rezumi/resume/profile`). The example resume takes only the person's name.
	 */
	profile: ProfileData;
	locale?: Locale;
	/** The template to start with, in its own look (`applyTemplatePreset`); the default design's otherwise. */
	template?: Template | undefined;
};

export function createResumeData(options: CreateResumeDataOptions): ResumeData {
	const { profile } = options;
	const data = options.withSampleData
		? structuredClone(sampleResumeData)
		: resumeDataFromProfile(profile, defaultResumeData);
	if (options.withSampleData && profile.basics.name.trim()) data.basics.name = profile.basics.name;

	if (options.template) {
		data.metadata.template = options.template;
		applyTemplatePreset(data, options.template);
	}

	// The resume writes its entries' date text in this language when it's saved.
	if (options.locale) data.metadata.page.locale = options.locale;
	data.metadata.stylesheet = {
		mode: "semantic",
		source: { languageVersion: 1, text: EMPTY_SEMANTIC_CSS_SOURCE },
	};

	return data;
}
