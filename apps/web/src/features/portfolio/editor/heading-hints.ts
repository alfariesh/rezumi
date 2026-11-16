import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

/** The question for the empty paragraph under a heading with this text, if there is one. */
export type HeadingHint = (heading: string) => string | undefined;

/**
 * Where the hints go: each empty paragraph right after a heading that has one, at the top of the text. Positions and
 * hints, in document order.
 */
export function headingHintPlaces(
	doc: ProseMirrorNode,
	hintFor: HeadingHint,
): { from: number; to: number; hint: string }[] {
	const places: { from: number; to: number; hint: string }[] = [];
	let previous: ProseMirrorNode | null = null;
	doc.forEach((node, offset) => {
		if (previous?.type.name === "heading" && node.type.name === "paragraph" && node.content.size === 0) {
			const hint = hintFor(previous.textContent);
			if (hint) places.push({ from: offset, to: offset + node.nodeSize, hint });
		}
		previous = node;
	});
	return places;
}

/**
 * Shows a question in the empty paragraph under a story outline's heading ("What wasn't working, and for whom?"), until
 * the person writes there. Only a look: nothing is saved.
 */
export function headingHints(hintFor: HeadingHint) {
	const key = new PluginKey("headingHints");
	return Extension.create({
		name: "headingHints",
		addProseMirrorPlugins() {
			return [
				new Plugin({
					key,
					props: {
						decorations: (state) => {
							const places = headingHintPlaces(state.doc, hintFor);
							if (!places.length) return null;
							return DecorationSet.create(
								state.doc,
								places.map(({ from, to, hint }) =>
									Decoration.node(from, to, { class: "heading-hint", "data-hint": hint }),
								),
							);
						},
					},
				}),
			];
		},
	});
}
