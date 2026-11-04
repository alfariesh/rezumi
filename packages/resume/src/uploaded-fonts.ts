import type { CustomFontFace, Typography } from "@rezumi/schema/resume/data";
import { defaultResumeData } from "@rezumi/schema/resume/default";

/** Adds an uploaded face to a document's typography, replacing one with the same family, weight and style. */
export function addUploadedFontFace(typography: Typography, face: CustomFontFace) {
	const faces = (typography.customFonts ?? []).filter(
		(item) => !(item.family === face.family && item.weight === face.weight && item.italic === face.italic),
	);
	typography.customFonts = [...faces, face];
}

/** Removes an uploaded family's faces; body or heading text set in it moves back to the default font. */
export function removeUploadedFontFamily(typography: Typography, family: string) {
	typography.customFonts = (typography.customFonts ?? []).filter((face) => face.family !== family);
	for (const prefix of ["body", "heading"] as const) {
		if (typography[prefix].fontFamily !== family) continue;
		const fallback = defaultResumeData.metadata.typography[prefix];
		typography[prefix].fontFamily = fallback.fontFamily;
		typography[prefix].fontWeights = [...fallback.fontWeights];
	}
}
