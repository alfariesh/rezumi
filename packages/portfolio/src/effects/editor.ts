import { EFFECT_RUNNERS } from "./runtime";

// What the editor needs to show and replay intro effects without loading the page renderer: the effects' rules, their
// colours, their scripts (the same functions the page inlines), and what the typewriter types (`typewriterPhrases`).

export { EFFECT_CSS, EFFECT_SHARED_CSS } from "./css";
export { typewriterPhrases } from "./phrases";
export { EFFECT_RUNNERS } from "./runtime";

/**
 * Holds an inert preview still: the editor redraws it on every edit, and an intro that animated each time would get in
 * the way. "Replay" takes it out (`replayIntroEffect`).
 */
export const PREVIEW_STILL_CSS = `<style id="pfx-still">[data-pfx],[data-pfx] *{animation:none!important;transition:none!important}</style>`;

/**
 * Plays a page's intro effect again from the start, in a document the editor holds (its preview), from the editor's own
 * script: CSS animations restart and a script effect runs once more. Nothing runs inside the preview itself.
 */
export function replayIntroEffect(d: Document): void {
	d.getElementById("pfx-still")?.remove();
	const ids = new Set<string>();
	for (const element of d.querySelectorAll<HTMLElement>("[data-pfx]")) {
		ids.add(element.dataset.pfx ?? "");
		for (const animation of element.getAnimations({ subtree: true })) {
			animation.cancel();
			animation.play();
		}
	}
	for (const id of ids) EFFECT_RUNNERS[id]?.(d);
}
