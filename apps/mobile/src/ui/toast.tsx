// Toasts: HeroUI's toast region (hosted by HeroUINativeProvider), like the web's: bottom, one visible at a time, six
// seconds by default, Undo as the optional action. A reversible action shows a toast with Undo instead of asking
// first. Screens call `useAppToast().show(...)`; code outside components (mutation callbacks, the API client) calls
// `showToast(...)`, which reaches the region through `ToastBridge`, mounted once at the root.
import type { ToastManager } from "heroui-native";
import { useToast } from "heroui-native";
import { useEffect, useMemo, useSyncExternalStore } from "react";
import { AccessibilityInfo, Platform } from "react-native";
import { haptics } from "./motion";

// The bottom bars showing now (the phone tab bar, the editor's pane bar) by source, with their heights: toasts sit
// above the tallest, so an Undo never covers a tab.
const bottomBars = new Map<string, number>();
let barHeight = 0;
const barListeners = new Set<() => void>();

/**
 * A bottom bar reports its laid-out height (bottom safe area included) under its own name, and 0 when it hides, is
 * covered by another screen or unmounts.
 */
export function setToastBarHeight(source: string, height: number) {
	const value = Math.max(0, Math.round(height));
	if (value > 0) bottomBars.set(source, value);
	else bottomBars.delete(source);
	const next = Math.max(0, ...bottomBars.values());
	if (next === barHeight) return;
	barHeight = next;
	for (const listener of barListeners) listener();
}

/** The bottom bar height toasts clear, 0 while no bar shows. */
export function useToastBarHeight(): number {
	return useSyncExternalStore(
		(listener) => {
			barListeners.add(listener);
			return () => barListeners.delete(listener);
		},
		() => barHeight,
	);
}

/**
 * The toasts' distance from the bottom edge: 12 pt above a bottom bar while one shows, otherwise HeroUI's own default
 * above the home indicator. HeroUI's region and the legacy Toaster both use it, so the two never sit apart.
 */
export function toastBottomOffset(bar: number, safeBottom: number): number {
	return bar > 0 ? bar + 12 : safeBottom + (Platform.OS === "ios" ? 6 : 12);
}

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

/** How long a toast of `duration` stays up: doubled with a screen reader on. Undo timers wait this long. */
export function toastLifetime(duration = defaultDuration): number {
	return duration * (screenReader ? 2 : 1);
}

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
		duration: toastLifetime(duration),
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
