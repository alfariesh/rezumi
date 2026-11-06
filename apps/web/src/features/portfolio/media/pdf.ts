import type { PortfolioBlockOf } from "@rezumi/schema/portfolio/blocks";
import { t } from "@lingui/core/macro";
import { ORPCError } from "@orpc/client";
import { PORTFOLIO_LIMITS, PORTFOLIO_UPLOAD } from "@rezumi/schema/portfolio/limits";
import { generateId } from "@rezumi/utils/string";
import { uploadPortfolioImage } from "../images/upload";
import { client } from "@/libs/orpc/client";

type PdfProblem = "type" | "too-large" | "password" | "unreadable";

class PortfolioPdfError extends Error {
	constructor(readonly problem: PdfProblem) {
		super(problem);
		this.name = "PortfolioPdfError";
	}
}

/** Whether bytes start like a PDF file (`%PDF-`), as the server checks too. */
export function looksLikePdf(bytes: Uint8Array): boolean {
	return [0x25, 0x50, 0x44, 0x46, 0x2d].every((byte, index) => bytes[index] === byte);
}

/** A title from a file name: "case-study_final.pdf" becomes "case study final". */
export function pdfTitleFromName(name: string): string {
	return name
		.replace(/\.pdf$/i, "")
		.replace(/[_-]+/g, " ")
		.replace(/\s+/g, " ")
		.trim()
		.slice(0, PORTFOLIO_LIMITS.text.mediaTitle);
}

/** The first page's width in the picture: sharp in the 96 px card at any screen density, and on the cover. */
const PREVIEW_WIDTH = 800;

/**
 * Reads a PDF in the browser with the app's pdf.js (the same worker the resume preview uses, loaded only now): its page
 * count and a picture of its first page. Refuses what isn't a PDF, files over 10 MB, and password-protected files.
 */
async function readPdf(file: File): Promise<{ pages: number; preview: Blob }> {
	if (file.size > PORTFOLIO_UPLOAD.pdfBytes) throw new PortfolioPdfError("too-large");
	const bytes = new Uint8Array(await file.arrayBuffer());
	if (!looksLikePdf(bytes)) throw new PortfolioPdfError("type");
	const { AnnotationMode, getDocument, getPdfWorker } = await import("@/features/resume/preview/pdfjs");
	const task = getDocument({ data: bytes, worker: getPdfWorker() });
	try {
		const document = await task.promise.catch((error: unknown) => {
			throw new PortfolioPdfError(
				error instanceof Error && error.name === "PasswordException" ? "password" : "unreadable",
			);
		});
		const page = await document.getPage(1);
		const base = page.getViewport({ scale: 1 });
		const viewport = page.getViewport({ scale: PREVIEW_WIDTH / base.width });
		const canvas = window.document.createElement("canvas");
		canvas.width = Math.round(viewport.width);
		canvas.height = Math.round(viewport.height);
		const context = canvas.getContext("2d");
		if (!context) throw new PortfolioPdfError("unreadable");
		await page.render({
			canvas,
			canvasContext: context,
			viewport,
			annotationMode: AnnotationMode.DISABLE,
			background: "white",
		}).promise;
		const preview = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
		if (!preview) throw new PortfolioPdfError("unreadable");
		return { pages: document.numPages, preview };
	} finally {
		await task.destroy();
	}
}

/** What went wrong with a PDF, in words for the person who chose it. */
export function pdfErrorMessage(error: unknown): string {
	if (error instanceof PortfolioPdfError) {
		switch (error.problem) {
			case "type":
				return t`This file isn't a PDF. Choose a .pdf file.`;
			case "too-large":
				return t`This PDF is larger than 10 MB. Make it smaller (for example, export it with compressed pictures), then try again.`;
			case "password":
				return t`This PDF is protected by a password. Save a copy without one, then upload that.`;
			case "unreadable":
				return t`This PDF can't be read. Save it again as a PDF, then try again.`;
		}
	}
	if (error instanceof ORPCError) {
		if (error.code === "PORTFOLIO_FILE_TOO_LARGE")
			return t`This PDF is larger than 10 MB. Make it smaller, then try again.`;
		if (error.code === "PORTFOLIO_PDF_INVALID") return t`The server couldn't read this PDF. Save it again as a PDF.`;
		if (error.code === "TOO_MANY_REQUESTS") return t`Too many uploads in a short time. Wait a minute, then try again.`;
	}
	return t`The PDF couldn't be uploaded. Check your connection and try again.`;
}

/**
 * Uploads a PDF for a PDF block (`02-teknis.md` section 19): reads it, uploads the picture of its first page through
 * the picture path, then the file itself. Returns the block's file fields.
 */
export async function uploadPortfolioPdf(
	file: File,
	title: string,
): Promise<Pick<PortfolioBlockOf<"pdf">, "file" | "pages" | "bytes" | "preview">> {
	const { pages, preview } = await readPdf(file);
	const picture = await uploadPortfolioImage(new File([preview], "pdf-page.png", { type: "image/png" }), {
		alt: title,
	});
	const uploaded = await client.portfolio.uploadPdf({ file, pages: Math.min(pages, PORTFOLIO_LIMITS.pdfPages) });
	return { file: uploaded.key, pages: uploaded.pages, bytes: uploaded.bytes, preview: picture };
}

/** A new PDF block for an uploaded file. */
export async function newPdfBlock(file: File): Promise<PortfolioBlockOf<"pdf">> {
	const title = pdfTitleFromName(file.name);
	return { id: generateId(), type: "pdf", title, ...(await uploadPortfolioPdf(file, title)) };
}
