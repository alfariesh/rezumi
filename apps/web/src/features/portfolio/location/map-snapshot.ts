import type { MapPrecision } from "./map-config";
import { Map as MapLibreMap, setWorkerUrl } from "maplibre-gl";
import { MAP_PICTURE, MAP_STYLES, MAP_WORKER_URL, mapZoom } from "./map-config";
import { mapEvent, snapshotCancelled } from "./map-events";

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
 * No pin and no attribution: the page draws the pin in the accent colour and writes the attribution itself. Gives up
 * after a while at each step, or when `signal` aborts, and always removes the map.
 */
export async function snapshotMap(point: { lat: number; lng: number }, precision: MapPrecision, signal?: AbortSignal) {
	if (signal?.aborted) throw snapshotCancelled();
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
		await mapEvent(map, "idle", signal);
		const light = await canvasBlob(map.getCanvas());
		const styled = mapEvent(map, "style.load", signal);
		map.setStyle(MAP_STYLES.dark, { diff: false });
		await styled;
		await mapEvent(map, "idle", signal);
		const dark = await canvasBlob(map.getCanvas());
		return { light, dark };
	} finally {
		map.remove();
		container.remove();
	}
}
