// The old "Desk & Paper" primitives, kept only for screens not rebuilt on `src/ui` yet (plans/mobile Phase 09–14).
// New code imports `@/ui`; delete each export here once its last screen moves.
export { Button, IconButton } from "./button";
export { Segmented, SelectSheet, Switch, TextArea, TextField } from "./fields";
export { Icon, type IconName } from "./icon";
export { Avatar, Banner, Card, EmptyState, ListRow, Skeleton } from "./layout";
export { ConfirmDialog, Sheet, Toaster, dismissToast, showToast } from "./overlays";
export {
	haptics,
	listItemMotion,
	setHapticsEnabled,
	useHapticsEnabled,
	listLayout,
	useFirstAppearance,
	useReducedMotion,
} from "@/ui/motion";
export { Screen, Text } from "./text";
export { setThemePreference, useTheme, useThemePreference, type ThemePreference } from "./theme";
