import type { PortfolioHeroEffect } from "@rezumi/schema/portfolio/themes";
import { useEffect, useRef } from "react";
import { EFFECT_RUNNERS } from "@rezumi/portfolio/effects";

/**
 * The sample's markup, as the page draws the intro (`packages/portfolio/src/shared/hero-text.tsx`): the typewriter's
 * phrases as reserved "ghosts" with the first one shown, words wrapped for the word effects, plain text otherwise.
 */
function demoElement(d: Document, effect: PortfolioHeroEffect, name: string, phrases: readonly string[]): HTMLElement {
	const root = d.createElement("span");
	if (effect === "typewriter") {
		root.dataset.pfx = "typewriter";
		root.dataset.pfxPhrases = JSON.stringify(phrases);
		const type = d.createElement("span");
		type.className = "pfx-type";
		type.setAttribute("aria-hidden", "true");
		for (const phrase of phrases) {
			const ghost = d.createElement("span");
			ghost.className = "pfx-type__ghost";
			ghost.textContent = phrase;
			type.append(ghost);
		}
		const out = d.createElement("span");
		out.className = "pfx-type__out";
		out.textContent = phrases[0] ?? "";
		type.append(out);
		root.append(type);
		return root;
	}

	root.className = "font-bold";
	if (effect !== "none") root.dataset.pfx = effect;
	if (effect !== "fade-up" && effect !== "vector-hover") {
		root.textContent = name;
		return root;
	}
	// Inline blocks are neutral to bidi: `dir="auto"` keeps a Latin name in order on a right-to-left page.
	const words = d.createElement("span");
	words.dir = "auto";
	let index = 0;
	for (const part of name.split(/(\s+)/)) {
		if (!part) continue;
		if (/^\s+$/.test(part)) {
			words.append(part);
			continue;
		}
		const word = d.createElement("span");
		word.className = "pfx-w";
		word.style.setProperty("--i", String(index++));
		word.textContent = part;
		words.append(word);
	}
	root.append(words);
	return root;
}

type EffectDemoProps = {
	effect: PortfolioHeroEffect;
	/** What the name effects draw. */
	name: string;
	/** What the typewriter types: the headline, then the roles. */
	phrases: readonly string[];
	/** Plays the sample again whenever it changes (from 1); 0 shows it still. */
	play: number;
};

/**
 * A small live sample of an intro effect, drawn with the page's own rules and script (`@rezumi/portfolio/effects`).
 * The scripts rewrite what they animate (the vector outline wraps every letter), so the sample is built here, outside
 * React's tree: React only owns the empty box, and a new name or effect builds a fresh sample instead of reconciling
 * one a script has changed. With "reduce motion" the scripts leave it still.
 */
export function EffectDemo({ effect, name, phrases, play }: EffectDemoProps) {
	const box = useRef<HTMLSpanElement>(null);
	const phraseList = JSON.stringify(phrases);

	// Every change, and every play, starts from a fresh sample.
	useEffect(() => {
		const element = box.current;
		if (!element) return;
		const list: string[] = JSON.parse(phraseList);
		element.replaceChildren(demoElement(element.ownerDocument, effect, name, list));
	}, [effect, name, phraseList, play]);

	// Plays only when asked, not when the text changes under a sample.
	useEffect(() => {
		const element = box.current;
		if (play && element) EFFECT_RUNNERS[effect]?.(element.ownerDocument);
	}, [effect, play]);

	return <span ref={box} />;
}
