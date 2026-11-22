// A template's sample files on the server. Kept apart from `design-presets` (which pulls in the resume schemas) so
// the marketing homepage and other light pages can show samples without loading the schemas.
import type { Template } from "@rezumi/schema/templates";

/**
 * A template's sample PDF and its previews, as server paths (`pnpm --filter @rezumi/tooling templates:previews`). Each
 * sample has an English and an Indonesian version: Indonesian shows the Indonesian one, every other language English.
 */
export const templateSample = (id: Template, locale: string) => {
	const folder = locale.split("-")[0] === "id" ? "id/" : "";
	return {
		pdf: `/templates/pdf/${folder}${id}.pdf`,
		/** 600×848 JPEG: builder and letter cards. */
		image: `/templates/jpg/${folder}${id}.jpg`,
		/** 596×843 and 300×424 WebP: the gallery and the homepage. */
		thumbnail: `/templates/thumb/${folder}${id}.webp`,
		smallThumbnail: `/templates/thumb/${folder}${id}-small.webp`,
	};
};
