import { createContext, use } from "react";
import { useIsTablet } from "./use-is-tablet";
import { useReducedMotion, useTheme } from "@/ui-legacy";

const BannerAboveContext = createContext(false);

/** Set by the tab shell while a banner sits above the tabs and has cleared the status bar. */
export const BannerAbove = BannerAboveContext;

/**
 * Screen options for a tab's native stack. The status bar is already cleared under a banner (and under Career's own
 * strip, `cleared`), but Android's edge-to-edge header pads it natively whatever the JS inset says; this turns that off.
 */
export function useTabStackOptions(cleared = false) {
	const { colors, type } = useTheme();
	const reduced = useReducedMotion();
	const tablet = useIsTablet();
	const disableTopInsetApplication = use(BannerAboveContext) || cleared;
	return {
		animation: reduced ? ("fade" as const) : ("default" as const),
		headerLargeTitle: !tablet,
		headerTitleStyle: { fontFamily: type.display.fontFamily, color: colors.ink },
		headerLargeTitleStyle: { fontFamily: type.largeIOS.fontFamily, color: colors.ink },
		unstable_nativeProps: { headerConfig: { disableTopInsetApplication } },
	};
}
