import type { MapPrecision } from "./map-config";
import type { PortfolioLocation } from "@rezumi/schema/portfolio/data";
import type { PortfolioImage } from "@rezumi/schema/portfolio/files";
import type { Draft } from "immer";
import { create } from "zustand/react";
import { usePortfolioEditorStore } from "../editor/store";
import { discardUploadedImages, isAbort, uploadPortfolioImage } from "../images/upload";

/**
 * The location card's map pictures (`02-teknis.md` section 24) follow one rule, so saved data alone says whether a
 * picture must be made: every edit that changes the point, its precision or turns the map on removes `location.map`
 * in the same edit (`setLocationPoint`). A picture in the data is then always the one of its point, also after Undo
 * and Redo, and a location that shows a map without a picture needs one.
 */

/** Waits this long after the last change of place before making pictures, so a dragged pin makes them once. */
export const MAP_PICTURE_DELAY_MS = 1200;

/** Whether the data needs new map pictures: the map is on, there's a point, and it has no pictures yet. */
export function mapPictureNeeded(location: Pick<PortfolioLocation, "showMap" | "point" | "map">): boolean {
	return location.showMap && Boolean(location.point) && !location.map;
}

/** The place a map picture shows (its point and precision), while the map is on; null otherwise. */
export function mapPictureSignature(location: Pick<PortfolioLocation, "showMap" | "point">): string | null {
	const { point } = location;
	return location.showMap && point ? `${point.lat},${point.lng},${point.precision}` : null;
}

/** Moves the location to another point (or precision) and, in the same edit, drops the pictures of the old one. */
export function setLocationPoint(
	location: Draft<PortfolioLocation>,
	point: { lat: number; lng: number; precision: MapPrecision },
	label?: string,
): void {
	location.point = { lat: point.lat, lng: point.lng, precision: point.precision };
	if (label !== undefined) location.label = label;
	delete location.map;
}

type MapPictureStatus = {
	/** The place pictures are being made for, if any. */
	working: string | null;
	/** Places whose pictures failed in this visit; they're made again only on `retry`. */
	failed: readonly string[];
};

export const useMapPictureStatus = create<MapPictureStatus>()(() => ({ working: null, failed: [] }));

/**
 * Puts the pictures into the data without an undo step of their own: they belong to the place they show, whose change
 * was the step. Undo and Redo then move between places with their pictures, and what could be redone stays.
 */
function addPictures(map: { light: PortfolioImage; dark: PortfolioImage }) {
	usePortfolioEditorStore.getState().edit(
		(draft) => {
			draft.location.map = map;
		},
		{ history: false },
	);
}

type MakePictures = (
	point: { lat: number; lng: number },
	precision: MapPrecision,
	signal: AbortSignal,
) => Promise<{ light: PortfolioImage; dark: PortfolioImage }>;

/** Draws both pictures off screen and uploads them; an upload that made it is deleted when the other one failed. */
const makeAndUpload: MakePictures = async (point, precision, signal) => {
	const { snapshotMap } = await import("./map-snapshot");
	const shots = await snapshotMap(point, precision, signal);
	const uploads = await Promise.allSettled([
		uploadPortfolioImage(new File([shots.light], "map-light.png", { type: "image/png" }), { signal }),
		uploadPortfolioImage(new File([shots.dark], "map-dark.png", { type: "image/png" }), { signal }),
	]);
	const [light, dark] = uploads;
	if (light?.status === "fulfilled" && dark?.status === "fulfilled") return { light: light.value, dark: dark.value };
	void discardUploadedImages(uploads.flatMap((upload) => (upload.status === "fulfilled" ? [upload.value] : [])));
	throw uploads.find((upload) => upload.status === "rejected")?.reason;
};

type Job = { place: string; session: string; controller: AbortController };

/**
 * Makes the map pictures the data needs, whatever part of the editor is open: it follows the editor's data, not the
 * location form, so pictures still arrive after the form closes, and after Undo or Redo brought back a place without
 * them. A place that changes meanwhile cancels the pictures on their way (uploads that made it are deleted).
 */
export function createMapPictureMaker(make: MakePictures = makeAndUpload, delay = MAP_PICTURE_DELAY_MS) {
	let job: Job | null = null;
	let waiting: { place: string; session: string; timer: ReturnType<typeof setTimeout> } | null = null;
	let unsubscribe: (() => void) | null = null;
	const failedKey = (session: string, place: string) => `${session}|${place}`;
	const failures = new Set<string>();

	const publish = () => {
		const prefix = failedKey(usePortfolioEditorStore.getState().sessionId, "");
		useMapPictureStatus.setState({
			working: job?.place ?? waiting?.place ?? null,
			failed: [...failures].filter((key) => key.startsWith(prefix)).map((key) => key.slice(prefix.length)),
		});
	};

	const wanted = () => {
		const state = usePortfolioEditorStore.getState();
		const location = state.portfolio?.data.location;
		const place = location && mapPictureNeeded(location) ? mapPictureSignature(location) : null;
		return { place, session: state.sessionId, point: location?.point };
	};

	const run = async (place: string, session: string) => {
		const current = wanted();
		if (current.place !== place || current.session !== session || !current.point) return;
		const point = current.point;
		const controller = new AbortController();
		job = { place, session, controller };
		publish();
		try {
			const pictures = await make(point, point.precision, controller.signal);
			const now = wanted();
			if (controller.signal.aborted || now.place !== place || now.session !== session) {
				void discardUploadedImages([pictures.light, pictures.dark]);
				return;
			}
			addPictures(pictures);
		} catch (error) {
			if (!isAbort(error, controller.signal)) failures.add(failedKey(session, place));
		} finally {
			if (job?.controller === controller) job = null;
			publish();
			sync();
		}
	};

	/** Compares what the data needs with what's on its way, after every change of the editor's data. */
	function sync() {
		const { place, session } = wanted();
		if (job && (job.place !== place || job.session !== session)) {
			job.controller.abort();
			job = null;
		}
		if (waiting && (waiting.place !== place || waiting.session !== session)) {
			clearTimeout(waiting.timer);
			waiting = null;
		}
		if (place && !job && !waiting && !failures.has(failedKey(session, place))) {
			const timer = setTimeout(() => {
				waiting = null;
				void run(place, session);
			}, delay);
			waiting = { place, session, timer };
		}
		const status = useMapPictureStatus.getState();
		if (status.working !== (job?.place ?? waiting?.place ?? null)) publish();
	}

	return {
		/** Starts following the editor's data; again does nothing. */
		watch() {
			unsubscribe ??= usePortfolioEditorStore.subscribe(() => sync());
			sync();
		},
		/** Tries the current place again after its pictures failed. */
		retry() {
			const { place, session } = wanted();
			if (place) failures.delete(failedKey(session, place));
			publish();
			sync();
		},
		/** Stops following and cancels what's on its way (tests). */
		stop() {
			unsubscribe?.();
			unsubscribe = null;
			job?.controller.abort();
			job = null;
			if (waiting) clearTimeout(waiting.timer);
			waiting = null;
			failures.clear();
			publish();
		},
	};
}

/** The editor's one map picture maker. */
export const mapPictures = createMapPictureMaker();
