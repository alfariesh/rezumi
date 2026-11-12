import type { KeyboardEvent } from "react";
import { useRef } from "react";

const ARROWS = new Set(["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"]);

/**
 * Tells a radio group's change made by an arrow key (moving through the choices) from one made on purpose (a click,
 * Space). A radio group selects as the arrows move, so a choice that opens a dialog (a Plus theme on Free) would open
 * it on every pass; with this, it opens only when the choice is made on purpose. Spread `props` on an element around
 * the group.
 */
export function useArrowKeyChoice() {
	const arrowed = useRef(false);
	return {
		props: {
			onKeyDownCapture: (event: KeyboardEvent) => {
				arrowed.current = ARROWS.has(event.key);
			},
			onPointerDownCapture: () => {
				arrowed.current = false;
			},
		},
		/** Whether the change being handled came from an arrow key. */
		byArrow: () => arrowed.current,
	};
}
