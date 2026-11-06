import type { MapPrecision } from "./map-config";
import { Map as MapLibreMap, setWorkerUrl } from "maplibre-gl";
import { MAP_PICTURE, MAP_STYLES, MAP_WORKER_URL, mapZoom } from "./map-config";

const TIMEOUT_MS = 20_000;

/** Resolves on the map's next `idle` (everything drawn), or fails after a while (the map service is down). */
function settled(map: MapLibreMap): Promise<void> {
	return new Promise((resolve, reject) => {
		const timer = setTimeout(() => {
			map.off("idle", done);
			reject(new Error("The map didn't finish drawing."));
		}, TIMEOUT_MS);
		const done = () => {
			clearTimeout(timer);
			resolve();
		};
		// Missing tiles or glyphs log errors but still reach idle; only the timeout gives up.
		map.once("idle", done);
	});
}

function canvasBlob(canvas: HTMLCanvasElement): Promise<Blob> {
	return new Promise((resolve, reject) =>
		canvas.toBlob(
			(blob) => (blob ? resolve(blob) : reject(new Error("The map picture couldn't be made."))),
			"image/png",
		),
	);
}

/**
 * Draws the location map off screen, light then dark (`02-teknis.md` section 24), and returns both pictures as PNG.
 * No pin and no attribution: the page draws the pin in the accent colour and writes the attribution itself.
 */
export async function snapshotMap(point: { lat: number; lng: number }, precision: MapPrecision) {
	const container = document.createElement("div");
	Object.assign(container.style, {
		position: "fixed",
		left: "-10000px",
		top: "0",
		width: `${MAP_PICTURE.width}px`,
		height: `${MAP_PICTURE.height}px`,
		pointerEvents: "none",
	});
	container.setAttribute("aria-hidden", "true");
	document.body.append(container);
	setWorkerUrl(MAP_WORKER_URL);
	const map = new MapLibreMap({
		container,
		style: MAP_STYLES.light,
		center: [point.lng, point.lat],
		zoom: mapZoom(precision),
		interactive: false,
		attributionControl: false,
		pixelRatio: MAP_PICTURE.pixelRatio,
		fadeDuration: 0,
		renderWorldCopies: false,
		canvasContextAttributes: { preserveDrawingBuffer: true },
	});
	try {
		await settled(map);
		const light = await canvasBlob(map.getCanvas());
		map.setStyle(MAP_STYLES.dark, { diff: false });
		await new Promise<void>((resolve) => map.once("style.load", () => resolve()));
		await settled(map);
		const dark = await canvasBlob(map.getCanvas());
		return { light, dark };
	} finally {
		map.remove();
		container.remove();
	}
}
