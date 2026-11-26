import { createContext, use } from "react";

/**
 * Phones: the layer over the open sheet's panel, a sibling after its scroller inside the sheet's dialog. A screen that
 * covers the panel (an entry's fields) renders into it, so nothing in the panel can paint over it, while it stays in
 * the sheet's focus scope. Null outside the phone sheet.
 */
export const SheetLayerContext = createContext<HTMLElement | null>(null);

export function useSheetLayer() {
	return use(SheetLayerContext);
}
