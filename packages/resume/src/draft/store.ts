import type { DraftStore, UpdateOptions } from "./types";
import type { WritableDraft } from "immer";
import type { StoreApi } from "zustand/vanilla";
import { produce } from "immer";
import { createStore } from "zustand/vanilla";
import { generateId } from "@rezumi/utils/string";
import { joinsUndoStep, MAX_HISTORY_ENTRIES, pushBounded } from "./history";

type Document = { id: string; isLocked: boolean };
type Record<D> = {
	baseline: D;
	document: D;
	sessionId: string;
	copyId?: string;
	/**
	 * Documents sent whose outcome is unknown (the request failed without an answer), oldest first. A write can land
	 * without its response; these recognise it afterwards instead of reporting the user's own text as a conflict.
	 */
	sent?: D[] | undefined;
};

export type DraftAdapter<D extends Document, T> = {
	kind: "resume" | "letter";
	delay: number;
	read: (id: string) => Promise<D>;
	data: (document: D) => T;
	withData: (document: D, data: T) => D;
	merge: (saved: D, submitted: D, current: D) => D;
	matches: (left: D, right: D) => boolean;
	version: (document: D) => string | number;
	parse: (value: unknown) => D;
	/** `scope` binds the write to the account that owns the draft (the API client refuses it after an account switch). */
	save: (document: D, baseline: D, sessionId: string, force: boolean, scope: string) => Promise<D>;
	copy: (document: D, copyId: string | undefined, remember: (id: string) => void, scope: string) => Promise<void>;
	isConflict: (error: unknown) => boolean;
};

/** What the engine needs from its platform: synchronous storage (SQLite kv in the app), the account, connectivity. */
export type DraftEnvironment = {
	storage: {
		getItemSync: (key: string) => string | null;
		setItemSync: (key: string, value: string) => void;
		removeItemSync: (key: string) => unknown;
		getAllKeysSync: () => string[];
	};
	/** Server origin + subject, never credentials. Null while signed out. */
	scope: () => Promise<string | null>;
	online: () => boolean;
	focused: () => boolean;
};

/** Unanswered submissions kept to recognise a landed write; older ones are superseded by later typing anyway. */
const MAX_UNCONFIRMED = 3;

const emptyState = {
	document: null,
	data: null,
	status: "idle",
	locked: false,
	conflict: null,
	canUndo: false,
	canRedo: false,
} as const;

export type DraftEngine<D, T> = {
	store: StoreApi<DraftStore<D, T>>;
	/** The current account's recoverable drafts, from disk and from memory (writes kept after a disk failure). */
	listPending: () => Promise<D[]>;
	subscribePending: (listener: () => void) => () => void;
	/** The server copy may have changed (an update event): apply it unless there are unsaved edits or a field has focus. */
	refresh: () => Promise<void>;
	/** Sends the current account's drafts of other documents kept on this device (offline edits, a force close). */
	replay: () => Promise<void>;
	/** Editing ended: apply a deferred server copy, then save. */
	blur: () => Promise<void>;
	/** Editing started: server copies wait until `blur`. */
	focus: () => void;
	/** Removes one account's drafts (signing out); never another account's. */
	clearDraftsFor: (owner: string) => void;
	/** Session changes stop requests and hide the old account's in-memory draft immediately. */
	suspend: () => void;
};

/**
 * Shared save owner for resumes and letters: a debounced save queue, undo/redo, a copy on the device that survives a
 * closed app or no connection, replay on reconnect, and a version check that turns a newer server copy into a
 * conflict. Adapters own the different API contracts; the environment owns storage, the account and connectivity.
 */
export function createDraftStore<D extends Document, T>(
	adapter: DraftAdapter<D, T>,
	env: DraftEnvironment,
): DraftEngine<D, T> {
	let scope: string | null = null;
	let record: Record<D> | null = null;
	let dirty = false;
	let durable = true;
	// A full/unwritable disk must not discard the in-memory draft on navigation or account changes.
	const pending = new Map<string, Record<D>>();
	const pendingListeners = new Set<() => void>();
	let generation = 0;
	let editing = false;
	let deferred: D | null = null;
	let timer: ReturnType<typeof setTimeout> | undefined;
	let persistenceTimer: ReturnType<typeof setTimeout> | undefined;
	let queueGeneration = 0;
	let inflight: Promise<void> | null = null;
	let replaying: Promise<void> | null = null;
	let resolving = false;
	let force = false;
	let undo: T[] = [];
	let redo: T[] = [];
	let last: { at: number; key: string | undefined; coalesce: boolean } | null = null;
	const prefix = (owner: string) => `rezumi:unsaved:${encodeURIComponent(owner)}:${adapter.kind}:`;
	const key = () => {
		if (!scope || !record) throw new Error("No draft is open.");
		return `${prefix(scope)}${record.document.id}`;
	};
	const store = createStore<DraftStore<D, T>>(() => ({
		...emptyState,
		open,
		close,
		update,
		updateDocument,
		undo: () => travel(undo, redo),
		redo: () => travel(redo, undo),
		retry: () => void flush(),
		resolveConflict,
		flush,
	}));
	const state = store.getState;

	function publish(document: D) {
		store.setState({ document, data: adapter.data(document), locked: document.isLocked });
	}

	function history() {
		store.setState({ canUndo: undo.length > 0, canRedo: redo.length > 0 });
	}

	function resetHistory() {
		undo = [];
		redo = [];
		last = null;
		history();
	}

	function notifyPending() {
		for (const listener of pendingListeners) listener();
	}

	function removeStored(storageKey: string) {
		env.storage.removeItemSync(storageKey);
		pending.delete(storageKey);
		notifyPending();
	}

	function persist() {
		clearTimeout(persistenceTimer);
		persistenceTimer = undefined;
		if (!record || !scope || !dirty) return;
		pending.set(key(), record);
		try {
			env.storage.setItemSync(key(), JSON.stringify(record));
			durable = true;
		} catch {
			durable = false;
			// Keep the in-memory draft and expose failure; never claim it is safe on disk.
			store.setState({ status: "error" });
		}
		notifyPending();
	}

	function schedulePersistence() {
		if (!record || !scope) return;
		pending.set(key(), record);
		durable = false;
		// Fixed trailing window: continuous typing still reaches disk at least every 300 ms.
		persistenceTimer ??= setTimeout(persist, 300);
	}

	function readStored(storageKey: string): Record<D> | null {
		const memory = pending.get(storageKey);
		if (memory) return memory;
		const raw = env.storage.getItemSync(storageKey);
		if (!raw) return null;
		try {
			const value = JSON.parse(raw) as Record<unknown>;
			if (typeof value.sessionId !== "string") throw new Error("Invalid draft session.");
			const baseline = adapter.parse(value.baseline);
			const document = adapter.parse(value.document);
			if (baseline.id !== document.id || !storageKey.endsWith(`:${adapter.kind}:${document.id}`))
				throw new Error("Invalid draft identity.");
			let sent: D[] | undefined;
			try {
				sent = Array.isArray(value.sent) ? value.sent.map((entry) => adapter.parse(entry)) : undefined;
				if (sent?.some((entry) => entry.id !== document.id)) sent = undefined;
			} catch {
				// Only a hint for recognising a landed write; an unreadable one must not discard the draft.
				sent = undefined;
			}
			return {
				baseline,
				document,
				sessionId: value.sessionId,
				...(typeof value.copyId === "string" ? { copyId: value.copyId } : {}),
				...(sent ? { sent } : {}),
			};
		} catch {
			// A corrupt record cannot be restored; it must not permanently block the server copy.
			try {
				env.storage.removeItemSync(storageKey);
			} catch {
				/* Retry removal on the next open. */
			}
			return null;
		}
	}

	/**
	 * When the server copy equals what this draft last sent (or holds now), an earlier write landed without its
	 * response. Returns the draft rebased on that copy, keeping anything typed since; null for a real conflict.
	 */
	function rebaseOnLanded(draft: Record<D>, remote: D): D | null {
		const submitted = [...[...(draft.sent ?? [])].reverse(), draft.document].find((candidate) =>
			adapter.matches(remote, candidate),
		);
		return submitted ? adapter.merge(remote, submitted, draft.document) : null;
	}

	async function currentOwner() {
		const owner = scope;
		return owner !== null && (await env.scope()) === owner && scope === owner;
	}

	async function open(id: string) {
		if (replaying) await replaying;
		await close();
		const visit = ++generation;
		const owner = await env.scope();
		if (visit !== generation) return;
		if (!owner) throw new Error("Sign in before opening a draft.");
		scope = owner;
		try {
			const storageKey = `${prefix(owner)}${id}`;
			record = readStored(storageKey);
			if (record && pending.has(storageKey)) {
				try {
					durable = env.storage.getItemSync(storageKey) === JSON.stringify(record);
				} catch {
					durable = false;
				}
			}
			if (record && record.document.id !== id) throw new Error("Invalid draft identity.");
			if (record) {
				dirty = true;
				publish(record.document);
				store.setState({ status: !durable ? "error" : env.online() ? "saving" : "offline" });
			}
			if (!env.online() && record) return;
			const restored = record?.document;
			const remote = await adapter.read(id);
			if (inflight) await inflight;
			if (!(await currentOwner()) || visit !== generation) return;
			if (!record) {
				record = { document: remote, baseline: remote, sessionId: generateId() };
				publish(remote);
				return;
			}
			// The write may have succeeded without its response: the server copy equals what was sent or restored.
			const landed = [restored, ...[...(record.sent ?? [])].reverse(), record.document].find(
				(candidate) => candidate !== undefined && adapter.matches(remote, candidate),
			);
			if (adapter.version(remote) < adapter.version(record.baseline)) {
				return;
			} else if (landed) {
				// Keep anything typed during this read.
				record.document = adapter.merge(remote, landed, record.document);
				record.baseline = remote;
				record.sent = undefined;
				dirty = !adapter.matches(remote, record.document);
				publish(record.document);
				store.setState({ conflict: null, status: dirty ? "saving" : "saved" });
				if (dirty) await flush();
				else {
					clearTimeout(persistenceTimer);
					persistenceTimer = undefined;
					removeStored(key());
				}
			} else if (adapter.version(remote) > adapter.version(record.baseline)) {
				store.setState({ conflict: { remote }, locked: remote.isLocked, status: "error" });
			} else if (remote.isLocked) {
				store.setState({ locked: true, status: "error" });
			} else await flush();
		} catch (error) {
			if (visit !== generation) return;
			store.setState({ status: env.online() ? "error" : "offline" });
			if (!record) throw error;
		}
	}

	async function close() {
		clearTimeout(timer);
		const visit = generation;
		const active = record;
		await flush();
		if (visit !== generation || record !== active) return;
		generation++;
		record = null;
		scope = null;
		dirty = false;
		durable = true;
		deferred = null;
		editing = false;
		force = false;
		resetHistory();
		store.setState(emptyState);
	}

	function queue(document: D) {
		if (!record) return;
		record.document = document;
		dirty = true;
		deferred = null;
		publish(document);
		store.setState({ status: env.online() ? "saving" : "offline" });
		schedulePersistence();
		clearTimeout(timer);
		timer = setTimeout(() => void flush(), adapter.delay);
	}

	function update(recipe: (draft: WritableDraft<T>) => void, options: UpdateOptions = {}) {
		if (!record || state().locked || resolving) return;
		const before = adapter.data(record.document);
		const next = produce(before, recipe);
		if (next === before) return;
		const now = Date.now();
		if (!joinsUndoStep(last, options, now)) undo = pushBounded(undo, before);
		redo = [];
		last = { at: now, key: options.coalesceKey, coalesce: !options.newStep };
		history();
		queue(adapter.withData(record.document, next));
	}

	function updateDocument(recipe: (draft: WritableDraft<D>) => void) {
		if (!record || state().locked || resolving) return;
		const before = record.document;
		const document = produce(before, recipe);
		if (document === before) return;
		const fields = (Object.keys(document) as (keyof D)[]).filter((field) => document[field] !== before[field]);
		const rebase = (snapshot: T) => {
			const historical = { ...adapter.withData(before, snapshot) };
			for (const field of fields) historical[field] = document[field];
			return adapter.data(historical);
		};
		// Letter data is the document itself: metadata edits must survive later content undo/redo.
		undo = undo.map(rebase);
		redo = redo.map(rebase);
		queue(document);
	}

	function travel(from: T[], to: T[]) {
		if (!record || state().locked || resolving) return;
		const next = from.pop();
		if (next === undefined) return;
		to.push(adapter.data(record.document));
		if (to.length > MAX_HISTORY_ENTRIES) to.shift();
		last = null;
		history();
		queue(adapter.withData(record.document, next));
	}

	async function flush(): Promise<void> {
		clearTimeout(timer);
		persist();
		if (inflight) {
			await inflight;
			return flush();
		}
		if (!record || !dirty || state().conflict) return;
		if (state().locked) {
			// The edits can't be sent while the document is locked; they stay on the device and go out on unlock.
			store.setState({ status: "error" });
			return;
		}
		if (!env.online()) {
			store.setState({ status: durable ? "offline" : "error" });
			return;
		}
		const active = record;
		const visit = generation;
		inflight = (async () => {
			// Runs again only after recognising a landed write, which always advances the baseline.
			for (let rebased = true; rebased;) {
				rebased = false;
				try {
					if (!(await currentOwner()) || visit !== generation) return;
					store.setState({ status: "saving" });
					while (dirty && record === active && !state().conflict && !state().locked) {
						const submitted = active.document;
						active.sent = [...(active.sent ?? []).slice(-(MAX_UNCONFIRMED - 1)), submitted];
						persist();
						const saved = await adapter.save(submitted, active.baseline, active.sessionId, force, scope ?? "");
						if (!(await currentOwner()) || visit !== generation) return;
						force = false;
						active.baseline = saved;
						active.sent = undefined;
						dirty = active.document !== submitted;
						// Only local fields changed since submission overlay the server echo. Server-owned
						// revision/lock metadata always comes from the save, and typing keeps its references.
						active.document = adapter.merge(saved, submitted, active.document);
						publish(active.document);
						if (dirty) persist();
						else {
							removeStored(key());
							store.setState({ status: "saved" });
						}
						if (!env.online()) break;
					}
					if (dirty && record === active && state().locked) store.setState({ status: "error" });
				} catch (error) {
					if (record !== active || visit !== generation) return;
					store.setState({ status: env.online() ? "error" : "offline" });
					if (adapter.isConflict(error)) {
						// The version check rejected this submission, so it certainly did not land.
						active.sent = active.sent?.slice(0, -1);
						try {
							const remote = await adapter.read(active.document.id);
							if (!(await currentOwner()) || record !== active || visit !== generation) return;
							const document =
								adapter.version(remote) > adapter.version(active.baseline) ? rebaseOnLanded(active, remote) : null;
							if (document) {
								// An earlier write landed without its response (the version check fails on its stale
								// baseline): adopt the server copy and send only what was typed since.
								active.baseline = remote;
								active.document = document;
								active.sent = undefined;
								dirty = !adapter.matches(remote, document);
								publish(document);
								if (dirty) rebased = true;
								else {
									removeStored(key());
									store.setState({ status: "saved" });
									return;
								}
							} else store.setState({ conflict: { remote }, locked: remote.isLocked });
						} catch {
							/* Retry fetches the conflict again; the local draft stays intact. */
						}
					}
					persist();
				}
			}
		})().finally(() => {
			inflight = null;
		});
		await inflight;
	}

	async function resolveConflict(choice: "keep-mine" | "use-theirs" | "keep-both") {
		if (!record || !state().conflict || resolving) return;
		resolving = true;
		const active = record;
		const visit = generation;
		try {
			if (!(await currentOwner())) throw new Error("Draft session changed.");
			const remote = await adapter.read(active.document.id);
			if (!(await currentOwner()) || record !== active || visit !== generation) return;
			if (choice === "keep-mine") {
				if (remote.isLocked) {
					store.setState({ locked: true, conflict: { remote } });
					return;
				}
				active.baseline = remote;
				force = true;
				store.setState({ conflict: null, locked: false });
				persist();
				await flush();
			} else {
				if (choice === "keep-both")
					await adapter.copy(
						active.document,
						active.copyId,
						(id) => {
							active.copyId = id;
							persist();
						},
						scope ?? "",
					);
				if (!(await currentOwner()) || record !== active) return;
				removeStored(key());
				record = { baseline: remote, document: remote, sessionId: active.sessionId };
				dirty = false;
				deferred = null;
				resetHistory();
				publish(remote);
				store.setState({ conflict: null, status: "saved" });
			}
		} catch (error) {
			if (record === active) store.setState({ status: "error" });
			throw error;
		} finally {
			resolving = false;
		}
	}

	async function refresh() {
		if (!record || !env.online() || resolving) return;
		const active = record;
		const remote = await adapter.read(active.document.id);
		if (!(await currentOwner()) || record !== active) return;
		if (adapter.version(remote) <= adapter.version(active.baseline)) return;
		// Never advance the baseline of unsaved data in response to SSE (including our own echo).
		if (dirty || inflight) {
			const unlocked = state().locked && !remote.isLocked;
			store.setState({ locked: remote.isLocked });
			if (unlocked && dirty && !inflight) {
				// Edits held back by the lock go out now. When only the lock changed on the server, the newer copy is
				// the same content this draft started from, so the save must not fail its version check.
				if (adapter.matches(remote, active.baseline)) active.baseline = remote;
				void flush();
			}
			return;
		}
		if (editing || env.focused()) {
			deferred = remote;
			return;
		}
		applyRemote(remote);
	}

	function applyRemote(remote: D) {
		if (!record || dirty || adapter.version(remote) <= adapter.version(record.baseline)) return;
		if (JSON.stringify(adapter.data(remote)) !== JSON.stringify(adapter.data(record.document))) resetHistory();
		record.baseline = remote;
		record.document = remote;
		publish(remote);
	}

	async function blur() {
		editing = false;
		if (deferred && !dirty) applyRemote(deferred);
		deferred = null;
		await flush();
	}

	async function replayQueue() {
		const visit = queueGeneration;
		const owner = await env.scope();
		if (!owner || !env.online() || visit !== queueGeneration) return;
		await flush();
		if (visit !== queueGeneration) return;
		for (const storageKey of new Set([...env.storage.getAllKeysSync(), ...pending.keys()])) {
			if (!storageKey.startsWith(prefix(owner)) || storageKey === (record && scope ? key() : null)) continue;
			let queued: Record<D> | null = null;
			try {
				queued = readStored(storageKey);
				if (!queued) continue;
				if ((await env.scope()) !== owner || visit !== queueGeneration) return;
				await adapter.save(queued.document, queued.baseline, queued.sessionId, false, owner);
				if (visit !== queueGeneration) return;
				removeStored(storageKey);
			} catch (error) {
				if (queued && adapter.isConflict(error) && visit === queueGeneration) {
					const outcome = await replayLanded(storageKey, queued, owner, visit);
					if (outcome === "stop") return;
				}
				/* Conflicts, locked documents and failures stay queued until opened. */
			}
		}
	}

	/** A replayed draft hit a version conflict: if its earlier write landed, send what was typed since and drop it. */
	async function replayLanded(storageKey: string, queued: Record<D>, owner: string, visit: number) {
		try {
			const remote = await adapter.read(queued.document.id);
			if ((await env.scope()) !== owner || visit !== queueGeneration) return "stop";
			if (adapter.version(remote) <= adapter.version(queued.baseline)) return "kept";
			const document = rebaseOnLanded(queued, remote);
			if (!document) return "kept";
			if (!adapter.matches(remote, document)) {
				await adapter.save(document, remote, queued.sessionId, false, owner);
				if (visit !== queueGeneration) return "stop";
			}
			removeStored(storageKey);
			return "sent";
		} catch {
			return "kept";
		}
	}

	function replay(): Promise<void> {
		replaying ??= replayQueue().finally(() => {
			replaying = null;
		});
		return replaying;
	}

	function reset() {
		generation++;
		clearTimeout(timer);
		clearTimeout(persistenceTimer);
		persistenceTimer = undefined;
		record = null;
		scope = null;
		dirty = false;
		durable = true;
		editing = false;
		force = false;
		deferred = null;
		resetHistory();
		store.setState(emptyState);
	}

	/** Read the same validated queue as open/replay, including writes retained after a disk failure. */
	async function listPending(): Promise<D[]> {
		const owner = await env.scope();
		if (!owner) return [];
		const documents: D[] = [];
		for (const storageKey of new Set([...env.storage.getAllKeysSync(), ...pending.keys()])) {
			if (!storageKey.startsWith(prefix(owner))) continue;
			try {
				const queued = readStored(storageKey);
				if (queued) documents.push(queued.document);
			} catch {
				/* An unreadable entry must not hide other recoverable drafts. */
			}
		}
		return (await env.scope()) === owner ? documents : [];
	}

	function clearDraftsFor(owner: string) {
		queueGeneration++;
		if (scope === owner) reset();
		try {
			for (const storageKey of pending.keys()) if (storageKey.startsWith(prefix(owner))) pending.delete(storageKey);
			for (const storageKey of env.storage.getAllKeysSync())
				if (storageKey.startsWith(prefix(owner))) env.storage.removeItemSync(storageKey);
		} finally {
			notifyPending();
		}
	}

	return {
		store,
		listPending,
		subscribePending: (listener: () => void) => {
			pendingListeners.add(listener);
			return () => pendingListeners.delete(listener);
		},
		refresh,
		replay,
		blur,
		clearDraftsFor,
		focus: () => {
			editing = true;
		},
		suspend: () => {
			persist();
			reset();
		},
	};
}
