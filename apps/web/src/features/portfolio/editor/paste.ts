/** What a paste into a text block is: files to add as blocks, a lone address on an empty line, or text to paste. */
export type PasteIntent = { kind: "files"; files: File[] } | { kind: "url"; url: string } | { kind: "text" };

type PasteInput = {
	files: readonly File[];
	/** The clipboard's plain text. */
	text: string;
	/** The caret is on an empty line, with nothing selected. */
	emptyLine: boolean;
};

/**
 * Reads a paste. Files count only when there's no text with them: Word, Excel and Google Docs put a picture of what
 * was copied next to its text, and the text is what the person means. An address counts only alone on an empty line,
 * so one pasted into a sentence stays a link in it.
 */
export function pasteIntent({ files, text, emptyLine }: PasteInput): PasteIntent {
	const trimmed = text.trim();
	if (files.length && !trimmed) return { kind: "files", files: [...files] };
	if (emptyLine && /^https?:\/\/\S+$/i.test(trimmed)) return { kind: "url", url: trimmed };
	return { kind: "text" };
}
