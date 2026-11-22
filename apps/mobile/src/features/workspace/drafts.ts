// Text kept on the device until the server (or the coach) has it, and autosave with retries (web career/hooks.ts).
// Drafts are scoped by server and account; the pure machinery lives in state.ts.
import type { DraftState, SaveResult } from "./state";
import type { SetStateAction } from "react";
import Storage from "expo-sqlite/kv-store";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createAutosave, createDraftStore, nextDraftState } from "./state";
import { useSession } from "@/auth/session";
import { getDraftScope } from "@/draft";

type TextDraft = ReturnType<typeof useDraft<string>>;

/**
 * Saves text a moment after typing stops (2 s), on blur (`flush`) and when leaving. Transient failures retry up to 3
 * times (5, 10, 20 s). A permanent one (4xx, conflict) stops and sets `error`; with a `draft`, it is kept on the device
 * with the text, so reopening the screen (or the app) shows it again and still waits for `retry` or
 * `takeServerVersion`. The draft clears only when the server confirmed that exact value.
 */
export function useAutosave(
	value: string,
	saved: string,
	save: (value: string) => Promise<SaveResult>,
	draft?: TextDraft,
	/** The field's value in a freshly fetched, server-confirmed copy ("Use server version"). */
	fetchServer?: () => Promise<string>,
) {
	const [resolve, setResolve] = useState<"idle" | "loading" | "failed">("idle");
	const latest = useRef({ save, draft });
	useLayoutEffect(() => {
		latest.current = { save, draft };
	});
	const [error, setError] = useState<string | null>(null);
	const [autosave] = useState(() =>
		createAutosave({
			save: (next) => latest.current.save(next),
			onSaved: (next) => latest.current.draft?.clear(next),
			onError: (block) => {
				setError(block?.code ?? null);
				if (!block) latest.current.draft?.setBlocked(null);
				else if (block.permanent) latest.current.draft?.setBlocked({ value: block.value, code: block.code });
			},
			delay: 2000,
			retryDelay: 5000,
			maxRetries: 3,
			timers: {
				set: (run, ms) => setTimeout(run, ms),
				clear: (id) => clearTimeout(id as ReturnType<typeof setTimeout>),
			},
		}),
	);
	// Before `update`: a conflict kept on the device must be in place before the restored draft could be sent.
	const blocked = draft?.blocked ?? null;
	const blockedValue = blocked?.value;
	const blockedCode = blocked?.code;
	useEffect(() => {
		if (blockedValue !== undefined && blockedCode !== undefined)
			autosave.block({ value: blockedValue, code: blockedCode });
	}, [autosave, blockedValue, blockedCode]);
	useEffect(() => autosave.update(value, saved), [autosave, value, saved]);
	useEffect(() => () => autosave.dispose(), [autosave]);
	return {
		flush: autosave.flush,
		retry: autosave.retry,
		/**
		 * Replaces the draft with the server's confirmed copy (`fetchServer`, never the optimistic cache). Saving stays
		 * blocked while it loads, and stays blocked with `resolveFailed` if it can't be loaded.
		 */
		takeServerVersion: fetchServer
			? async () => {
					setResolve("loading");
					try {
						await autosave.takeServerVersion(fetchServer, (server) => latest.current.draft?.reset(server));
						setResolve("idle");
					} catch {
						setResolve("failed");
					}
				}
			: undefined,
		resolving: resolve === "loading",
		resolveFailed: resolve === "failed",
		error,
	};
}

export type Autosave = ReturnType<typeof useAutosave>;

const draftStore = createDraftStore(Storage);
/** Suffix of the key that keeps a draft's permanent save failure (conflict) next to it. */
const BLOCKED = "#save-error";
type Blocked = { value: string; code: string };
/** The key prefix of every workspace draft for one account; sign-out cleanup can sweep it. */
export const draftPrefix = (scope: string) => `rezumi:career-draft:${scope}:`;

/**
 * Writes and clears check the account again when they run: a draft never lands under, or removes, another identity's
 * key. A newer write for the same key wins over an older one still resolving.
 */
const writeTurns = new Map<string, number>();
function writeDraft(scope: string, key: string, value: unknown) {
	const turn = (writeTurns.get(key) ?? 0) + 1;
	writeTurns.set(key, turn);
	void getDraftScope().then((now) => {
		if (now === scope && writeTurns.get(key) === turn) draftStore.write(key, value);
	});
}
function clearDraftAt(scope: string, key: string, sent: unknown) {
	const turn = writeTurns.get(key) ?? 0;
	void getDraftScope().then((now) => {
		// A write queued after this clear was asked for is newer than `sent`: leave it.
		if (now !== scope || (writeTurns.get(key) ?? 0) !== turn) return;
		draftStore.clear(key, sent);
		// No draft left, so no conflict to wait on.
		if (draftStore.read(key) === undefined) draftStore.clear(`${key}${BLOCKED}`);
	});
}

/** Clears a draft by name for the signed-in account, once the server confirmed `sent` (Mark as applied). */
export function clearDraft(name: string, sent: unknown) {
	void getDraftScope().then((scope) => {
		if (scope !== null) clearDraftAt(scope, `${draftPrefix(scope)}${name}`, sent);
	});
}

/**
 * The signed-in account's draft scope (server + OAuth subject, as resume drafts and application notes use). It is
 * resolved again on every session change and never reused across identities; until it resolves, there is none.
 */
function useDraftScope() {
	const session = useSession();
	const signedIn = session.status === "signed-in";
	const [scope, setScope] = useState<{ session: typeof session; value: string | null } | null>(null);
	useEffect(() => {
		if (!signedIn) return;
		let live = true;
		void getDraftScope().then((value) => {
			if (live) setScope({ session, value });
		});
		return () => {
			live = false;
		};
	}, [signedIn, session]);
	// No scope (signed out, re-checking, or the token can't name the account) keeps drafts on screen only.
	return signedIn && scope?.session === session ? scope.value : null;
}

/**
 * A draft kept on the device until the server or the coach has it: it survives leaving the screen and restarting the
 * app, scoped by server and account. `clear(sent)` removes it only while it is still that revision.
 */
export function useDraft<T>(name: string | null, initial: T) {
	const scope = useDraftScope();
	const key = name !== null && scope !== null ? `${draftPrefix(scope)}${name}` : null;
	const [state, setState] = useState<DraftState<T>>(() => ({ key, owner: key, value: initial, touched: false }));
	if (state.key !== key)
		setState(nextDraftState(state, key, key === null ? undefined : draftStore.read<T>(key), initial));
	// Text typed before the account was known is written once its key resolves.
	useEffect(() => {
		if (state.key !== null && scope !== null && state.touched) writeDraft(scope, state.key, state.value);
	}, [state, scope]);
	// A permanent save failure kept with the draft (see useAutosave), per account key like the draft itself.
	const [blocked, setBlockedState] = useState<{ key: string | null; value: Blocked | null }>({ key, value: null });
	if (blocked.key !== key)
		setBlockedState({
			key,
			value: key === null ? blocked.value : (draftStore.read<Blocked>(`${key}${BLOCKED}`) ?? null),
		});
	const current = useRef(state);
	useLayoutEffect(() => {
		current.current = state;
	});
	const setValue = (update: SetStateAction<T>) => {
		const previous = current.current;
		const value = typeof update === "function" ? (update as (value: T) => T)(previous.value) : update;
		current.current = { ...previous, value, touched: true };
		setState(current.current);
	};
	return {
		value: state.value,
		setValue,
		/** Drops the device copy once the server confirmed `sent`; a newer edit stays. */
		clear: (sent: T) => {
			if (key !== null && scope !== null) clearDraftAt(scope, key, sent);
		},
		blocked: blocked.value,
		setBlocked: (next: Blocked | null) => {
			setBlockedState({ key, value: next });
			if (key === null || scope === null) return;
			if (next) writeDraft(scope, `${key}${BLOCKED}`, next);
			else clearDraftAt(scope, `${key}${BLOCKED}`, undefined);
		},
		/** Replaces the draft with `value` (the server copy) and forgets it and its kept failure. */
		reset: (value: T) => {
			current.current = { ...current.current, value, touched: false };
			setState(current.current);
			setBlockedState({ key, value: null });
			if (key !== null && scope !== null) clearDraftAt(scope, key, undefined);
		},
	};
}
