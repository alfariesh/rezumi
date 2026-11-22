import type { ResumeData } from "@rezumi/schema/resume/data";
import { nativeEngine } from "@rezumi/forme-native";
import { renderResumePdf } from "@rezumi/pdf/native";
import {
	applyDensity,
	applyMargins,
	applyTextSize,
	matchDensity,
	matchMargins,
	nextFitStep,
} from "@rezumi/resume/design-presets";
import { configurePreviewResources, readPreviewImage } from "./resources";

/** One step of Fit to one page (density, then margins, then half-point text steps down to 9 pt); false when done. */
export function tightenResume(data: ResumeData): boolean {
	const metadata = data.metadata;
	const step = nextFitStep({
		density: matchDensity(metadata),
		margins: matchMargins(metadata),
		size: metadata.typography.body.fontSize,
	});
	if (!step) return false;
	if ("density" in step) applyDensity(metadata, step.density);
	else if ("margins" in step) applyMargins(metadata, step.margins);
	else applyTextSize(metadata, step.size);
	return true;
}

/** Measure a private candidate. Caller applies once through DraftStore.update, giving Fit one undo step. */
export async function fitResume(data: ResumeData, isCurrent: () => boolean) {
	configurePreviewResources();
	const candidate = structuredClone(data);
	const authored = Math.max(1, data.metadata.layout.pages.length);
	for (let step = 0; step < 16 && isCurrent() && tightenResume(candidate); step++) {
		let count = 0;
		await renderResumePdf(nativeEngine, {
			data: candidate,
			readImage: readPreviewImage,
			onPageMap: (map) => {
				count = map.pages.length;
			},
		});
		if (count <= authored) return { data: candidate, fits: true };
	}
	return { data: candidate, fits: false };
}
