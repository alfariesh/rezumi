// The few values JavaScript needs at run time (computed styles, animations, gesture math). Colors, type, radius and
// spacing live in global.css and reach components as classes (`bg-surface`, `text-sm`, `rounded-xl`, `p-4`); read a
// color in JavaScript with `useThemeColor` from heroui-native, never a hex value. See apps/mobile/DESIGN.md.
import { Easing } from "react-native-reanimated";

/** Motion: quick for press and toggles, standard for menus and swaps, emphasized for sheets and toasts. */
export const motion = {
	quick: 120,
	standard: 200,
	emphasized: 320,
	/** Exits take 70% of the entering duration. */
	exit: 0.7,
	/** Entering and changing state: a strong ease-out (the web's `--ease`). Worklet-safe. */
	ease: Easing.bezier(0.23, 1, 0.32, 1),
	/** Sliding indicators, reordering, settling (`ease-in-out-strong`). */
	easeMove: Easing.bezier(0.77, 0, 0.175, 1),
	/** Sheets and full-screen pushes (`ease-drawer`). */
	easeDrawer: Easing.bezier(0.32, 0.72, 0, 1),
} as const;

/** The 4 pt spacing scale, for computed styles only; layout uses `p-4`, `gap-3` and so on. */
export const space = { 1: 4, 2: 8, 3: 12, 4: 16, 6: 24, 8: 32, 12: 48, 16: 64 } as const;

export const size = {
	/** Minimum touch target on both platforms (44 pt; Android's 48 dp is met by the 2 pt hit slop). */
	hit: 44,
	/** Icons: 16 in chips and small buttons, 20 in rows, 24 on touch targets and bars. */
	icon: { sm: 16, md: 20, lg: 24 },
	/** Phone page gutter. */
	gutter: 16,
	/** Width from which the tablet layout (sidebar, list beside detail, form sheets) applies. */
	wide: 700,
	formSheet: 540,
	/** The editor's side panel on tablets (Write, Design, Check beside the page). */
	panel: 400,
} as const;
