import type { PortfolioRecord } from "./store";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { ORPCError } from "@orpc/client";
import { parsePortfolioData } from "@rezumi/schema/portfolio/data";

const mocks = vi.hoisted(() => ({ update: vi.fn() }));
vi.mock("@/libs/orpc/client", () => ({ client: { portfolio: { update: mocks.update } } }));

const { PORTFOLIO_SAVE_DELAY_MS, usePortfolioEditorStore } = await import("./store");

const opened = new Date("2026-11-06T01:00:00.000Z");

const record = (patch: Partial<PortfolioRecord> = {}): PortfolioRecord => ({
	id: "portfolio",
	sourceResumeId: null,
	sourceResume: null,
	isPublic: false,
	showInSearchEngines: true,
	publishedAt: null,
	suspendedAt: null,
	suspendedReason: null,
	data: parsePortfolioData({}),
	createdAt: opened,
	updatedAt: opened,
	...patch,
});

const store = () => usePortfolioEditorStore.getState();

function deferred<T>() {
	let resolve: (value: T) => void = vi.fn();
	let reject: (error: unknown) => void = vi.fn();
	const promise = new Promise<T>((accept, fail) => {
		resolve = accept;
		reject = fail;
	});
	return { promise, resolve, reject };
}

beforeEach(() => {
	vi.resetAllMocks();
	store().load(record());
});

afterEach(() => {
	vi.useRealTimers();
	store().reset();
});

describe("saving", () => {
	it("saves the data with the version it was opened at, then the new one", async () => {
		const saved = new Date("2026-11-06T01:05:00.000Z");
		mocks.update.mockImplementation(({ data }) => Promise.resolve(record({ data, updatedAt: saved })));

		store().edit((draft) => {
			draft.hero.greeting = "Hello";
		});
		expect(store().status).toBe("saving");
		expect(await store().flush()).toBe(true);
		expect(mocks.update).toHaveBeenCalledWith({
			data: expect.objectContaining({ hero: expect.objectContaining({ greeting: "Hello" }) }),
			expectedUpdatedAt: opened,
		});
		expect(store().status).toBe("saved");

		store().edit((draft) => {
			draft.hero.greeting = "Hello there";
		});
		await store().flush();
		expect(mocks.update).toHaveBeenLastCalledWith(expect.objectContaining({ expectedUpdatedAt: saved }));
	});

	it("saves on its own once typing pauses", async () => {
		vi.useFakeTimers();
		mocks.update.mockImplementation(({ data }) => Promise.resolve(record({ data })));
		store().edit((draft) => {
			draft.hero.greeting = "H";
		});
		store().edit((draft) => {
			draft.hero.greeting = "Hi";
		});
		expect(mocks.update).not.toHaveBeenCalled();
		await vi.advanceTimersByTimeAsync(PORTFOLIO_SAVE_DELAY_MS);
		expect(mocks.update).toHaveBeenCalledTimes(1);
	});

	it("sends what was typed while a save was on its way, after it", async () => {
		const first = deferred<PortfolioRecord>();
		mocks.update.mockReturnValueOnce(first.promise).mockImplementation(({ data }) => Promise.resolve(record({ data })));
		store().edit((draft) => {
			draft.hero.greeting = "One";
		});
		const saving = store().flush();
		store().edit((draft) => {
			draft.hero.greeting = "Two";
		});
		first.resolve(record({ data: parsePortfolioData({ hero: { greeting: "One" } }) }));
		expect(await saving).toBe(true);
		expect(mocks.update).toHaveBeenCalledTimes(2);
		expect(mocks.update.mock.lastCall?.[0].data.hero.greeting).toBe("Two");
		expect(store().portfolio?.data.hero.greeting).toBe("Two");
	});

	it("stops on a conflict and keeps the edits, so neither copy overwrites the other", async () => {
		mocks.update.mockRejectedValue(
			new ORPCError("PORTFOLIO_VERSION_CONFLICT", { status: 409, data: { updatedAt: new Date().toISOString() } }),
		);
		store().edit((draft) => {
			draft.hero.greeting = "Mine";
		});
		expect(await store().flush()).toBe(false);
		expect(store().status).toBe("conflict");
		expect(store().dirty).toBe(true);

		store().edit((draft) => {
			draft.hero.greeting = "Still mine";
		});
		expect(await store().flush()).toBe(false);
		expect(mocks.update).toHaveBeenCalledTimes(1);

		// Reloading takes the other copy and saving starts again from it.
		store().load(record({ data: parsePortfolioData({ hero: { greeting: "Theirs" } }) }));
		expect(store().status).toBe("saved");
		expect(store().portfolio?.data.hero.greeting).toBe("Theirs");
	});

	it("keeps the edits for Retry after another failure", async () => {
		mocks.update.mockRejectedValueOnce(new Error("offline"));
		store().edit((draft) => {
			draft.hero.greeting = "Hello";
		});
		expect(await store().flush()).toBe(false);
		expect(store().status).toBe("error");
		mocks.update.mockImplementation(({ data }) => Promise.resolve(record({ data })));
		expect(await store().flush()).toBe(true);
		expect(store().status).toBe("saved");
	});

	it("sends nothing the server would refuse, and says why", async () => {
		store().edit((draft) => {
			draft.hero.greeting = "x".repeat(500);
		});
		expect(await store().flush()).toBe(false);
		expect(store().status).toBe("invalid");
		expect(store().problem).toBeTruthy();
		expect(mocks.update).not.toHaveBeenCalled();
	});

	it("takes published and other settings without touching the data being edited", () => {
		store().edit((draft) => {
			draft.hero.greeting = "Unsaved";
		});
		store().applySettings(record({ isPublic: true, updatedAt: new Date("2030-01-01T00:00:00.000Z") }));
		expect(store().portfolio).toMatchObject({ isPublic: true, updatedAt: opened });
		expect(store().portfolio?.data.hero.greeting).toBe("Unsaved");
	});
});

describe("undo and redo", () => {
	it("undoes typing in one field as one step, and other changes one by one", () => {
		mocks.update.mockImplementation(({ data }) => Promise.resolve(record({ data })));
		const revision = store().revision;
		for (const text of ["H", "He", "Hey"])
			store().edit(
				(draft) => {
					draft.hero.greeting = text;
				},
				{ key: "hero.greeting" },
			);
		store().edit((draft) => {
			draft.hero.showPicture = false;
		});
		expect(store().undoStack).toHaveLength(2);

		store().undo();
		expect(store().portfolio?.data.hero).toMatchObject({ greeting: "Hey", showPicture: true });
		store().undo();
		expect(store().portfolio?.data.hero.greeting).toBe("");
		expect(store().revision).toBe(revision + 2);

		store().redo();
		expect(store().portfolio?.data.hero.greeting).toBe("Hey");
		expect(store().dirty).toBe(true);
	});
});

describe("changes the server saved", () => {
	it("takes works the server added as saved, and Undo goes back to before them", async () => {
		vi.useFakeTimers();
		mocks.update.mockImplementation(({ data }) =>
			Promise.resolve(record({ data, updatedAt: new Date(opened.getTime() + 5000) })),
		);
		const before = store().portfolio?.data;
		const imported = parsePortfolioData({
			works: { items: [{ id: "w1", slug: "kopi", title: "Kopi", fromResumeItemId: "p1" }] },
		});
		const savedAt = new Date(opened.getTime() + 1000);
		const revision = store().revision;
		store().applyServerEdit(record({ data: imported, updatedAt: savedAt }));
		expect(store()).toMatchObject({ status: "saved", dirty: false, revision: revision + 1 });
		expect(store().portfolio?.updatedAt).toEqual(savedAt);
		expect(store().portfolio?.data.works.items).toHaveLength(1);

		store().undo();
		expect(store().portfolio?.data).toEqual(before);
		await vi.advanceTimersByTimeAsync(PORTFOLIO_SAVE_DELAY_MS);
		// The undo saves against the version the server returned, so it isn't a conflict.
		expect(mocks.update).toHaveBeenLastCalledWith({ data: before, expectedUpdatedAt: savedAt });
	});
});
