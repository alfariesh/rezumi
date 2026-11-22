// The pipeline picture's colors and sharing: stage colors as values (global.css → --color-stage-*), since SVG takes
// colors rather than class names, and the PNG written to the cache for the share sheet.
import type { ApplicationStatus } from "@rezumi/schema/applications/data";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { useResolveClassNames } from "@/ui";

const colorOf = (style: object) => ("backgroundColor" in style ? String(style.backgroundColor) : "");

/** The stage colors as values, for the picture (global.css → --color-stage-*). */
export function useStageColors(): Record<ApplicationStatus, string> {
	const saved = colorOf(useResolveClassNames("bg-stage-saved"));
	const applied = colorOf(useResolveClassNames("bg-stage-applied"));
	const screening = colorOf(useResolveClassNames("bg-stage-screening"));
	const interview = colorOf(useResolveClassNames("bg-stage-interview"));
	const offer = colorOf(useResolveClassNames("bg-stage-offer"));
	const closed = colorOf(useResolveClassNames("bg-stage-closed"));
	return { saved, applied, screening, interview, offer, closed };
}

/** Recipients can read the file once shareAsync resolves; the previous picture is swept on the next share. */
export async function sharePng(base64: string) {
	for (const entry of Paths.cache.list()) {
		if (entry instanceof File && /^pipeline-flow-\d+\.png$/.test(entry.name)) entry.delete();
	}
	if (!(await Sharing.isAvailableAsync())) throw new Error("Sharing unavailable");
	const file = new File(Paths.cache, `pipeline-flow-${Date.now()}.png`);
	file.write(base64, { encoding: "base64" });
	await Sharing.shareAsync(file.uri, { mimeType: "image/png", UTI: "public.png" });
}
