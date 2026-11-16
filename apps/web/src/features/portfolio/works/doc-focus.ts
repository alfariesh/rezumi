/**
 * Moving the caret through Work's writing surface: to a new work's title, from the title to the summary, from the
 * summary into the story, into a text block just added. The target may not be on the page yet (a block's editor loads
 * on first use, a dialog is still closing), so it's looked for again on each frame for a moment.
 */

const TRIES = 90;

/** Focuses what `find` gives once it's there; `end` puts the caret after its text. */
function focusWhenReady(find: () => HTMLElement | null, end: boolean) {
	let tries = 0;
	const attempt = () => {
		const target = find();
		if (target) {
			target.focus({ preventScroll: true });
			if (document.activeElement === target || target.contains(document.activeElement)) {
				placeCaret(target, end);
				target.scrollIntoView({ block: "nearest", behavior: "smooth" });
				return;
			}
		}
		if (tries++ < TRIES) requestAnimationFrame(attempt);
	};
	attempt();
}

function placeCaret(target: HTMLElement, end: boolean) {
	if (target instanceof HTMLTextAreaElement || target instanceof HTMLInputElement) {
		const at = end ? target.value.length : 0;
		target.setSelectionRange(at, at);
		return;
	}
	// A rich text block: the browser's selection, which its editor follows.
	const selection = window.getSelection();
	if (!selection) return;
	const range = document.createRange();
	range.selectNodeContents(target);
	range.collapse(!end);
	selection.removeAllRanges();
	selection.addRange(range);
}

const part = (workId: string, name: "title" | "summary") =>
	document.querySelector<HTMLElement>(`[data-work-doc="${CSS.escape(workId)}"] [data-doc-part="${name}"]`);

/** The caret into a work's title (a work just added empty). */
export function focusWorkTitle(workId: string) {
	focusWhenReady(() => part(workId, "title"), true);
}

/** The caret into a work's summary, after its text. */
export function focusWorkSummary(workId: string) {
	focusWhenReady(() => part(workId, "summary"), true);
}

/** The caret into a text block (just added, or the first of the story), after its text. */
export function focusTextBlock(blockId: string) {
	focusWhenReady(
		() => document.querySelector<HTMLElement>(`[data-block-id="${CSS.escape(blockId)}"] .ProseMirror`),
		true,
	);
}
