/// <reference lib="webworker" />

import type { PdfWorkerRequest, PdfWorkerResponse } from "./pdf-document";
import { preloadResumePdf } from "@rezumi/pdf/browser";
import { renderResumePdf } from "./render";

// Requests the page dropped before they started.
const cancelled = new Set<number>();

// Renders off the main thread, so typing, scrolling and the gallery stay smooth while a page is laid out.
self.addEventListener("message", async ({ data: request }: MessageEvent<PdfWorkerRequest>) => {
	if ("cancel" in request) {
		cancelled.add(request.cancel);
		return;
	}
	const { id, ...input } = request;
	// Let messages that arrived during the last render through first: a cancel for this one comes after it.
	await new Promise((resolve) => setTimeout(resolve, 0));
	if (cancelled.delete(id)) return;
	try {
		preloadResumePdf(input.data);
		self.postMessage({ id, ...(await renderResumePdf(input)) } satisfies PdfWorkerResponse);
	} catch (error) {
		const cause = error instanceof Error && typeof error.cause === "string" ? error.cause : undefined;
		self.postMessage({
			id,
			error: error instanceof Error ? error.message : String(error),
			cause,
		} satisfies PdfWorkerResponse);
	} finally {
		// A cancel that came while this one was laying out.
		cancelled.delete(id);
	}
});
