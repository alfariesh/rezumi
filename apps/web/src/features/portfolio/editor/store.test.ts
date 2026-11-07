import type { PortfolioRecord } from "./store";
import type { PortfolioData } from "@rezumi/schema/portfolio/data";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { ORPCError } from "@orpc/client";
import { parsePortfolioData, writablePortfolioDataSchema } from "@rezumi/schema/portfolio/data";
import { PORTFOLIO_LIMITS, portfolioDataBytes } from "@rezumi/schema/portfolio/limits";

const mocks = vi.hoisted(() => ({ update: vi.fn(), get: vi.fn() }));
vi.mock("@/libs/orpc/client", () => ({ client: { portfolio: { update: mocks.update, get: mocks.get } } }));

const { PORTFOLIO_SAVE_DELAY_MS, usePortfolioEditorStore } = await import("./store");

const opened = new Date("2026-11-06T01:00:00.000Z");
const later = (ms: number) => new Date(opened.getTime() + ms);

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

/** What `portfolio.get` answers. */
const found = (portfolio: PortfolioRecord | null, enabled = true) => ({
	enabled,
	portfolio,
	limits: { works: 50, storageBytes: null, dataBytes: PORTFOLIO_LIMITS.dataBytes },
	usage: { works: 0, storageBytes: 0 },
});

const store = () => usePortfolioEditorStore.getState();

const type = (greeting: string) =>
	store().edit((draft) => {
		draft.hero.greeting = greeting;
	});

const greetingOf = (data: PortfolioData | undefined) => data?.hero.greeting;

/** The data the editor has open. */
function openedData(): PortfolioData {
	const data = store().portfolio?.data;
	if (!data) throw new Error("No portfolio is open.");
	return data;
}

/** Answers saves with the data they sent, at a new version each time. */
function acceptSaves(from = 1000) {
	let version = from;
	mocks.update.mockImplementation(({ data }: { data: PortfolioData }) => {
		version += 1000;
		return Promise.resolve(record({ data, updatedAt: later(version) }));
	});
}

function deferred<T>() {
	let resolve: (value: T) => void = vi.fn();
	let reject: (error: unknown) => void = vi.fn();
	const promise = new Promise<T>((accept, fail) => {
		resolve = accept;
		reject = fail;
	});
	return { promise, resolve, reject };
}

/** Every save can be given up: it's sent with an abort signal. */
const withSignal = { signal: expect.any(AbortSignal) };

const conflict = (updatedAt: Date) =>
	new ORPCError("PORTFOLIO_VERSION_CONFLICT", { status: 409, data: { updatedAt: updatedAt.toISOString() } });

beforeEach(() => {
	vi.resetAllMocks();
	store().load(record());
});

afterEach(() => {
	vi.useRealTimers();
	vi.unstubAllGlobals();
	store().reset();
});

describe("saving", () => {
	it("saves the data with the version it was opened at, then the new one", async () => {
		const saved = later(5 * 60_000);
		mocks.update.mockImplementation(({ data }) => Promise.resolve(record({ data, updatedAt: saved })));

		type("Hello");
		expect(store().status).toBe("saving");
		expect(await store().flush()).toBe(true);
		expect(mocks.update).toHaveBeenCalledWith(
			{
				data: expect.objectContaining({ hero: expect.objectContaining({ greeting: "Hello" }) }),
				expectedUpdatedAt: opened,
			},
			withSignal,
		);
		expect(store().status).toBe("saved");

		type("Hello there");
		await store().flush();
		expect(mocks.update).toHaveBeenLastCalledWith(expect.objectContaining({ expectedUpdatedAt: saved }), withSignal);
	});

	it("saves on its own once typing pauses", async () => {
		vi.useFakeTimers();
		acceptSaves();
		type("H");
		type("Hi");
		expect(mocks.update).not.toHaveBeenCalled();
		await vi.advanceTimersByTimeAsync(PORTFOLIO_SAVE_DELAY_MS);
		expect(mocks.update).toHaveBeenCalledTimes(1);
	});

	it("sends what was typed while a save was on its way, after it", async () => {
		const first = deferred<PortfolioRecord>();
		mocks.update.mockReturnValueOnce(first.promise).mockImplementation(({ data }) => Promise.resolve(record({ data })));
		type("One");
		const saving = store().flush();
		type("Two");
		first.resolve(record({ data: parsePortfolioData({ hero: { greeting: "One" } }) }));
		expect(await saving).toBe(true);
		expect(mocks.update).toHaveBeenCalledTimes(2);
		expect(greetingOf(mocks.update.mock.lastCall?.[0].data)).toBe("Two");
		expect(greetingOf(store().portfolio?.data)).toBe("Two");
	});

	it("lets every caller wait for the save on its way and what follows, then tell the real outcome", async () => {
		const first = deferred<PortfolioRecord>();
		const second = deferred<PortfolioRecord>();
		mocks.update.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);

		type("One");
		const byTimer = store().flush();
		type("Two"); // typed while that save is on its way
		let leftAt = -1;
		const leaving = store()
			.flush() // the route blocker, Publish or an import
			.then((saved) => {
				leftAt = mocks.update.mock.calls.length;
				return saved;
			});

		first.resolve(record({ updatedAt: later(1000) }));
		await vi.waitFor(() => expect(mocks.update).toHaveBeenCalledTimes(2));
		expect(leftAt).toBe(-1); // still waiting for "Two"
		second.resolve(record({ updatedAt: later(2000) }));

		expect(await leaving).toBe(true);
		expect(await byTimer).toBe(true);
		expect(leftAt).toBe(2);
		expect(store()).toMatchObject({ status: "saved", dirty: false });
		expect(store().portfolio?.updatedAt).toEqual(later(2000));
	});

	it("tells a waiting caller about a failure only once the save failed", async () => {
		const first = deferred<PortfolioRecord>();
		mocks.update.mockReturnValueOnce(first.promise);
		type("One");
		const byTimer = store().flush();
		const leaving = store().flush();
		first.reject(new TypeError("Failed to fetch"));
		expect(await leaving).toBe(false);
		expect(await byTimer).toBe(false);
		expect(store().status).toBe("error");
		expect(mocks.update).toHaveBeenCalledTimes(1);
	});

	it("keeps settings changed while a save was on its way: a save only moves the data's version", async () => {
		const first = deferred<PortfolioRecord>();
		mocks.update.mockReturnValueOnce(first.promise);
		type("One");
		const saving = store().flush();
		// Published meanwhile; the save's answer was made before that.
		store().applySettings(record({ isPublic: true, showInSearchEngines: false }));
		first.resolve(record({ isPublic: false, showInSearchEngines: true, updatedAt: later(1000) }));
		expect(await saving).toBe(true);
		expect(store().portfolio).toMatchObject({ isPublic: true, showInSearchEngines: false, updatedAt: later(1000) });
		expect(greetingOf(store().portfolio?.data)).toBe("One");
	});

	it("takes published and other settings without touching the data being edited", () => {
		type("Unsaved");
		store().applySettings(record({ isPublic: true, updatedAt: new Date("2030-01-01T00:00:00.000Z") }));
		expect(store().portfolio).toMatchObject({ isPublic: true, updatedAt: opened });
		expect(greetingOf(store().portfolio?.data)).toBe("Unsaved");
	});
});

describe("saves that may pass by themselves", () => {
	it("keep the edits and try again with growing pauses, and on Retry", async () => {
		vi.useFakeTimers();
		mocks.update.mockRejectedValue(new TypeError("Failed to fetch"));
		type("Hello");
		expect(await store().flush()).toBe(false);
		expect(store()).toMatchObject({ status: "error", dirty: true, retry: { attempt: 1, reason: "offline" } });

		await vi.advanceTimersByTimeAsync(2000);
		expect(mocks.update).toHaveBeenCalledTimes(2);
		expect(store().retry?.attempt).toBe(2);
		await vi.advanceTimersByTimeAsync(3999);
		expect(mocks.update).toHaveBeenCalledTimes(2);
		await vi.advanceTimersByTimeAsync(1);
		expect(mocks.update).toHaveBeenCalledTimes(3);

		acceptSaves();
		expect(await store().flush()).toBe(true);
		expect(store()).toMatchObject({ status: "saved", dirty: false, retry: null });
		await vi.advanceTimersByTimeAsync(60_000);
		expect(mocks.update).toHaveBeenCalledTimes(4);
	});

	it("try again as soon as the browser is back online", async () => {
		const browser = new EventTarget();
		vi.stubGlobal("window", browser);
		mocks.update.mockRejectedValueOnce(new TypeError("Failed to fetch"));
		type("Hello");
		expect(await store().flush()).toBe(false);

		acceptSaves();
		browser.dispatchEvent(new Event("online"));
		await vi.waitFor(() => expect(store().status).toBe("saved"));
		expect(mocks.update).toHaveBeenCalledTimes(2);
	});

	it("wait as long as a rate limit asks, edits included", async () => {
		vi.useFakeTimers();
		vi.setSystemTime(opened);
		mocks.update.mockRejectedValueOnce(
			new ORPCError("TOO_MANY_REQUESTS", { status: 429, data: { reset: opened.getTime() + 30_000 } }),
		);
		type("Hello");
		expect(await store().flush()).toBe(false);
		expect(store().retry).toMatchObject({ reason: "busy", at: opened.getTime() + 30_000 });

		acceptSaves();
		type("Hello again"); // waits with the retry instead of after the usual pause
		await vi.advanceTimersByTimeAsync(PORTFOLIO_SAVE_DELAY_MS);
		expect(mocks.update).toHaveBeenCalledTimes(1);
		await vi.advanceTimersByTimeAsync(30_000);
		expect(mocks.update).toHaveBeenCalledTimes(2);
		expect(greetingOf(mocks.update.mock.lastCall?.[0].data)).toBe("Hello again");
		expect(store().status).toBe("saved");
	});
});

describe("data the server won't take", () => {
	it("isn't sent: the schema's place is kept for saying where", async () => {
		type("x".repeat(500));
		expect(await store().flush()).toBe(false);
		expect(store().status).toBe("invalid");
		expect(store().problem).toEqual({ kind: "field", path: ["hero", "greeting"] });
		expect(mocks.update).not.toHaveBeenCalled();
	});

	it("isn't sent when it's over the size limit", async () => {
		const works = Array.from({ length: 30 }, (_, index) => ({
			id: `w${index}`,
			slug: `work-${index}`,
			title: `Work ${index}`,
			blocks: [{ id: `b${index}`, type: "text", html: `<p>${"x".repeat(9000)}</p>` }],
		}));
		const large = parsePortfolioData({ works: { items: works } });
		expect(writablePortfolioDataSchema.safeParse(large).success).toBe(true);
		expect(portfolioDataBytes(large)).toBeGreaterThan(PORTFOLIO_LIMITS.dataBytes);

		store().edit((draft) => {
			draft.works = large.works;
		});
		expect(await store().flush()).toBe(false);
		expect(store().problem).toMatchObject({ kind: "too-large", max: PORTFOLIO_LIMITS.dataBytes });
		expect(mocks.update).not.toHaveBeenCalled();
	});

	it("is shown with the server's reason and not sent again until it changes, even after undo", async () => {
		mocks.update.mockRejectedValueOnce(
			new ORPCError("PORTFOLIO_FILE_NOT_FOUND", { status: 400, data: { key: "uploads/u/pictures/portfolio/a.webp" } }),
		);
		type("Hello");
		expect(await store().flush()).toBe(false);
		expect(store()).toMatchObject({
			status: "invalid",
			dirty: true,
			problem: { kind: "file-missing", key: "uploads/u/pictures/portfolio/a.webp" },
		});
		expect(await store().flush()).toBe(false);
		expect(mocks.update).toHaveBeenCalledTimes(1);

		acceptSaves();
		type("Hello!");
		store().undo(); // back to the data the server refused
		expect(await store().flush()).toBe(false);
		expect(store().status).toBe("invalid");
		expect(mocks.update).toHaveBeenCalledTimes(1);

		store().redo();
		expect(await store().flush()).toBe(true);
		expect(mocks.update).toHaveBeenCalledTimes(2);
		expect(greetingOf(mocks.update.mock.lastCall?.[0].data)).toBe("Hello!");
	});

	it("says the server's reason again when undo brings the refused data back after another failure", async () => {
		const key = "uploads/u/pictures/portfolio/a.webp";
		mocks.update.mockRejectedValueOnce(new ORPCError("PORTFOLIO_FILE_NOT_FOUND", { status: 400, data: { key } }));
		type("Hello");
		expect(await store().flush()).toBe(false);

		mocks.update.mockRejectedValueOnce(new ORPCError("INTERNAL_SERVER_ERROR", { status: 500 }));
		type("Hello!");
		expect(await store().flush()).toBe(false);
		expect(store()).toMatchObject({ status: "error", problem: null });

		store().undo(); // back to the data the server refused
		expect(await store().flush()).toBe(false);
		expect(store()).toMatchObject({ status: "invalid", problem: { kind: "file-missing", key } });
		expect(mocks.update).toHaveBeenCalledTimes(2);
	});

	it("sends edits made while the refused save was on its way, which may fix it", async () => {
		const first = deferred<PortfolioRecord>();
		mocks.update.mockReturnValueOnce(first.promise);
		type("With a missing picture");
		const byTimer = store().flush();
		type("Fixed"); // typed while that save is on its way
		const next = store().flush(); // the next pause's save waits for it
		acceptSaves();
		first.reject(new ORPCError("PORTFOLIO_FILE_NOT_FOUND", { status: 400, data: { key: "k" } }));
		expect(await byTimer).toBe(false);
		expect(await next).toBe(true);
		expect(greetingOf(mocks.update.mock.lastCall?.[0].data)).toBe("Fixed");
		expect(store()).toMatchObject({ status: "saved", dirty: false, problem: null });
	});

	it("takes the place from the server's schema issues, or from the schema here", async () => {
		mocks.update.mockRejectedValueOnce(
			new ORPCError("BAD_REQUEST", {
				status: 400,
				data: { issues: [{ message: "Too long", path: ["data", "seo", { key: "title" }] }] },
			}),
		);
		type("Hello");
		await store().flush();
		expect(store().problem).toEqual({ kind: "field", path: ["seo", "title"] });

		mocks.update.mockRejectedValueOnce(new ORPCError("BAD_REQUEST", { status: 400 }));
		type("Hello again");
		await store().flush();
		expect(store().problem).toMatchObject({ kind: "refused" });
	});

	it("keeps any other refusal (a plan limit) to word it from its error", async () => {
		const refusal = new ORPCError("PLAN_LIMIT_REACHED", { status: 403 });
		mocks.update.mockRejectedValueOnce(refusal);
		type("Hello");
		expect(await store().flush()).toBe(false);
		expect(store()).toMatchObject({ status: "invalid", problem: { kind: "refused", error: refusal } });
	});
});

describe("a portfolio that's gone", () => {
	it.each([
		["NOT_FOUND", 404],
		["PORTFOLIO_DISABLED", 403],
	] as const)("stops saving after %s, keeping the edits", async (code, status) => {
		mocks.update.mockRejectedValueOnce(new ORPCError(code, { status }));
		type("Hello");
		expect(await store().flush()).toBe(false);
		expect(store()).toMatchObject({ status: "gone", dirty: true, problem: { kind: "gone", code } });

		type("Hello again");
		expect(store().status).toBe("gone");
		expect(await store().flush()).toBe(false);
		expect(mocks.update).toHaveBeenCalledTimes(1);
	});
});

describe("conflicts", () => {
	it("are taken quietly when the server holds what this editor sent (an answer that got lost)", async () => {
		mocks.update.mockRejectedValueOnce(new TypeError("Failed to fetch")); // saved, but the answer was lost
		type("Hello");
		expect(await store().flush()).toBe(false);

		const sent = mocks.update.mock.calls[0]?.[0].data as PortfolioData;
		mocks.update.mockRejectedValueOnce(conflict(later(1000)));
		mocks.get.mockResolvedValue(found(record({ data: sent, updatedAt: later(1000) })));
		acceptSaves(1000);
		expect(await store().flush()).toBe(true);

		expect(mocks.update).toHaveBeenCalledTimes(3);
		expect(mocks.update).toHaveBeenLastCalledWith(
			expect.objectContaining({ expectedUpdatedAt: later(1000) }),
			withSignal,
		);
		expect(store()).toMatchObject({ status: "saved", conflict: null });
	});

	it("are taken quietly when only the settings changed elsewhere, with those settings", async () => {
		const loaded = openedData();
		mocks.update.mockRejectedValueOnce(conflict(later(500)));
		mocks.get.mockResolvedValue(found(record({ data: loaded, isPublic: true, updatedAt: later(500) })));
		acceptSaves(500);
		type("Mine");
		expect(await store().flush()).toBe(true);
		expect(mocks.update).toHaveBeenLastCalledWith(
			expect.objectContaining({ expectedUpdatedAt: later(500) }),
			withSignal,
		);
		expect(store().portfolio).toMatchObject({ isPublic: true });
		expect(greetingOf(store().portfolio?.data)).toBe("Mine");
	});

	it("with other data stop saving, keep both copies and let this one be kept on top", async () => {
		const theirs = record({ data: parsePortfolioData({ hero: { greeting: "Theirs" } }), updatedAt: later(2000) });
		mocks.update.mockRejectedValueOnce(conflict(later(2000)));
		mocks.get.mockResolvedValue(found(theirs));
		type("Mine");
		expect(await store().flush()).toBe(false);
		expect(store()).toMatchObject({ status: "conflict", dirty: true, conflict: { server: theirs } });

		type("Still mine");
		expect(await store().flush()).toBe(false);
		expect(mocks.update).toHaveBeenCalledTimes(1);

		acceptSaves(2000);
		expect(await store().keepMine()).toBe(true);
		expect(mocks.update).toHaveBeenLastCalledWith(
			{
				data: expect.objectContaining({ hero: expect.objectContaining({ greeting: "Still mine" }) }),
				expectedUpdatedAt: later(2000),
			},
			withSignal,
		);
		expect(store()).toMatchObject({ status: "saved", conflict: null });
	});

	it("fall back to trying again when the other copy can't be compared, instead of saving forever", async () => {
		vi.spyOn(console, "error").mockImplementation(() => undefined);
		mocks.update.mockRejectedValueOnce(conflict(later(5000)));
		// Data the comparison can't read makes it throw.
		mocks.get.mockResolvedValueOnce(found(record({ data: null as never, updatedAt: later(5000) })));
		type("Hello");
		expect(await store().flush()).toBe(false);
		expect(store()).toMatchObject({ status: "error", dirty: true, retry: { attempt: 1, reason: "server" } });
	});

	it("can be reloaded from the other copy", async () => {
		mocks.update.mockRejectedValueOnce(conflict(later(2000)));
		mocks.get.mockResolvedValue(found(record({ data: parsePortfolioData({ hero: { greeting: "Theirs" } }) })));
		type("Mine");
		await store().flush();
		store().load(record({ data: parsePortfolioData({ hero: { greeting: "Theirs" } }), updatedAt: later(2000) }));
		expect(store()).toMatchObject({ status: "saved", dirty: false, conflict: null });
		expect(greetingOf(store().portfolio?.data)).toBe("Theirs");
	});

	it("name the other version from the error when it can't be read", async () => {
		mocks.update.mockRejectedValueOnce(conflict(later(3000)));
		mocks.get.mockRejectedValue(new TypeError("Failed to fetch"));
		type("Mine");
		expect(await store().flush()).toBe(false);
		expect(store().conflict).toEqual({ server: null, updatedAt: later(3000) });
	});

	it("say the portfolio is gone when it was deleted or switched off meanwhile", async () => {
		mocks.update.mockRejectedValueOnce(conflict(later(1000)));
		mocks.get.mockResolvedValueOnce(found(null));
		type("Mine");
		expect(await store().flush()).toBe(false);
		expect(store()).toMatchObject({ status: "gone", problem: { kind: "gone", code: "NOT_FOUND" } });

		store().load(record());
		mocks.update.mockRejectedValueOnce(conflict(later(1000)));
		mocks.get.mockResolvedValueOnce(found(null, false));
		type("Mine");
		expect(await store().flush()).toBe(false);
		expect(store().problem).toEqual({ kind: "gone", code: "PORTFOLIO_DISABLED" });
	});

	it("are asked about when the version keeps moving", async () => {
		const loaded = openedData();
		let version = 0;
		mocks.update.mockImplementation(() => Promise.reject(conflict(later((version += 1000)))));
		mocks.get.mockImplementation(() => Promise.resolve(found(record({ data: loaded, updatedAt: later(version) }))));
		type("Mine");
		expect(await store().flush()).toBe(false);
		expect(store().status).toBe("conflict");
		expect(mocks.update).toHaveBeenCalledTimes(3);
	});
});

describe("leaving", () => {
	it("sends edits still waiting for the pause, after the save on its way, with the version it made", async () => {
		const first = deferred<PortfolioRecord>();
		mocks.update.mockReturnValueOnce(first.promise).mockResolvedValue(record({ updatedAt: later(2000) }));
		type("One");
		const saving = store().flush();
		type("Two");
		store().close();
		expect(store().portfolio).toBeNull(); // the editor starts over at once

		first.resolve(record({ updatedAt: later(1000) }));
		await saving;
		await vi.waitFor(() => expect(mocks.update).toHaveBeenCalledTimes(2));
		expect(mocks.update).toHaveBeenLastCalledWith(
			{
				data: expect.objectContaining({ hero: expect.objectContaining({ greeting: "Two" }) }),
				expectedUpdatedAt: later(1000),
			},
			withSignal,
		);
	});

	it("drops edits whose save failed: leaving asked about them", async () => {
		mocks.update.mockRejectedValueOnce(new TypeError("Failed to fetch"));
		type("One");
		await store().flush();
		store().close();
		await Promise.resolve();
		expect(mocks.update).toHaveBeenCalledTimes(1);
		expect(store().portfolio).toBeNull();
	});
});

describe("undo and redo", () => {
	it("undoes typing in one field as one step, and other changes one by one", () => {
		acceptSaves();
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
		expect(greetingOf(store().portfolio?.data)).toBe("");
		expect(store().revision).toBe(revision + 2);

		store().redo();
		expect(greetingOf(store().portfolio?.data)).toBe("Hey");
		expect(store().dirty).toBe(true);
	});
});

describe("edits that belong to an earlier step", () => {
	it("add no undo step and travel with their step through Undo and Redo", () => {
		acceptSaves();
		const addPictures = () =>
			store().edit((draft) => void (draft.hero.availability.text = "Pictures"), { history: false });
		type("Bandung"); // the step the pictures belong to
		addPictures();
		expect(store().undoStack).toHaveLength(1);
		expect(store().dirty).toBe(true);

		store().undo();
		expect(store().portfolio?.data.hero.availability.text).toBe("");
		store().redo();
		expect(store().portfolio?.data.hero).toMatchObject({ greeting: "Bandung", availability: { text: "Pictures" } });
	});

	it("keep what can be redone", () => {
		acceptSaves();
		type("Bandung");
		store().undo();
		const redoable = store().redoStack;
		store().edit((draft) => void (draft.hero.availability.text = "Pictures"), { history: false });
		expect(store().redoStack).toBe(redoable);
		expect(store().undoStack).toHaveLength(0);
	});

	it("don't break up typing that merges into one step", () => {
		acceptSaves();
		store().edit((draft) => void (draft.hero.greeting = "H"), { key: "hero.greeting" });
		store().edit((draft) => void (draft.hero.availability.text = "Pictures"), { history: false });
		store().edit((draft) => void (draft.hero.greeting = "Hi"), { key: "hero.greeting" });
		expect(store().undoStack).toHaveLength(1);
	});
});

describe("changes the server saved", () => {
	it("takes works the server added as saved, and Undo goes back to before them", async () => {
		vi.useFakeTimers();
		acceptSaves(5000);
		const before = store().portfolio?.data;
		const imported = parsePortfolioData({
			works: { items: [{ id: "w1", slug: "kopi", title: "Kopi", fromResumeItemId: "p1" }] },
		});
		const savedAt = later(1000);
		const revision = store().revision;
		store().applyServerEdit(record({ data: imported, updatedAt: savedAt }));
		expect(store()).toMatchObject({ status: "saved", dirty: false, revision: revision + 1 });
		expect(store().portfolio?.updatedAt).toEqual(savedAt);
		expect(store().portfolio?.data.works.items).toHaveLength(1);

		store().undo();
		expect(store().portfolio?.data).toEqual(before);
		await vi.advanceTimersByTimeAsync(PORTFOLIO_SAVE_DELAY_MS);
		// The undo saves against the version the server returned, so it isn't a conflict.
		expect(mocks.update).toHaveBeenLastCalledWith({ data: before, expectedUpdatedAt: savedAt }, withSignal);
	});
});
