import type { ProfileDto, ProfileSaveResult } from "./queries";
import type { WriteSource, WriteUpdateOptions } from "@/features/resume/editor/write/source";
import type { ProfileDraftStatus } from "@rezumi/resume/profile-draft";
import type { ResumeData } from "@rezumi/schema/resume/data";
import type { QueryClient } from "@tanstack/react-query";
import type { WritableDraft } from "immer";
import type { StoreApi } from "zustand";
import { t } from "@lingui/core/macro";
import { ORPCError } from "@orpc/client";
import { immer } from "zustand/middleware/immer";
import { create } from "zustand/react";
import { MAX_HISTORY_ENTRIES, shouldCoalesceEdit } from "@rezumi/resume/draft";
import { profileFromResume, resumeDataFromProfile } from "@rezumi/resume/profile";
import { createProfileSaver, mergeFollowed } from "@rezumi/resume/profile-draft";
import { syncResumeDates } from "@rezumi/schema/resume/dates";
import { toast } from "@rezumi/ui/components/toast";
import { storeSavedProfile } from "./queries";
import { client, orpc } from "@/libs/orpc/client";

/**
 * The Profile while its editor is open. The Write panel's forms edit it as resume data (`resumeDataFromProfile`), and
 * it saves as `profileFromResume` once typing pauses, sending the version it read (`expectedUpdatedAt`). A version
 * conflict (the Profile was saved elsewhere meanwhile) reloads it. Undo works as in a resume, for this visit.
 */

/** `idle`: nothing sent yet this visit. `error`: the last save failed; the next edit or Retry sends again. */
type ProfileDraftState = {
	data: ResumeData | null;
	/** The version the next save sends back; null before the Profile's first save. */
	updatedAt: Date | null;
	status: ProfileDraftStatus;
	/** The resumes this visit's saves carried changes into, for "Updated in N resumes". */
	followed: ProfileSaveResult["updatedResumes"];
	undoStack: ResumeData[];
	redoStack: ResumeData[];
};

type ProfileDraftActions = {
	/** Shows a Profile as read from the server, dropping this visit's history. */
	load: (profile: ProfileDto) => void;
	update: (fn: (draft: WritableDraft<ResumeData>) => void, options?: WriteUpdateOptions) => void;
	undo: () => void;
	retry: () => void;
};

type ProfileDraftStore = ProfileDraftState & ProfileDraftActions;

let boundQueryClient: QueryClient | undefined;
let lastEditAt = 0;
let lastKey: string | undefined;
let canCoalesce = false;

function resetHistoryRuntime() {
	lastEditAt = 0;
	lastKey = undefined;
	canCoalesce = false;
}

const saver = createProfileSaver({
	read: () => {
		const { data, updatedAt } = useProfileDraftStore.getState();
		return data ? { data: profileFromResume(data), updatedAt } : null;
	},
	send: (input) => client.profile.update(input),
	isConflict: (error) => error instanceof ORPCError && error.code === "PROFILE_VERSION_CONFLICT",
	onStatus: (status) => useProfileDraftStore.setState({ status }),
	onSaved: (result) => {
		useProfileDraftStore.setState((state) => ({
			updatedAt: result.updatedAt,
			followed: mergeFollowed(state.followed, result.updatedResumes),
		}));
		if (boundQueryClient) storeSavedProfile(boundQueryClient, result);
	},
	onConflict: reloadAfterConflict,
	setTimer: (run, ms) => window.setTimeout(run, ms),
	clearTimer: (timer) => window.clearTimeout(timer as number),
});

export const useProfileDraftStore = create<ProfileDraftStore>()(
	immer((set, get) => ({
		data: null,
		updatedAt: null,
		status: "idle",
		followed: [],
		undoStack: [],
		redoStack: [],

		load: (profile) => {
			resetHistoryRuntime();
			saver.reset();
			set((state) => {
				state.data = resumeDataFromProfile(profile.data) as WritableDraft<ResumeData>;
				state.updatedAt = profile.updatedAt;
				state.status = "idle";
				state.undoStack = [];
				state.redoStack = [];
			});
		},

		update: (fn, options = {}) => {
			const current = get().data;
			if (!current) return;

			const now = Date.now();
			const newStep = options.newStep ?? false;
			const coalesce =
				options.sameStep && options.coalesceKey !== undefined && lastKey === options.coalesceKey
					? true
					: shouldCoalesceEdit(
							{ at: lastEditAt, key: lastKey, canCoalesce },
							{ at: now, key: options.coalesceKey, newStep },
						);
			lastEditAt = now;
			lastKey = options.coalesceKey;
			canCoalesce = !newStep;

			set((state) => {
				if (!state.data) return;
				if (!coalesce) {
					state.undoStack.push(current as WritableDraft<ResumeData>);
					if (state.undoStack.length > MAX_HISTORY_ENTRIES) state.undoStack.shift();
					state.redoStack = [];
				}
				fn(state.data);
				syncResumeDates(state.data as ResumeData);
			});
			saver.queue();
		},

		undo: () => {
			const { data, undoStack } = get();
			const previous = undoStack.at(-1);
			if (!data || !previous) return;
			resetHistoryRuntime();
			set((state) => {
				state.undoStack.pop();
				state.redoStack.push(data as WritableDraft<ResumeData>);
				state.data = previous as WritableDraft<ResumeData>;
			});
			saver.queue();
		},

		retry: () => {
			void saver.retry();
		},
	})),
);

/** The Profile store as a plain store, for the Write panel's source. */
const profileDraftStoreApi: StoreApi<ProfileDraftStore> = useProfileDraftStore;

/** The Write panel's forms, pointed at the Profile. */
export const profileWriteSource: WriteSource = {
	kind: "profile",
	store: profileDraftStoreApi as StoreApi<unknown>,
	read: (state) => (state as ProfileDraftState).data ?? undefined,
	update: (fn, options) => profileDraftStoreApi.getState().update(fn, options),
	undo: () => profileDraftStoreApi.getState().undo(),
};

/** Saves reach every reader of the Profile through this client. */
export function bindProfileQueryClient(queryClient: QueryClient) {
	boundQueryClient = queryClient;
}

/** Edits not on the server yet: typed and waiting, or being sent. */
export function hasUnsavedProfileChanges() {
	return saver.hasUnsavedChanges();
}

/** Reads the Profile again after a conflict and shows it in place of the edits that couldn't be saved. */
async function reloadAfterConflict() {
	try {
		const profile = await client.profile.get();
		boundQueryClient?.setQueryData(orpc.profile.get.queryKey(), profile);
		useProfileDraftStore.getState().load(profile);
	} catch {
		useProfileDraftStore.setState({ status: "error" });
	}
	toast.add({
		type: "warning",
		description: t`Your Profile was changed somewhere else, so it was reloaded. Check your last change.`,
		id: "profile-conflict",
	});
}

/**
 * Sends the latest edits now and resolves once they're saved (false if saving failed). Used before leaving the page
 * and before an action the server runs on the saved Profile (Fill from a resume).
 */
export function saveProfileNow(): Promise<boolean> {
	return saver.saveNow();
}
