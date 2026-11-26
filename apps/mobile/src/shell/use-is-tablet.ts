import { useSectionWidth } from "./section-width";
import { size } from "@/ui";

/**
 * True when the window is wide enough for the sidebar and the builder's panel + page split (700 pt, `size.wide`). It
 * uses the space left to the section when Coach is beside it. Navigation chrome can use the whole window.
 */
export function useIsTablet(scope: "section" | "window" = "section") {
	return useSectionWidth(scope) >= size.wide;
}
