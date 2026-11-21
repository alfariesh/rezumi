import type { ProfileData } from "@rezumi/schema/profile/data";

/**
 * Saving the Profile while its editor is open, for the web and the app alike. Edits are sent once typing pauses with
 * the version they were made on (`expectedUpdatedAt`); a version conflict (the Profile was saved elsewhere meanwhile)
 * hands over to the editor to reload; a failed save keeps the edits for the next edit or a retry. The saver holds no
 * Profile itself: it reads the editor's latest one when it sends, so each editor keeps its own store and history.
 */

/** `idle`: nothing sent yet this visit. `error`: the last save failed; the next edit or a retry sends again. */
export type ProfileDraftStatus = "idle" | "saving" | "saved" | "error";

/** A resume whose parts still matching the Profile followed a save. */
export type FollowedResume = { id: string; name: string };

/** What the server returns for a save (`profile.update`). */
export type ProfileSaveResult = { data: ProfileData; updatedAt: Date | null; updatedResumes: FollowedResume[] };

/** The Profile on screen as the server should receive it, and the version it was read at (null before the first save). */
export type ProfileDraftSnapshot = { data: ProfileData; updatedAt: Date | null };

export type ProfileSaverOptions = {
	/** The editor's latest Profile, or null while none is loaded. */
	read: () => ProfileDraftSnapshot | null;
	/** Sends it (`profile.update`). */
	send: (input: { data: ProfileData; expectedUpdatedAt: Date | null }) => Promise<ProfileSaveResult>;
	/** Whether a failed send means the Profile was saved elsewhere since it was read. */
	isConflict: (error: unknown) => boolean;
	/** Status changes, for the editor's save note. */
	onStatus: (status: ProfileDraftStatus) => void;
	/** A save went through: keep `result.updatedAt` as the next version and update the Profile's readers. */
	onSaved: (result: ProfileSaveResult) => void;
	/**
	 * The Profile was saved elsewhere: the edits that couldn't be saved are dropped, and the editor reads it again and
	 * says so. The saver waits for it before resolving.
	 */
	onConflict: () => Promise<void> | void;
	/** How long typing must pause before a save. */
	delayMs?: number | undefined;
	/** Timers, replaceable in tests. */
	setTimer?: ((run: () => void, ms: number) => unknown) | undefined;
	clearTimer?: ((timer: unknown) => void) | undefined;
};

export type ProfileSaver = {
	/** An edit was made: save once typing pauses. */
	queue: () => void;
	/**
	 * Sends the latest edits now and resolves once they're saved (false if saving failed or hit a conflict). For leaving
	 * the editor, the app going to the background, and before an action the server runs on the saved Profile.
	 */
	saveNow: () => Promise<boolean>;
	/** Sends again after a failure. */
	retry: () => Promise<boolean>;
	/** A fresh Profile was loaded: forget pending edits (nothing on screen is unsaved anymore). */
	reset: () => void;
	/** Edits not on the server yet: typed and waiting, or on their way. */
	hasUnsavedChanges: () => boolean;
};

export const PROFILE_SAVE_DELAY_MS = 800;

/** Adds the resumes a save carried changes into, keeping each once, for "Updated in N resumes". */
export function mergeFollowed(known: readonly FollowedResume[], added: readonly FollowedResume[]): FollowedResume[] {
	return [...known, ...added.filter((resume) => !known.some((item) => item.id === resume.id))];
}

export function createProfileSaver(options: ProfileSaverOptions): ProfileSaver {
	const delay = options.delayMs ?? PROFILE_SAVE_DELAY_MS;
	const setTimer = options.setTimer ?? ((run: () => void, ms: number) => setTimeout(run, ms));
	const clearTimer = options.clearTimer ?? ((timer: unknown) => clearTimeout(timer as ReturnType<typeof setTimeout>));

	let timer: unknown;
	let saving: Promise<boolean> | null = null;
	let unsent = false;

	const cancelTimer = () => {
		if (timer !== undefined) clearTimer(timer);
		timer = undefined;
	};

	const saveNow = (): Promise<boolean> => {
		cancelTimer();
		if (saving) return saving.then(() => (unsent ? saveNow() : true));
		const snapshot = options.read();
		if (!unsent || !snapshot) return Promise.resolve(true);

		unsent = false;
		options.onStatus("saving");
		const attempt = (async () => {
			try {
				const result = await options.send({ data: snapshot.data, expectedUpdatedAt: snapshot.updatedAt });
				options.onSaved(result);
				options.onStatus(unsent ? "saving" : "saved");
				return true;
			} catch (error) {
				if (options.isConflict(error)) {
					unsent = false;
					await options.onConflict();
					return false;
				}
				unsent = true;
				options.onStatus("error");
				return false;
			} finally {
				saving = null;
			}
		})();
		saving = attempt;

		// Edits typed while the save was on its way go next.
		return attempt.then((saved) => (saved && unsent ? saveNow() : saved));
	};

	return {
		queue: () => {
			unsent = true;
			cancelTimer();
			timer = setTimer(() => {
				timer = undefined;
				void saveNow();
			}, delay);
		},
		saveNow,
		retry: () => {
			unsent = true;
			return saveNow();
		},
		reset: () => {
			cancelTimer();
			unsent = false;
		},
		hasUnsavedChanges: () => unsent || saving !== null,
	};
}
