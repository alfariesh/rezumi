import type { PortfolioRecord } from "../editor/store";
import type { PortfolioData } from "@rezumi/schema/portfolio/data";
import type { PortfolioImage } from "@rezumi/schema/portfolio/files";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { produce } from "immer";
import { parsePortfolioData } from "@rezumi/schema/portfolio/data";
import { mapEvent } from "./map-events";

const mocks = vi.hoisted(() => ({ update: vi.fn(), deleteFile: vi.fn() }));
vi.mock("@/libs/orpc/client", () => ({
	client: { portfolio: { update: mocks.update, deleteFile: mocks.deleteFile } },
}));

const { usePortfolioEditorStore } = await import("../editor/store");
const {
	createMapPictureMaker,
	MAP_PICTURE_DELAY_MS,
	mapPictureNeeded,
	mapPictureSignature,
	setLocationPoint,
	useMapPictureStatus,
} = await import("./map-pictures");

const picture = (name: string): PortfolioImage => ({
	key: `uploads/u1/pictures/portfolio/${name}.png`,
	width: 800,
	height: 480,
	alt: "",
});

const record = (data: PortfolioData): PortfolioRecord => ({
	id: "portfolio",
	sourceResumeId: null,
	sourceResume: null,
	isPublic: false,
	showInSearchEngines: true,
	publishedAt: null,
	suspendedAt: null,
	suspendedReason: null,
	data,
	createdAt: new Date(0),
	updatedAt: new Date(0),
});

const bandung = { lat: -6.92, lng: 107.61, precision: "city" as const };
const westJava = { lat: -6.6, lng: 107.15, precision: "region" as const };

const store = () => usePortfolioEditorStore.getState();
const location = () => store().portfolio?.data.location;
const moveTo = (point: typeof bandung | typeof westJava) =>
	store().edit((draft) => setLocationPoint(draft.location, point, "Somewhere"));

/** Waits for promises queued by the maker (fake timers don't run them). */
const settle = () => vi.advanceTimersByTimeAsync(0);

let maker: ReturnType<typeof createMapPictureMaker>;

beforeEach(() => {
	vi.useFakeTimers();
	mocks.update.mockImplementation(({ data }: { data: PortfolioData }) => Promise.resolve(record(data)));
	mocks.deleteFile.mockResolvedValue(undefined);
	store().load(
		record(
			produce(parsePortfolioData({}), (draft) => {
				draft.location.point = bandung;
				draft.location.showMap = true;
			}),
		),
	);
});

afterEach(() => {
	maker?.stop();
	store().reset();
	vi.useRealTimers();
	vi.clearAllMocks();
});

describe("which map pictures the data needs", () => {
	it("needs pictures while the map is on, at a point, without pictures", () => {
		const base = { showMap: true, point: bandung };
		expect(mapPictureNeeded(base)).toBe(true);
		expect(mapPictureNeeded({ ...base, map: { light: picture("l"), dark: picture("d") } })).toBe(false);
		expect(mapPictureNeeded({ ...base, showMap: false })).toBe(false);
		expect(mapPictureNeeded({ showMap: true })).toBe(false);
		expect(mapPictureSignature(base)).toBe("-6.92,107.61,city");
	});

	it("drops a place's pictures in the same edit that moves it, so old pictures never stay", () => {
		const data = produce(parsePortfolioData({}), (draft) => {
			draft.location.point = bandung;
			draft.location.showMap = true;
			draft.location.map = { light: picture("l"), dark: picture("d") };
		});
		const moved = produce(data, (draft) => setLocationPoint(draft.location, westJava, "West Java, Indonesia"));
		expect(moved.location).toMatchObject({ point: westJava, label: "West Java, Indonesia" });
		expect(moved.location.map).toBeUndefined();
	});
});

describe("the map picture maker", () => {
	it("makes the pictures the data needs, without an undo step of their own", async () => {
		const make = vi.fn(async () => ({ light: picture("light"), dark: picture("dark") }));
		maker = createMapPictureMaker(make);
		moveTo(westJava);
		const undoDepth = store().undoStack.length;
		maker.watch();
		expect(useMapPictureStatus.getState().working).toBe("-6.6,107.15,region");
		await vi.advanceTimersByTimeAsync(MAP_PICTURE_DELAY_MS);
		expect(make).toHaveBeenCalledWith({ ...westJava }, "region", expect.any(AbortSignal));
		expect(location()?.map).toEqual({ light: picture("light"), dark: picture("dark") });
		expect(store().undoStack).toHaveLength(undoDepth);
		expect(useMapPictureStatus.getState().working).toBeNull();
	});

	it("goes back to the old place with its own pictures on Undo, and Redo keeps the new ones", async () => {
		let count = 0;
		maker = createMapPictureMaker(async () => {
			count += 1;
			return { light: picture(`light-${count}`), dark: picture(`dark-${count}`) };
		});
		maker.watch();
		await vi.advanceTimersByTimeAsync(MAP_PICTURE_DELAY_MS);
		const bandungMap = location()?.map;
		expect(bandungMap?.light.key).toContain("light-1");

		moveTo(westJava);
		await vi.advanceTimersByTimeAsync(MAP_PICTURE_DELAY_MS);
		expect(location()?.map?.light.key).toContain("light-2");

		store().undo();
		expect(location()).toMatchObject({ point: bandung, map: bandungMap });
		store().redo();
		await vi.advanceTimersByTimeAsync(MAP_PICTURE_DELAY_MS);
		expect(location()?.point).toEqual(westJava);
		expect(location()?.map?.light.key).toContain("light-2");
		expect(count).toBe(2);
	});

	it("drops pictures made for a place that changed meanwhile, and deletes them", async () => {
		let finish: (pictures: { light: PortfolioImage; dark: PortfolioImage }) => void = () => undefined;
		const signals: AbortSignal[] = [];
		maker = createMapPictureMaker(
			(_point, _precision, signal) =>
				new Promise((resolve) => {
					signals.push(signal);
					finish = resolve;
				}),
		);
		maker.watch();
		await vi.advanceTimersByTimeAsync(MAP_PICTURE_DELAY_MS);
		moveTo(westJava);
		expect(signals[0]?.aborted).toBe(true);
		finish({ light: picture("stale-light"), dark: picture("stale-dark") });
		await settle();
		expect(location()?.map).toBeUndefined();
		expect(mocks.deleteFile.mock.calls.map(([input]) => input.key)).toEqual([
			picture("stale-light").key,
			picture("stale-dark").key,
		]);
	});

	it("keeps working after the location form closes, and stops when the editor leaves", async () => {
		const signals: AbortSignal[] = [];
		maker = createMapPictureMaker(
			(_point, _precision, signal) =>
				new Promise(() => {
					signals.push(signal);
				}),
		);
		maker.watch();
		await vi.advanceTimersByTimeAsync(MAP_PICTURE_DELAY_MS);
		expect(signals).toHaveLength(1);
		store().reset();
		expect(signals[0]?.aborted).toBe(true);
	});

	it("doesn't try a failed place again on its own; Try again does", async () => {
		const make = vi.fn().mockRejectedValueOnce(new Error("The map didn't finish drawing."));
		make.mockResolvedValue({ light: picture("light"), dark: picture("dark") });
		maker = createMapPictureMaker(make);
		maker.watch();
		await vi.advanceTimersByTimeAsync(MAP_PICTURE_DELAY_MS);
		expect(useMapPictureStatus.getState().failed).toEqual(["-6.92,107.61,city"]);
		await vi.advanceTimersByTimeAsync(MAP_PICTURE_DELAY_MS * 3);
		expect(make).toHaveBeenCalledTimes(1);
		maker.retry();
		await vi.advanceTimersByTimeAsync(MAP_PICTURE_DELAY_MS);
		expect(make).toHaveBeenCalledTimes(2);
		expect(location()?.map?.light).toEqual(picture("light"));
		expect(useMapPictureStatus.getState().failed).toEqual([]);
	});
});

describe("mapEvent", () => {
	const fakeMap = () => {
		const listeners = new Map<string, () => void>();
		return {
			listeners,
			once: vi.fn((event: string, listener: () => void) => listeners.set(event, listener)),
			off: vi.fn((event: string) => listeners.delete(event)),
		};
	};

	it("waits for the event", async () => {
		const map = fakeMap();
		const waiting = mapEvent(map as never, "style.load");
		map.listeners.get("style.load")?.();
		await expect(waiting).resolves.toBeUndefined();
	});

	it("gives up after a while when the map service never answers (the dark style too)", async () => {
		const map = fakeMap();
		const waiting = mapEvent(map as never, "style.load", undefined, 1000);
		const failed = expect(waiting).rejects.toThrow("The map didn't finish drawing.");
		await vi.advanceTimersByTimeAsync(1000);
		await failed;
		expect(map.off).toHaveBeenCalledWith("style.load", expect.any(Function));
	});

	it("stops when it's cancelled", async () => {
		const map = fakeMap();
		const controller = new AbortController();
		const waiting = mapEvent(map as never, "idle", controller.signal);
		controller.abort();
		await expect(waiting).rejects.toMatchObject({ name: "AbortError" });
	});
});
