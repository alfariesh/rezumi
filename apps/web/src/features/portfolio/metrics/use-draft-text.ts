import { useState } from "react";
import { usePortfolioEditorStore } from "../editor/store";

/**
 * A field's own text: it starts from `value` and keeps what's typed, even text that doesn't read as a value yet (a
 * half-typed number or address), so only valid values reach the data. It starts over from `value` when the data is
 * swapped in from outside (a load, Undo, Redo, an item moved or removed), never while it's being typed.
 */
export function useDraftText(value: string): [string, (text: string) => void] {
	const revision = usePortfolioEditorStore((state) => state.revision);
	const [text, setText] = useState(value);
	const [seen, setSeen] = useState(revision);
	if (seen !== revision) {
		setSeen(revision);
		setText(value);
	}
	return [text, setText];
}
