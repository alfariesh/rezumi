// Toasts: HeroUI's toast region (hosted by HeroUINativeProvider), like the web's: bottom, one visible at a time, six
// seconds by default, Undo as the optional action. A reversible action shows a toast with Undo instead of asking
// first. Screens call `useAppToast().show(...)`; code outside components (mutation callbacks, the API client) calls
// `showToast(...)`, which reaches the region through `ToastBridge`, mounted once at the root.
import type { ToastManager } from "heroui-native";
import { useToast } from "heroui-native";
import { useEffect, useMemo } from "react";
import { AccessibilityInfo } from "react-native";
import { haptics } from "./motion";

export type AppToastVariant = "default" | "success" | "danger" | "warning";

export type AppToastOptions = {
	/** One short line: what happened ("Moved to trash"). */
	title: string;
	/** An optional second line: what to do next. */
	description?: string | undefined;
	/** Success plays the success haptic, danger the error haptic. Defaults to "default". */
	variant?: AppToastVariant | undefined;
	/** The action: Undo, with its translated label. Pressing it runs `onUndo` and closes the toast. */
	undo?: { label: string; onUndo: () => void } | undefined;
	/** Milliseconds on screen; 6000 by default and twice as long with a screen reader on. */
	duration?: number | undefined;
};

const defaultDuration = 6000;

let screenReader = false;
void AccessibilityInfo.isScreenReaderEnabled().then((value) => (screenReader = value));
AccessibilityInfo.addEventListener("screenReaderChanged", (value) => (screenReader = value));

function present(toast: ToastManager, options: AppToastOptions): string {
	const { title, description, variant = "default", undo, duration = defaultDuration } = options;
	// One toast at a time: the new one replaces whatever is showing, and its timer with it.
	toast.hide("all");
	if (variant === "success") haptics.success();
	else if (variant === "danger") haptics.error();
	AccessibilityInfo.announceForAccessibility(description ? `${title}. ${description}` : title);
	const id = toast.show({
		variant,
		placement: "bottom",
		label: title,
		duration: duration * (screenReader ? 2 : 1),
		...(description ? { description } : {}),
		...(undo
			? {
					actionLabel: undo.label,
					onActionPress: ({ hide }) => {
						undo.onUndo();
						hide(id);
					},
				}
			: {}),
	});
	return id;
}

export type AppToast = {
	/** Shows a toast and returns its id. */
	show: (options: AppToastOptions) => string;
	/** Hides the toast with this id, or the visible one. */
	hide: (id?: string) => void;
};

/** The toast API for components. */
export function useAppToast(): AppToast {
	const { toast } = useToast();
	return useMemo(
		() => ({
			show: (options) => present(toast, options),
			hide: (id) => toast.hide(id ?? "all"),
		}),
		[toast],
	);
}

let bridge: ToastManager | null = null;
let pending: AppToastOptions | null = null;

/**
 * Shows a toast from anywhere, including outside React. Returns its id, or undefined when the bridge is not mounted
 * yet; the latest such toast then shows as soon as it mounts.
 */
export function showToast(options: AppToastOptions): string | undefined {
	if (bridge) return present(bridge, options);
	pending = options;
	return undefined;
}

/** Hides a toast shown with `showToast`, or the visible one. */
export function hideToast(id?: string) {
	bridge?.hide(id ?? "all");
}

/** Connects `showToast` to the toast region. Mount once, inside HeroUINativeProvider (app/_layout.tsx). */
export function ToastBridge() {
	const { toast } = useToast();
	useEffect(() => {
		bridge = toast;
		if (pending) {
			const next = pending;
			pending = null;
			present(toast, next);
		}
		return () => {
			if (bridge === toast) bridge = null;
		};
	}, [toast]);
	return null;
}
