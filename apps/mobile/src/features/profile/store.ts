import type { UpdateOptions } from "@/draft";
// The Profile while its editor is open (plans/mobile Phase 06). The entry forms edit it as resume data
// (`resumeDataFromProfile`); it saves as `profileFromResume` once typing pauses, through the saver shared with the web
// (`@rezumi/resume/profile-draft`), sending the version it read. A version conflict keeps the edits and asks which
// version to keep; a failed save (offline) keeps them, on this device too (pending.ts), and sends again when the
// connection is back. The open Profile belongs to one account (server and user): signing out or another account
// signing in closes it, so one account's edits are never shown to or sent as another.
import type { ProfileDto } from "@/features/onboarding/queries";
import type { LastEdit } from "@rezumi/resume/draft";
import type { FollowedResume, ProfileDraftStatus, ProfileSaver, ProfileSaveResult } from "@rezumi/resume/profile-draft";
import type { ResumeData } from "@rezumi/schema/resume/data";
import type { QueryClient } from "@tanstack/react-query";
import type { WritableDraft } from "immer";
import { ORPCError } from "@orpc/client";
import { onlineManager } from "@tanstack/react-query";
import Storage from "expo-sqlite/kv-store";
import { produce } from "immer";
import { AppState } from "react-native";
import { create } from "zustand";
import { changedFields, joinsUndoStep, pushBounded } from "@rezumi/resume/draft";
import { profileFromResume, resumeDataFromProfile } from "@rezumi/resume/profile";
import { createProfileSaver, mergeFollowed } from "@rezumi/resume/profile-draft";
import { syncResumeDates } from "@rezumi/schema/resume/dates";
import { profileAccount } from "./account";
import { clearPendingProfile, loadPendingProfile, storePendingProfile } from "./pending";
import { client, orpc } from "@/api/client";
import { getAccountScope, getSession, subscribeSession } from "@/auth/session";
import { profileQuery, storeSavedProfile } from "@/features/onboarding/queries";

export type ProfileEditorState = {
	/** The account the open Profile belongs to (`profileAccount`); edits never cross to another one. */
	scope: string | null;
	/** That account's server, for its cached reads. */
	server: string | null;
	data: ResumeData | null;
	/** The version the next save sends back; null before the Profile's first save. */
	updatedAt: Date | null;
	status: ProfileDraftStatus;
	/** The resumes this visit's saves carried changes into, for "Updated in N resumes". */
	followed: FollowedResume[];
	/** Saved elsewhere since it was read: the server's copy, until the person picks a version. */
	conflict: ProfileDto | null;
	undoStack: ResumeData[];
};

const initial: ProfileEditorState = {
	scope: null,
	server: null,
	data: null,
	updatedAt: null,
	status: "idle",
	followed: [],
	conflict: null,
	undoStack: [],
};

export const useProfileEditor = create<ProfileEditorState>()(() => initial);

/** The session no longer belongs to the account whose Profile is open: nothing is sent. */
class AccountChangedError extends Error {
	constructor() {
		super("The account changed before the Profile was saved.");
		this.name = "AccountChangedError";
	}
}

let queryClient: QueryClient | undefined;
let last: LastEdit | null = null;
let pendingRetry = false;

const state = () => useProfileEditor.getState();

/** Keeps the unsent edits on this device, for the account they belong to. */
function keepPending() {
	const { scope, data, updatedAt } = state();
	if (scope && data) storePendingProfile(Storage, scope, { data: profileFromResume(data), updatedAt });
}

function forgetPending() {
	const { scope } = state();
	if (scope) clearPendingProfile(Storage, scope);
}

/**
 * A saver for one open Profile. Closing it (or another account's Profile opening) replaces the saver, so a save still
 * on its way when that happens can no longer touch the store.
 */
function createSaver(): ProfileSaver {
	const current = () => saver === created;
	const created: ProfileSaver = createProfileSaver({
		read: () => {
			const { data, updatedAt, conflict } = state();
			// While the person picks a version nothing is sent.
			return data && !conflict ? { data: profileFromResume(data), updatedAt } : null;
		},
		send: async (input) => {
			const { scope } = state();
			// Expired, signed out or another account: one account's Profile never goes out with another's session.
			if (!scope || getAccountScope() !== scope) throw new AccountChangedError();
			const result = await client.profile.update(input, { context: { scope } });
			if (!current() || state().scope !== scope) throw new AccountChangedError();
			return result;
		},
		isConflict: (error) => error instanceof ORPCError && error.code === "PROFILE_VERSION_CONFLICT",
		onStatus: (status) => {
			if (!current()) return;
			useProfileEditor.setState({ status });
			if (status === "saved") forgetPending();
			else if (status === "error") keepPending();
		},
		onSaved: (result: ProfileSaveResult) => {
			if (!current()) return;
			useProfileEditor.setState((now) => ({
				updatedAt: result.updatedAt,
				followed: mergeFollowed(now.followed, result.updatedResumes),
			}));
			const { server } = state();
			if (!queryClient || !server) return;
			storeSavedProfile(queryClient, server, { data: result.data, updatedAt: result.updatedAt });
			if (result.updatedResumes.length > 0) void queryClient.invalidateQueries({ queryKey: orpc.documents.key() });
		},
		onConflict: async () => {
			if (!current()) return;
			keepPending();
			try {
				const remote = await client.profile.get();
				if (current()) useProfileEditor.setState({ conflict: remote, status: "idle" });
			} catch {
				// The server's copy couldn't be read: keep the edits and let Retry try again.
				if (current()) saverRetryLater();
			}
		},
	});
	return created;
}

let saver = createSaver();

/** Forgets what the saver had waiting and starts a new one for the next Profile. */
function replaceSaver() {
	saver.reset();
	saver = createSaver();
	pendingRetry = false;
	last = null;
}

/** Marks the edits as waiting (the Retry in the save note, or the connection coming back, sends them). */
function saverRetryLater() {
	useProfileEditor.setState({ status: "error" });
	pendingRetry = true;
}

/**
 * Opens the signed-in account's Profile, as read from the server. Called when the editor mounts and on fresh reads.
 * Edits of this account that never reached the server (the app was closed offline) come back on top and are sent.
 */
export function openProfile(profile: ProfileDto, server: string, queries: QueryClient) {
	queryClient = queries;
	const scope = profileAccount();
	if (!scope) return;
	const current = state();
	if (current.scope === scope && current.data) {
		// What's on screen is newer (unsent edits) or the same version: keep it.
		if (saver.hasUnsavedChanges() || pendingRetry || current.conflict) return;
		if ((current.updatedAt?.getTime() ?? null) === (profile.updatedAt?.getTime() ?? null)) return;
		load(profile, scope, server, current.followed);
		return;
	}
	load(profile, scope, server);
	const pending = loadPendingProfile(Storage, scope);
	if (!pending) return;
	// The save went through after all (its answer was lost, or it landed after another account signed in): nothing
	// left to send, and no reason to ask which version to keep.
	if (Object.keys(changedFields(profile.data, pending.data)).length === 0) {
		clearPendingProfile(Storage, scope);
		return;
	}
	useProfileEditor.setState({ data: resumeDataFromProfile(pending.data), updatedAt: pending.updatedAt });
	// Sent with the version the edits were made on: a Profile saved elsewhere since then asks which one to keep.
	void saver.retry();
}

function load(profile: ProfileDto, scope: string, server: string, followed: FollowedResume[] = []) {
	replaceSaver();
	useProfileEditor.setState({
		...initial,
		scope,
		server,
		data: resumeDataFromProfile(profile.data),
		updatedAt: profile.updatedAt,
		followed,
	});
}

/** Edits the Profile; consecutive edits of one field within a second fold into one undo step. */
export function updateProfile(recipe: (draft: WritableDraft<ResumeData>) => void, options: UpdateOptions = {}) {
	const { data, conflict } = state();
	if (!data || conflict) return;
	const next = produce(data, (draft) => {
		recipe(draft);
		syncResumeDates(draft as ResumeData);
	});
	if (next === data) return;
	const now = Date.now();
	const coalesce = joinsUndoStep(last, options, now);
	last = { at: now, key: options.coalesceKey, coalesce: !options.newStep };
	useProfileEditor.setState((current) => ({
		data: next,
		undoStack: coalesce ? current.undoStack : pushBounded(current.undoStack, data),
	}));
	pendingRetry = false;
	saver.queue();
}

export function undoProfile() {
	const { data, undoStack, conflict } = state();
	const previous = undoStack.at(-1);
	if (!data || !previous || conflict) return;
	last = null;
	useProfileEditor.setState((current) => ({ data: previous, undoStack: current.undoStack.slice(0, -1) }));
	saver.queue();
}

/** Sends unsent edits now (leaving the screen, the app going to the background). */
export const saveProfileNow = () => saver.saveNow();

export function retryProfileSave() {
	pendingRetry = false;
	return saver.retry();
}

export const hasUnsavedProfileChanges = () => saver.hasUnsavedChanges() || pendingRetry;

/**
 * The person's answer to a conflict. Keep mine: send these edits over the newer version. Use the saved one: show the
 * server's copy and drop the edits.
 */
export async function resolveProfileConflict(choice: "keep-mine" | "use-theirs") {
	const { conflict, scope, server, followed } = state();
	if (!conflict || !scope || !server) return;
	if (choice === "use-theirs") {
		forgetPending();
		load(conflict, scope, server, followed);
		if (queryClient) storeSavedProfile(queryClient, server, conflict);
		return;
	}
	useProfileEditor.setState({ conflict: null, updatedAt: conflict.updatedAt });
	await saver.retry();
}

/** Signing out or switching account: nothing of this Profile stays on screen. */
export function closeProfile() {
	replaceSaver();
	useProfileEditor.setState(initial);
}

/** Re-reads the Profile for pull to refresh, keeping unsent edits. */
export async function refreshProfile() {
	const { server } = state();
	if (!server || !queryClient) return;
	await queryClient.invalidateQueries({ queryKey: profileQuery(server).queryKey });
}

// Signing out closes the Profile (sign-out has already removed its copy on this device); another account signing in
// closes it too, keeping its unsent edits on this device for when that account is back. Expiry keeps it open while the
// person signs in again, and signing back in to the same account sends what failed meanwhile.
subscribeSession(() => {
	const { scope, status } = state();
	if (!scope) return;
	const session = getSession();
	if (session.status === "signed-out") closeProfile();
	else if (session.status === "signed-in" && getAccountScope() !== scope) {
		if (hasUnsavedProfileChanges()) keepPending();
		closeProfile();
	} else if (session.status === "signed-in" && status === "error") void retryProfileSave();
});

// Saves before the app goes to the background (keeping a copy in case it never comes back), and sends what failed once
// the connection is back.
AppState.addEventListener("change", (next) => {
	if (next === "active" || !hasUnsavedProfileChanges()) return;
	keepPending();
	void saveProfileNow();
});
onlineManager.subscribe((online) => {
	if (online && state().status === "error") void retryProfileSave();
});
