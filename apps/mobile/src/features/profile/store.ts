import type { UpdateOptions } from "@/draft";
// The Profile while its editor is open (plans/mobile Phase 06). The entry forms edit it as resume data
// (`resumeDataFromProfile`); it saves as `profileFromResume` once typing pauses, through the saver shared with the web
// (`@rezumi/resume/profile-draft`), sending the version it read. A version conflict keeps the edits and asks which
// version to keep; a failed save (offline) keeps them and sends again when the connection is back.
import type { ProfileDto } from "@/features/onboarding/queries";
import type { LastEdit } from "@rezumi/resume/draft";
import type { FollowedResume, ProfileDraftStatus, ProfileSaveResult } from "@rezumi/resume/profile-draft";
import type { ResumeData } from "@rezumi/schema/resume/data";
import type { QueryClient } from "@tanstack/react-query";
import type { WritableDraft } from "immer";
import { ORPCError } from "@orpc/client";
import { onlineManager } from "@tanstack/react-query";
import { produce } from "immer";
import { AppState } from "react-native";
import { create } from "zustand";
import { joinsUndoStep, pushBounded } from "@rezumi/resume/draft";
import { profileFromResume, resumeDataFromProfile } from "@rezumi/resume/profile";
import { createProfileSaver, mergeFollowed } from "@rezumi/resume/profile-draft";
import { syncResumeDates } from "@rezumi/schema/resume/dates";
import { client, orpc } from "@/api/client";
import { profileQuery, storeSavedProfile } from "@/features/onboarding/queries";

export type ProfileEditorState = {
	/** The account the open Profile belongs to; edits never cross to another one. */
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
	redoStack: ResumeData[];
};

const initial: ProfileEditorState = {
	server: null,
	data: null,
	updatedAt: null,
	status: "idle",
	followed: [],
	conflict: null,
	undoStack: [],
	redoStack: [],
};

export const useProfileEditor = create<ProfileEditorState>()(() => initial);

let queryClient: QueryClient | undefined;
let last: LastEdit | null = null;

const state = () => useProfileEditor.getState();

const saver = createProfileSaver({
	read: () => {
		const { data, updatedAt, conflict } = state();
		// While the person picks a version nothing is sent.
		return data && !conflict ? { data: profileFromResume(data), updatedAt } : null;
	},
	send: async (input) => {
		const server = state().server;
		const result = await client.profile.update(input);
		if (state().server !== server) throw new Error("Account changed");
		return result;
	},
	isConflict: (error) => error instanceof ORPCError && error.code === "PROFILE_VERSION_CONFLICT",
	onStatus: (status) => useProfileEditor.setState({ status }),
	onSaved: (result: ProfileSaveResult) => {
		useProfileEditor.setState((current) => ({
			updatedAt: result.updatedAt,
			followed: mergeFollowed(current.followed, result.updatedResumes),
		}));
		const { server } = state();
		if (!queryClient || !server) return;
		storeSavedProfile(queryClient, server, { data: result.data, updatedAt: result.updatedAt });
		if (result.updatedResumes.length > 0) void queryClient.invalidateQueries({ queryKey: orpc.documents.key() });
	},
	onConflict: async () => {
		try {
			const remote = await client.profile.get();
			useProfileEditor.setState({ conflict: remote, status: "idle" });
		} catch {
			// The server's copy couldn't be read: keep the edits and let Retry try again.
			saverRetryLater();
		}
	},
});

/** Marks the edits as waiting (the Retry in the save note, or the connection coming back, sends them). */
function saverRetryLater() {
	useProfileEditor.setState({ status: "error" });
	pendingRetry = true;
}

let pendingRetry = false;

/** Opens the Profile of this account, as read from the server. Called when the editor mounts and on fresh reads. */
export function openProfile(profile: ProfileDto, server: string, queries: QueryClient) {
	queryClient = queries;
	const current = state();
	const sameAccount = current.server === server;
	// What's on screen is newer (unsent edits) or the same version: keep it.
	if (sameAccount && current.data) {
		if (saver.hasUnsavedChanges() || pendingRetry || current.conflict) return;
		if ((current.updatedAt?.getTime() ?? null) === (profile.updatedAt?.getTime() ?? null)) return;
	}
	load(profile, server, sameAccount ? current.followed : []);
}

function load(profile: ProfileDto, server: string, followed: FollowedResume[] = []) {
	saver.reset();
	pendingRetry = false;
	last = null;
	useProfileEditor.setState({
		...initial,
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
		redoStack: [],
	}));
	pendingRetry = false;
	saver.queue();
}

export function undoProfile() {
	const { data, undoStack, conflict } = state();
	const previous = undoStack.at(-1);
	if (!data || !previous || conflict) return;
	last = null;
	useProfileEditor.setState((current) => ({
		data: previous,
		undoStack: current.undoStack.slice(0, -1),
		redoStack: [...current.redoStack, data],
	}));
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
	const { conflict, server, followed } = state();
	if (!conflict || !server) return;
	if (choice === "use-theirs") {
		load(conflict, server, followed);
		if (queryClient) storeSavedProfile(queryClient, server, conflict);
		return;
	}
	useProfileEditor.setState({ conflict: null, updatedAt: conflict.updatedAt });
	await saver.retry();
}

/** Signing out or switching account: nothing of this Profile stays on screen. */
export function closeProfile() {
	saver.reset();
	pendingRetry = false;
	last = null;
	useProfileEditor.setState(initial);
}

/** Re-reads the Profile for pull to refresh, keeping unsent edits. */
export async function refreshProfile() {
	const { server } = state();
	if (!server || !queryClient) return;
	await queryClient.invalidateQueries({ queryKey: profileQuery(server).queryKey });
}

// Saves before the app goes to the background, and sends what failed once the connection is back.
AppState.addEventListener("change", (next) => {
	if (next !== "active" && hasUnsavedProfileChanges()) void saveProfileNow();
});
onlineManager.subscribe((online) => {
	if (online && state().status === "error") void retryProfileSave();
});
