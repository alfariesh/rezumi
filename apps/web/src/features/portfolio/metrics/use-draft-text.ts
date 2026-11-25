import { useState } from "react";
import { usePortfolioEditorStore } from "../editor/store";

/**
 * A field's own text: it starts from `value` and keeps what's typed, even text that doesn't read as a value yet (a
 * half-typed number or address), so only valid values reach the data. It starts over from `value` when the data is
 * swapped in from outside (a load, Undo, Redo, an item moved or removed) and that gave this field another value. A
 * swap that leaves its value alone, such as a block added elsewhere or an AI change to another section, leaves the
 * typing alone too.
 */
export function useDraftText(value: string): [string, (text: string) => void] {
	const revision = usePortfolioEditorStore((state) => state.revision);
	const [text, setText] = useState(value);
	// The revision and the value as last seen: a value that changes together with the revision came from outside.
	const [seen, setSeen] = useState({ revision, value });
	if (seen.revision !== revision) {
		if (seen.value !== value) setText(value);
		setSeen({ revision, value });
	} else if (seen.value !== value) {
		// The field's own valid typing reached the data.
		setSeen({ revision, value });
	}
	return [text, setText];
}
