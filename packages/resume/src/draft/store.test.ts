import type { DraftAdapter, DraftEnvironment } from "./store";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { MAX_HISTORY_ENTRIES } from "./history";
import { createDraftStore } from "./store";

type Doc = { id: string; name: string; isLocked: boolean; version: number; data: { text: string; items: string[] } };

class ConflictError extends Error {}

/** An in-memory server with the version check the API applies to resumes. */
function createServer(initial: Doc[]) {
	const documents = new Map(initial.map((document) => [document.id, structuredClone(document)]));
	const saves: { id: string; text: string; force: boolean; scope: string }[] = [];
	const copies: { text: string; scope: string }[] = [];
	let failNext: "network" | "lost-response" | null = null;
	let gate: Promise<void> | null = null;
	return {
		/** Holds the next save's response until the returned function runs. */
		holdNextSave: () => {
			let release = () => {};
			gate = new Promise((resolve) => {
				release = resolve;
			});
			return release;
		},
		documents,
		saves,
		copies,
		failNextSave: (kind: "network" | "lost-response") => {
			failNext = kind;
		},
		edit: (id: string, change: Partial<Doc>) => {
			const current = documents.get(id);
			if (!current) throw new Error("missing");
			documents.set(id, { ...current, ...structuredClone(change), version: current.version + 1 });
		},
		read: async (id: string) => {
			const document = documents.get(id);
			if (!document) throw new Error("not found");
			return structuredClone(document);
		},
		save: async (document: Doc, baseline: Doc, force: boolean, scope: string) => {
			if (failNext === "network") {
				failNext = null;
				throw new Error("Network request failed");
			}
			const current = documents.get(document.id);
			if (!current) throw new Error("not found");
			if (current.isLocked) throw new Error("locked");
			if (!force && current.version !== baseline.version) throw new ConflictError("version");
			const saved = { ...structuredClone(document), isLocked: current.isLocked, version: current.version + 1 };
			documents.set(document.id, saved);
			saves.push({ id: document.id, text: document.data.text, force, scope });
			if (gate) {
				const held = gate;
				gate = null;
				await held;
			}
			if (failNext === "lost-response") {
				failNext = null;
				throw new Error("Network request failed");
			}
			return structuredClone(saved);
		},
	};
}

type Server = ReturnType<typeof createServer>;

function createAdapter(server: Server): DraftAdapter<Doc, Doc["data"]> {
	return {
		kind: "resume",
		delay: 500,
		read: server.read,
		data: (document) => document.data,
		withData: (document, data) => ({ ...document, data }),
		version: (document) => document.version,
		matches: (left, right) => left.name === right.name && JSON.stringify(left.data) === JSON.stringify(right.data),
		merge: (saved, _submitted, current) => ({ ...saved, name: current.name, data: current.data }),
		parse: (value) => value as Doc,
		save: (document, baseline, _sessionId, force, scope) => server.save(document, baseline, force, scope),
		copy: async (document, copyId, remember, scope) => {
			if (copyId) return;
			server.copies.push({ text: document.data.text, scope });
			remember(`copy-of-${document.id}`);
		},
		isConflict: (error) => error instanceof ConflictError,
	};
}

/** A device: storage that survives a restart, the signed-in account, connectivity and keyboard focus. */
type Device = {
	items: Map<string, string>;
	owner: string | null;
	online: boolean;
	focused: boolean;
	env: DraftEnvironment;
};

function createDevice(): Device {
	const items = new Map<string, string>();
	const device: Device = {
		items,
		owner: "https://rezumi.app|alice",
		online: true,
		focused: false,
		env: {
			storage: {
				getItemSync: (key: string) => items.get(key) ?? null,
				setItemSync: (key: string, value: string) => void items.set(key, value),
				removeItemSync: (key: string) => items.delete(key),
				getAllKeysSync: () => [...items.keys()],
			},
			scope: async () => device.owner,
			online: () => device.online,
			focused: () => device.focused,
		},
	};
	return device;
}

const doc = (id: string, text = "Hello"): Doc => ({
	id,
	name: "CV",
	isLocked: false,
	version: 1,
	data: { text, items: [] },
});

function setup(documents: Doc[] = [doc("a")]) {
	const server = createServer(documents);
	const device = createDevice();
	const engine = createDraftStore(createAdapter(server), device.env);
	return { server, device, engine, state: () => engine.store.getState() };
}

const type = (engine: ReturnType<typeof setup>["engine"], text: string, coalesceKey = "text") =>
	engine.store.getState().update(
		(draft) => {
			draft.text = text;
		},
		{ coalesceKey },
	);

beforeEach(() => {
	vi.useFakeTimers();
	vi.setSystemTime(new Date("2026-11-21T08:00:00Z"));
});

afterEach(() => {
	vi.useRealTimers();
});

describe("draft engine: saving", () => {
	it("loads the server copy and saves edits after the debounce", async () => {
		const { engine, server, device, state } = setup();
		await state().open("a");
		expect(state().data?.text).toBe("Hello");

		type(engine, "Hello world");
		expect(state().status).toBe("saving");
		expect(server.saves).toHaveLength(0);

		await vi.advanceTimersByTimeAsync(500);
		expect(server.saves).toEqual([{ id: "a", text: "Hello world", force: false, scope: "https://rezumi.app|alice" }]);
		expect(state().status).toBe("saved");
		expect(state().document?.version).toBe(2);
		expect(device.items.size).toBe(0);
	});

	it("sends edits typed during a save in the next write, against the new version", async () => {
		const { engine, server, state } = setup();
		await state().open("a");
		type(engine, "One");
		const release = server.holdNextSave();
		const flushing = state().flush();
		await vi.advanceTimersByTimeAsync(0);
		expect(server.saves.map((save) => save.text)).toEqual(["One"]);
		type(engine, "One two");
		release();
		await flushing;
		await vi.advanceTimersByTimeAsync(500);
		expect(server.saves.map((save) => save.text)).toEqual(["One", "One two"]);
		expect(server.documents.get("a")?.version).toBe(3);
		expect(state().status).toBe("saved");
	});

	it("keeps a locked document read-only", async () => {
		const { engine, server, state } = setup([{ ...doc("a"), isLocked: true }]);
		await state().open("a");
		type(engine, "Changed");
		expect(state().data?.text).toBe("Hello");
		expect(state().locked).toBe(true);
		await vi.advanceTimersByTimeAsync(1000);
		expect(server.saves).toHaveLength(0);
	});

	it("flushes pending edits on close", async () => {
		const { engine, server, state } = setup();
		await state().open("a");
		type(engine, "Before leaving");
		await state().close();
		expect(server.saves.map((save) => save.text)).toEqual(["Before leaving"]);
		expect(state().document).toBeNull();
	});
});

describe("draft engine: undo and redo", () => {
	it("merges typing in one field into one step, but not edits to different fields", async () => {
		const { engine, state } = setup();
		await state().open("a");
		type(engine, "H");
		vi.advanceTimersByTime(200);
		type(engine, "Hi");
		vi.advanceTimersByTime(200);
		state().update((draft) => void draft.items.push("x"), { coalesceKey: "items" });
		state().undo();
		expect(state().data).toEqual({ text: "Hi", items: [] });
		state().undo();
		expect(state().data?.text).toBe("Hello");
		expect(state().canUndo).toBe(false);
		state().redo();
		state().redo();
		expect(state().data).toEqual({ text: "Hi", items: ["x"] });
	});

	it("opens a new step after the window, for structural edits, and joins sameStep edits however late", async () => {
		const { engine, state } = setup();
		await state().open("a");
		type(engine, "A");
		vi.advanceTimersByTime(1500);
		type(engine, "AB");
		state().undo();
		expect(state().data?.text).toBe("A");

		state().update((draft) => void draft.items.push("1"), { coalesceKey: "fit", sameStep: true });
		vi.advanceTimersByTime(5000);
		state().update((draft) => void draft.items.push("2"), { coalesceKey: "fit", sameStep: true });
		state().update((draft) => void draft.items.push("3"), { coalesceKey: "fit", newStep: true });
		state().undo();
		expect(state().data?.items).toEqual(["1", "2"]);
		state().undo();
		expect(state().data?.items).toEqual([]);
	});

	it("clears redo on a new edit and keeps at most the bounded number of steps", async () => {
		const { engine, state } = setup();
		await state().open("a");
		for (let step = 0; step < MAX_HISTORY_ENTRIES + 20; step++) {
			state().update((draft) => void (draft.text = `v${step}`), { newStep: true });
		}
		state().undo();
		expect(state().canRedo).toBe(true);
		type(engine, "fresh");
		expect(state().canRedo).toBe(false);
		let undone = 0;
		while (state().canUndo) {
			state().undo();
			undone++;
		}
		expect(undone).toBe(MAX_HISTORY_ENTRIES);
	});

	it("keeps name changes through later undo of content", async () => {
		const { engine, state } = setup();
		await state().open("a");
		type(engine, "Edited");
		state().updateDocument((draft) => void (draft.name = "Renamed"));
		state().undo();
		expect(state().document?.name).toBe("Renamed");
		expect(state().data?.text).toBe("Hello");
	});
});

describe("draft engine: offline and reconnect", () => {
	it("keeps edits on the device while offline and sends them when the connection returns", async () => {
		const { engine, server, device, state } = setup();
		await state().open("a");
		device.online = false;
		type(engine, "Written on a plane");
		expect(state().status).toBe("offline");
		await vi.advanceTimersByTimeAsync(500);
		expect(server.saves).toHaveLength(0);
		expect(device.items.size).toBe(1);
		expect(state().status).toBe("offline");

		device.online = true;
		await state().flush();
		expect(server.saves.map((save) => save.text)).toEqual(["Written on a plane"]);
		expect(state().status).toBe("saved");
		expect(device.items.size).toBe(0);
	});

	it("reports an error but keeps the edit when a save fails while online, and Retry sends it", async () => {
		const { engine, server, device, state } = setup();
		await state().open("a");
		server.failNextSave("network");
		type(engine, "Retry me");
		await vi.advanceTimersByTimeAsync(500);
		expect(state().status).toBe("error");
		expect(device.items.size).toBe(1);
		state().retry();
		await vi.advanceTimersByTimeAsync(0);
		expect(server.saves.map((save) => save.text)).toEqual(["Retry me"]);
		expect(state().status).toBe("saved");
	});

	it("restores a draft after the app was closed before it saved, and opens offline from the device", async () => {
		const first = setup();
		await first.state().open("a");
		first.device.online = false;
		type(first.engine, "Unsaved before force close");
		await vi.advanceTimersByTimeAsync(300);
		expect(first.device.items.size).toBe(1);

		// A new process: same storage, fresh engine.
		const engine = createDraftStore(createAdapter(first.server), first.device.env);
		await engine.store.getState().open("a");
		expect(engine.store.getState().data?.text).toBe("Unsaved before force close");
		expect(engine.store.getState().status).toBe("offline");

		first.device.online = true;
		await engine.store.getState().flush();
		expect(first.server.documents.get("a")?.data.text).toBe("Unsaved before force close");
		expect(first.device.items.size).toBe(0);
	});

	it("replays drafts of other documents kept on the device", async () => {
		const first = setup([doc("a"), doc("b")]);
		await first.state().open("a");
		first.device.online = false;
		type(first.engine, "Offline edit of A");
		await first.state().close();
		await first.state().open("b");
		first.device.online = true;
		await first.engine.replay();
		expect(first.server.documents.get("a")?.data.text).toBe("Offline edit of A");
		expect(await first.engine.listPending()).toEqual([]);
	});

	it("does not ask about a conflict when the write landed but its response was lost", async () => {
		const { engine, server, device, state } = setup();
		await state().open("a");
		server.failNextSave("lost-response");
		type(engine, "Landed");
		await vi.advanceTimersByTimeAsync(500);
		expect(state().status).toBe("error");
		expect(server.documents.get("a")?.version).toBe(2);

		const reopened = createDraftStore(createAdapter(server), device.env);
		await reopened.store.getState().open("a");
		expect(reopened.store.getState().conflict).toBeNull();
		expect(reopened.store.getState().status).toBe("saved");
		expect(device.items.size).toBe(0);
	});
});

describe("draft engine: conflicts", () => {
	async function offlineEditThenRemoteChange() {
		const context = setup();
		await context.state().open("a");
		context.device.online = false;
		type(context.engine, "Mine");
		await vi.advanceTimersByTimeAsync(500);
		await context.state().close();
		context.server.edit("a", { data: { text: "Theirs", items: [] } });
		context.device.online = true;
		await context.state().open("a");
		return context;
	}

	it("turns a newer server copy into a conflict instead of overwriting either side", async () => {
		const { server, state } = await offlineEditThenRemoteChange();
		expect(state().conflict?.remote.data.text).toBe("Theirs");
		expect(state().data?.text).toBe("Mine");
		expect(state().status).toBe("error");
		expect(server.documents.get("a")?.data.text).toBe("Theirs");
	});

	it("keep-mine sends the draft without the version check", async () => {
		const { server, device, state } = await offlineEditThenRemoteChange();
		await state().resolveConflict("keep-mine");
		expect(server.saves.at(-1)).toMatchObject({ text: "Mine", force: true });
		expect(state().conflict).toBeNull();
		expect(state().status).toBe("saved");
		expect(device.items.size).toBe(0);
	});

	it("use-theirs drops the draft and loads the server copy", async () => {
		const { server, device, state } = await offlineEditThenRemoteChange();
		await state().resolveConflict("use-theirs");
		expect(state().data?.text).toBe("Theirs");
		expect(state().canUndo).toBe(false);
		expect(server.saves).toHaveLength(0);
		expect(device.items.size).toBe(0);
	});

	it("keep-both saves the draft as a copy and loads the server copy here", async () => {
		const { server, state } = await offlineEditThenRemoteChange();
		await state().resolveConflict("keep-both");
		expect(server.copies).toEqual([{ text: "Mine", scope: "https://rezumi.app|alice" }]);
		expect(state().data?.text).toBe("Theirs");
	});

	it("turns a version conflict on save into a conflict with the server copy", async () => {
		const { engine, server, state } = setup();
		await state().open("a");
		server.edit("a", { data: { text: "Edited on the web", items: [] } });
		type(engine, "Edited in the app");
		await vi.advanceTimersByTimeAsync(500);
		expect(state().conflict?.remote.data.text).toBe("Edited on the web");
		expect(state().data?.text).toBe("Edited in the app");
	});
});

describe("draft engine: server updates", () => {
	it("applies a newer server copy when nothing is pending, and defers it while a field has focus", async () => {
		const { engine, server, device, state } = setup();
		await state().open("a");
		server.edit("a", { data: { text: "From the web", items: [] } });
		await engine.refresh();
		expect(state().data?.text).toBe("From the web");

		server.edit("a", { data: { text: "From an agent", items: [] } });
		device.focused = true;
		await engine.refresh();
		expect(state().data?.text).toBe("From the web");
		device.focused = false;
		await engine.blur();
		expect(state().data?.text).toBe("From an agent");
	});

	it("never replaces unsaved edits with a server copy", async () => {
		const { engine, server, state } = setup();
		await state().open("a");
		type(engine, "Typing");
		server.edit("a", { name: "Renamed elsewhere" });
		await engine.refresh();
		expect(state().data?.text).toBe("Typing");
	});
});

describe("draft engine: accounts", () => {
	it("drops a save's result when the account changed while it was in flight", async () => {
		const { engine, device, state } = setup();
		await state().open("a");
		type(engine, "Alice's edit");
		const saving = state().flush();
		device.owner = "https://rezumi.app|bob";
		await saving;
		expect(state().status).not.toBe("saved");
	});

	it("keeps drafts per account: another account never replays them, signing out removes only its own", async () => {
		const { engine, server, device, state } = setup([doc("a"), doc("b")]);
		await state().open("a");
		device.online = false;
		type(engine, "Alice offline");
		await state().close();
		engine.suspend();

		device.owner = "https://rezumi.app|bob";
		device.online = true;
		await engine.replay();
		expect(server.saves).toHaveLength(0);
		expect(await engine.listPending()).toEqual([]);

		engine.clearDraftsFor("https://rezumi.app|bob");
		device.owner = "https://rezumi.app|alice";
		expect((await engine.listPending()).map((pending) => pending.data.text)).toEqual(["Alice offline"]);

		engine.clearDraftsFor("https://rezumi.app|alice");
		expect(await engine.listPending()).toEqual([]);
		expect(device.items.size).toBe(0);
	});

	it("refuses to open a draft while signed out", async () => {
		const { device, state } = setup();
		device.owner = null;
		await expect(state().open("a")).rejects.toThrow("Sign in");
	});
});
