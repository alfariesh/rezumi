import type { ResumeRenderOptions } from "./context";
import type { ResumeData } from "@rezumi/schema/resume/data";
import type { Template } from "@rezumi/schema/templates";
import * as forme from "@formepdf/core";
import { parseUploadedFontUrl } from "@rezumi/fonts/uploaded";
import { parseResumeData } from "@rezumi/schema/resume/data";
import { loadFonts } from "./forme/fonts";
import { loadImages } from "./forme/images";
import { readServerImage } from "./forme/images.node.ts";
import { assertPdfFonts, renderResume, resumeFontRequests } from "./forme/render";

// The `.ts` matters: Node reads a bare `.node` ending as a native addon, so dev (tsx) can't resolve it without one.
export { configureOwnPictureReader } from "./forme/images.node.ts";

export type CreateResumePdfFileOptions = {
	data: ResumeData;
	filename: string;
	template?: Template | undefined;
	renderOptions?: ResumeRenderOptions | undefined;
	/** Operator-configured app origin; only its public picture upload paths may use private addresses. */
	uploadOrigin?: string | undefined;
	/** Reads an uploaded font file from storage by key. Without it, uploaded fonts are left out. */
	readUploadedFont?: ((key: string) => Promise<Uint8Array>) | undefined;
};

/**
 * The server reads uploaded fonts from its own storage, never over HTTP: a font address in a document is user input,
 * so one on another origin (or with no storage reader) is refused rather than fetched.
 */
const uploadedFontReader =
	(uploadOrigin: string | undefined, readUploadedFont: CreateResumePdfFileOptions["readUploadedFont"]) =>
	(source: string) => {
		const upload = uploadOrigin ? parseUploadedFontUrl(source, uploadOrigin) : null;
		if (!upload || !readUploadedFont) return Promise.reject(new Error("Uploaded font unavailable"));
		return readUploadedFont(upload.key);
	};

/** Creates a server PDF using deployment font mirroring and the server image reader. */
export const createResumePdfFile = async ({
	filename,
	uploadOrigin,
	readUploadedFont,
	...input
}: CreateResumePdfFileOptions): Promise<File> => {
	const result = await renderResume(forme, {
		...input,
		data: parseResumeData(input.data),
		readImage: (source) => readServerImage(source, uploadOrigin),
		webFontBaseUrl: process.env.WEB_FONT_BASE_URL,
		readUploadedFont: uploadedFontReader(uploadOrigin, readUploadedFont),
	});
	// Characters no font can draw print as "?" rather than failing the file; the editor names them.
	assertPdfFonts(result);
	return new File([result.pdf as Uint8Array<ArrayBuffer>], filename, { type: "application/pdf" });
};

/**
 * What a resume's link preview card draws with: the font files its typography and scripts need, and its picture as a
 * data URI (only a picture the server may read; a failed one is left out).
 */
export async function loadResumeCardAssets(
	data: ResumeData,
	uploadOrigin: string,
	readUploadedFont?: CreateResumePdfFileOptions["readUploadedFont"],
) {
	const { fonts } = await loadFonts(
		resumeFontRequests(data),
		process.env.WEB_FONT_BASE_URL,
		uploadedFontReader(uploadOrigin, readUploadedFont),
	);
	const source = data.picture.url && !data.picture.hidden ? data.picture.url : undefined;
	// A relative picture is one of the app's own files.
	const { images } = await loadImages(source ? [source] : [], (url) =>
		readServerImage(new URL(url, uploadOrigin).href, uploadOrigin),
	);
	return {
		fonts: fonts.map((font) => font.src as Uint8Array),
		headingFamily: data.metadata.typography.heading.fontFamily,
		bodyFamily: data.metadata.typography.body.fontFamily,
		picture: source ? images.get(source)?.src : undefined,
	};
}
