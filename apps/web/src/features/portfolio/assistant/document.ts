import type { PortfolioPlaceContext, PortfolioReveal } from "../editor/save-problem";
import type { PortfolioAssistantDocument } from "@/features/assistant/document";
import { t } from "@lingui/core/macro";
import { useLayoutEffect, useMemo, useRef } from "react";
import { usePortfolioSource } from "../editor/context";
import { describeRetry, describeSaveProblem } from "../editor/save-problem";
import { usePortfolioEditorStore } from "../editor/store";
import { usePageMessages } from "../editor/use-view";
import { portfolioRefusalMessage } from "../errors";
import { compressImage, pictureFiles } from "../images/compress";

/** The words for a save that stops the assistant, from the editor's save state (after a flush that didn't save). */
export function portfolioSaveReason(context: Omit<PortfolioPlaceContext, "data">): string {
	const { status, problem, retry, portfolio } = usePortfolioEditorStore.getState();
	switch (status) {
		case "conflict":
			return t`Your portfolio changed somewhere else. Choose the version to keep.`;
		case "gone":
			return (problem?.kind === "gone" ? portfolioRefusalMessage(problem.code) : null) ?? t`Try again in a moment.`;
		case "invalid":
			return problem && portfolio
				? describeSaveProblem(problem, { ...context, data: portfolio.data }).message
				: t`Try again in a moment.`;
		case "error":
			return retry ? describeRetry(retry.reason) : t`Try again in a moment.`;
		default:
			return t`Try again in a moment.`;
	}
}

/**
 * Before a message goes out, the editor saves what's waiting: the assistant reads the saved portfolio. Null when it's
 * all saved; otherwise why the message waits.
 */
export async function portfolioSendProblem(context: Omit<PortfolioPlaceContext, "data">): Promise<string | null> {
	const store = usePortfolioEditorStore.getState();
	if (!store.portfolio) return t`Your portfolio isn't open anymore. Reload the page.`;
	if (await store.flush()) return null;
	const reason = portfolioSaveReason(context);
	return t`Not sent: the assistant needs your latest changes saved first. ${reason}`;
}

const EXTENSIONS: Record<string, string> = { "image/webp": "webp", "image/png": "png", "image/jpeg": "jpg" };

/** The file's name with the extension of the type it was written in again. */
function renamed(name: string, type: string): string {
	const extension = EXTENSIONS[type];
	if (!extension) return name;
	const base = name.replace(/\.[^./]*$/, "") || "picture";
	return `${base}.${extension}`;
}

/**
 * Pictures attached in a portfolio conversation are shrunk like the editor's own uploads (at most 2,000 px and the
 * upload limit, metadata dropped), so the assistant can put them on the page. Anything the page can't show (SVG, an
 * animated GIF, an unreadable file) and every other file goes as it is, for the assistant to read. One at a time: a
 * phone decoding ten photos at once can run out of memory.
 */
export async function preparePortfolioUploads(files: readonly File[]): Promise<File[]> {
	const prepared: File[] = [];
	for (const file of files) {
		if (pictureFiles([file]).length === 0) {
			prepared.push(file);
			continue;
		}
		try {
			const { file: blob } = await compressImage(file, "photo");
			prepared.push(new File([blob], renamed(file.name, blob.type), { type: blob.type }));
		} catch {
			prepared.push(file);
		}
	}
	return prepared;
}

/**
 * The portfolio as the assistant panel works on it. `reveal` opens a change's place in the editor; the document stays
 * the same object while the portfolio and its source do, so the conversation doesn't re-render on every edit.
 */
export function usePortfolioAssistantDocument(reveal: (place: PortfolioReveal) => void): PortfolioAssistantDocument {
	const id = usePortfolioEditorStore((state) => state.portfolio?.id ?? "");
	const source = usePortfolioSource();
	const messages = usePageMessages();
	const revealRef = useRef(reveal);
	useLayoutEffect(() => {
		revealRef.current = reveal;
	});
	const resume = source.data;
	const from = source.from ?? null;

	return useMemo(
		() => ({
			kind: "portfolio",
			id,
			name: t`Portfolio`,
			locked: false,
			posting: null,
			source: { from, resume, messages },
			beforeSend: () => portfolioSendProblem({ resume, messages }),
			prepareUploads: preparePortfolioUploads,
			reveal: (place) => revealRef.current(place),
		}),
		[id, from, resume, messages],
	);
}
