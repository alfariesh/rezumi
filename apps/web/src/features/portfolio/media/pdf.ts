import type { PortfolioBlockOf } from "@rezumi/schema/portfolio/blocks";
import type { PortfolioImage } from "@rezumi/schema/portfolio/files";
import type { PDFDocumentProxy } from "pdfjs-dist/legacy/build/pdf.mjs";
import { i18n } from "@lingui/core";
import { t } from "@lingui/core/macro";
import { ORPCError } from "@orpc/client";
import { PORTFOLIO_LIMITS, PORTFOLIO_UPLOAD } from "@rezumi/schema/portfolio/limits";
import { generateId } from "@rezumi/utils/string";
import { portfolioErrorMessage } from "../errors";
import { discardUploadedImages, isAbort, stopIfAborted, uploadPortfolioImage } from "../images/upload";
import { refreshPortfolioUsage } from "../works/storage-meter";
import { titleFromFileName } from "../works/works";
import { openPlanDialogForError } from "@/features/billing/plan-dialog";
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

/**
 * A file size as people read it in the app's language, counted the way the upload limits are (1 MB = 1,024 KB), so a
 * file at the limit reads as the limit: "10 MB", "850 KB".
 */
export function formatFileSize(bytes: number, locale: string = i18n.locale): string {
	const megabytes = bytes / 1024 / 1024;
	const unit = megabytes >= 1 ? "megabyte" : "kilobyte";
	const value = megabytes >= 1 ? megabytes : Math.max(1, Math.round(bytes / 1024));
	try {
		return new Intl.NumberFormat(locale, { style: "unit", unit, maximumFractionDigits: 1 }).format(value);
	} catch {
		return `${Math.round(value * 10) / 10} ${megabytes >= 1 ? "MB" : "KB"}`;
	}
}

/** The largest PDF a PDF block takes, in words ("10 MB"). */
export const pdfLimitText = () => formatFileSize(PORTFOLIO_UPLOAD.pdfBytes);

/** The first page's width in the picture: sharp in the 96 px card at any screen density, and on the cover. */
const PREVIEW_WIDTH = 800;

/**
 * A picture of the PDF's first page, or null when it can't be drawn (memory, an odd page): the PDF still goes up,
 * its card shows an icon instead.
 */
async function firstPagePicture(document: PDFDocumentProxy): Promise<Blob | null> {
	const { AnnotationMode } = await import("@/features/resume/preview/pdfjs");
	const canvas = window.document.createElement("canvas");
	try {
		const page = await document.getPage(1);
		const base = page.getViewport({ scale: 1 });
		const viewport = page.getViewport({ scale: PREVIEW_WIDTH / base.width });
		canvas.width = Math.round(viewport.width);
		canvas.height = Math.round(viewport.height);
		const context = canvas.getContext("2d");
		if (!context) return null;
		await page.render({
			canvas,
			canvasContext: context,
			viewport,
			annotationMode: AnnotationMode.DISABLE,
			background: "white",
		}).promise;
		return await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
	} catch {
		return null;
	} finally {
		// Gives the canvas's memory back at once (iOS limits what all canvases together may hold).
		canvas.width = 0;
		canvas.height = 0;
	}
}

/**
 * Reads a PDF in the browser with the app's pdf.js (the same worker the resume preview uses, loaded only now): its page
 * count and, when it can be drawn, a picture of its first page. Refuses what isn't a PDF, files over the limit, and
 * password-protected files.
 */
async function readPdf(file: File): Promise<{ pages: number; preview: Blob | null }> {
	if (file.size > PORTFOLIO_UPLOAD.pdfBytes) throw new PortfolioPdfError("too-large");
	const bytes = new Uint8Array(await file.arrayBuffer());
	if (!looksLikePdf(bytes)) throw new PortfolioPdfError("type");
	const { getDocument, getPdfWorker } = await import("@/features/resume/preview/pdfjs");
	const task = getDocument({ data: bytes, worker: getPdfWorker() });
	try {
		const document = await task.promise.catch((error: unknown) => {
			throw new PortfolioPdfError(
				error instanceof Error && error.name === "PasswordException" ? "password" : "unreadable",
			);
		});
		return { pages: document.numPages, preview: await firstPagePicture(document) };
	} finally {
		await task.destroy();
	}
}

/** What went wrong with a PDF, in words for the person who chose it. */
export function pdfErrorMessage(error: unknown): string {
	const limit = pdfLimitText();
	if (error instanceof PortfolioPdfError) {
		switch (error.problem) {
			case "type":
				return t`This file isn't a PDF. Choose a .pdf file.`;
			case "too-large":
				return t`This PDF is larger than ${limit}. Make it smaller (for example, export it with compressed pictures), then try again.`;
			case "password":
				return t`This PDF is protected by a password. Save a copy without one, then upload that.`;
			case "unreadable":
				return t`This PDF can't be read. Save it again as a PDF, then try again.`;
		}
	}
	const fallback = t`The PDF couldn't be uploaded. Check your connection and try again.`;
	if (!(error instanceof ORPCError)) return fallback;
	const tooLarge = t`This PDF is larger than ${limit}. Make it smaller, then try again.`;
	return portfolioErrorMessage(error, {
		fallback,
		byCode: {
			PORTFOLIO_FILE_TOO_LARGE: tooLarge,
			// The API refuses a file over its size limit before reading it, as a bad request.
			BAD_REQUEST: tooLarge,
			PORTFOLIO_PDF_INVALID: t`The server couldn't read this PDF. Save it again as a PDF.`,
			TOO_MANY_REQUESTS: t`Too many uploads in a short time. Wait a minute, then try again.`,
		},
	});
}

/**
 * Uploads a PDF for a PDF block (`02-teknis.md` section 19): reads it, uploads the picture of its first page through
 * the picture path (a page that can't be drawn or uploaded only costs the card its picture), then the file itself.
 * Returns the block's file fields; a picture left over from a failed or cancelled upload is deleted.
 */
export async function uploadPortfolioPdf(
	file: File,
	title: string,
	signal?: AbortSignal,
): Promise<Pick<PortfolioBlockOf<"pdf">, "file" | "pages" | "bytes" | "preview">> {
	const { pages, preview } = await readPdf(file);
	stopIfAborted(signal);
	let picture: PortfolioImage | undefined;
	if (preview) {
		try {
			picture = await uploadPortfolioImage(new File([preview], "pdf-page.png", { type: "image/png" }), {
				alt: title,
				...(signal ? { signal } : {}),
			});
		} catch (error) {
			if (isAbort(error, signal)) throw error;
		}
	}
	let uploaded: Awaited<ReturnType<typeof client.portfolio.uploadPdf>>;
	try {
		uploaded = await client.portfolio.uploadPdf(
			{ file, pages: Math.min(pages, PORTFOLIO_LIMITS.pdfPages) },
			signal ? { signal } : undefined,
		);
	} catch (error) {
		if (picture) void discardUploadedImages([picture]);
		openPlanDialogForError(error);
		throw error;
	}
	refreshPortfolioUsage();
	if (signal?.aborted) {
		void discardUploadedImages(picture ? [picture, { key: uploaded.key }] : [{ key: uploaded.key }]);
		stopIfAborted(signal);
	}
	return {
		file: uploaded.key,
		pages: uploaded.pages,
		bytes: uploaded.bytes,
		...(picture ? { preview: picture } : {}),
	};
}

/** A new PDF block for an uploaded file, titled after it. */
export async function newPdfBlock(file: File, signal?: AbortSignal): Promise<PortfolioBlockOf<"pdf">> {
	const title = titleFromFileName(file.name, PORTFOLIO_LIMITS.text.mediaTitle);
	return { id: generateId(), type: "pdf", title, ...(await uploadPortfolioPdf(file, title, signal)) };
}
