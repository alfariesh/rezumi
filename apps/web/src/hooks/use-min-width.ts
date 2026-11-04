import { useSyncExternalStore } from "react";

/**
 * Whether the window is at least `px` wide, following resizes. For layouts that switch at a width the shared
 * breakpoints (`useBreakpoint`, up to 1280px) don't name.
 */
export function useMinWidth(px: number) {
	const query = `(min-width: ${px}px)`;
	return useSyncExternalStore(
		(onChange) => {
			if (typeof window === "undefined" || typeof window.matchMedia !== "function") return () => {};
			const list = window.matchMedia(query);
			list.addEventListener("change", onChange);
			return () => list.removeEventListener("change", onChange);
		},
		() => typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia(query).matches,
		() => false,
	);
}
