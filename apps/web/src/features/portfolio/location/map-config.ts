import type { PORTFOLIO_MAP_PRECISIONS } from "@rezumi/schema/portfolio/data";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?url";
import { PORTFOLIO_MAP_ZOOM } from "@rezumi/schema/portfolio/data";

/**
 * OpenFreeMap's public styles (`02-teknis.md` section 24): no key, no account. Only the editor loads them; the public
 * page shows the pictures the editor saved.
 */
export const MAP_STYLES = {
	light: "https://tiles.openfreemap.org/styles/positron",
	dark: "https://tiles.openfreemap.org/styles/dark",
} as const;

/** MapLibre's worker from the app's own assets (CSP `worker-src 'self' blob:`), not from a CDN. */
export const MAP_WORKER_URL = workerUrl;

export type MapPrecision = (typeof PORTFOLIO_MAP_PRECISIONS)[number];

export const mapZoom = (precision: MapPrecision) => PORTFOLIO_MAP_ZOOM[precision];

/** The saved picture: the card's 5:3 shape at twice its usual 400 px width, so labels stay sharp. */
export const MAP_PICTURE = { width: 400, height: 240, pixelRatio: 2 } as const;
