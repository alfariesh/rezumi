import type { RenderInput, Rendered } from "./render";
import type { PageMap } from "@rezumi/pdf/page-map";
import type { ResumeData } from "@rezumi/schema/resume/data";

type CreateResumePdfBlobExtras = {
	/** Receives the page map (header, section and item boxes) of this render; used by the editor canvas. */
	onPageMap?: (pageMap: PageMap) => void;
	/** Receives the characters no font could draw (they print as "?"); not called when every character rendered. */
	onLostCharacters?: (characters: string[]) => void;
	/** Drops the render if it hasn't started yet, so a superseded preview or thumbnail doesn't hold up the next one. */
	signal?: AbortSignal;
};

export type PdfWorkerRequest = (RenderInput & { id: number }) | { cancel: number };
export type PdfWorkerResponse =
	| ({ id: number } & Rendered)
	// `cause` survives the worker boundary so callers can still tell text loss apart (see `getReadableErrorMessage`).
	| { id: number; error: string; cause: string | undefined };

/** The same render on the main thread: where workers aren't available, or the worker failed to start. */
const renderHere = async (input: RenderInput) => (await import("./render")).renderResumePdf(input);

type Pending = { input: RenderInput; resolve(value: Rendered): void; reject(error: Error): void };

// ponytail: one worker renders in order, so a preview can wait behind one thumbnail (~0.25 s); a second worker
// for thumbnails costs another engine and font set in memory.
let worker: Worker | null | undefined;
let nextId = 0;
const pending = new Map<number, Pending>();

function getWorker(): Worker | null {
	if (worker !== undefined) return worker;
	worker = null;
	if (typeof Worker === "undefined") return worker;
	try {
		worker = new Worker(new URL("./pdf.worker.ts", import.meta.url), { type: "module", name: "resume-pdf" });
	} catch {
		return worker;
	}
	worker.addEventListener("message", ({ data: response }: MessageEvent<PdfWorkerResponse>) => {
		const request = pending.get(response.id);
		if (!request) return;
		pending.delete(response.id);
		if ("error" in response) request.reject(new Error(response.error, { cause: response.cause }));
		else request.resolve(response);
	});
	// Every render is caught inside the worker, so an error here means it couldn't start: render here instead.
	worker.addEventListener("error", () => {
		worker?.terminate();
		worker = null;
		for (const request of pending.values()) renderHere(request.input).then(request.resolve, request.reject);
		pending.clear();
	});
	return worker;
}

function render(input: RenderInput, signal?: AbortSignal): Promise<Rendered> {
	signal?.throwIfAborted();
	const target = getWorker();
	if (!target) return renderHere(input);
	const id = ++nextId;
	return new Promise((resolve, reject) => {
		pending.set(id, { input, resolve, reject });
		target.postMessage({ ...input, id } satisfies PdfWorkerRequest);
		signal?.addEventListener(
			"abort",
			() => {
				if (!pending.delete(id)) return;
				// The worker skips it if it hasn't started; one already laying out finishes and its reply is ignored.
				target.postMessage({ cancel: id } satisfies PdfWorkerRequest);
				reject(signal.reason);
			},
			{ once: true },
		);
	});
}

export const createResumePdfBlob = async (
	data: ResumeData,
	renderOptions?: RenderInput["renderOptions"],
	{ onPageMap, onLostCharacters, signal }: CreateResumePdfBlobExtras = {},
) => {
	const { blob, pageMap, lostCharacters } = await render({ data, renderOptions }, signal);
	if (pageMap) onPageMap?.(pageMap);
	if (lostCharacters) onLostCharacters?.(lostCharacters);
	return blob;
};
