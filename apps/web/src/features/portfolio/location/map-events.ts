import type { Map as MapLibreMap } from "maplibre-gl";

const TIMEOUT_MS = 20_000;

/** The reason a cancelled map picture stops with. */
export const snapshotCancelled = () => new DOMException("The map picture was cancelled.", "AbortError");

/**
 * Resolves on the map's next `event` (`idle`: everything drawn; `style.load`: a new style is in), or fails after a
 * while (the map service is down) or when `signal` aborts. Missing tiles or glyphs log errors but still reach `idle`.
 */
export function mapEvent(
	map: Pick<MapLibreMap, "once" | "off">,
	event: "idle" | "style.load",
	signal?: AbortSignal,
	timeoutMs = TIMEOUT_MS,
): Promise<void> {
	return new Promise((resolve, reject) => {
		if (signal?.aborted) {
			reject(snapshotCancelled());
			return;
		}
		const finish = (error?: Error) => {
			clearTimeout(timer);
			map.off(event, done);
			signal?.removeEventListener("abort", abort);
			if (error) reject(error);
			else resolve();
		};
		const done = () => finish();
		const abort = () => finish(snapshotCancelled());
		const timer = setTimeout(() => finish(new Error("The map didn't finish drawing.")), timeoutMs);
		signal?.addEventListener("abort", abort, { once: true });
		map.once(event, done);
	});
}
