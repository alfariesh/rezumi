import { useWindowDimensions } from "react-native";
import { size } from "@/ui";

/**
 * True when the window is wide enough for the sidebar and the builder's panel + page split (700 pt, `size.wide`). It
 * goes by the window, not the device: an iPad in Split View or a narrow Stage Manager window gets the phone layout.
 */
export function useIsTablet() {
	return useWindowDimensions().width >= size.wide;
}
