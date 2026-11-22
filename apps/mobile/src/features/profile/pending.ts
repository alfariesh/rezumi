// Profile edits not on the server yet, kept on this device per account so a force-quit after a failed (offline) save
// doesn't lose them. Written when a save fails or the app leaves the foreground with edits waiting, removed once they
// save; the next open of the same account sends them again. Sign-out removes the account's copy
// (`scopedStoragePrefixes` in src/auth/session.ts).
import type { ProfileData } from "@rezumi/schema/profile/data";
import { profileDataSchema } from "@rezumi/schema/profile/data";

type KeyValueStorage = {
	getItemSync: (key: string) => string | null;
	setItemSync: (key: string, value: string) => void;
	removeItemSync: (key: string) => void;
};

/** The edits and the version they were made on (null before the Profile's first save). */
type PendingProfile = { data: ProfileData; updatedAt: Date | null };

const PENDING_PROFILE_PREFIX = "rezumi:profile-pending:";

const keyOf = (scope: string) => `${PENDING_PROFILE_PREFIX}${scope}:edits`;

export function loadPendingProfile(storage: KeyValueStorage, scope: string): PendingProfile | null {
	try {
		const raw = storage.getItemSync(keyOf(scope));
		if (!raw) return null;
		const value = JSON.parse(raw) as { v?: unknown; data?: unknown; updatedAt?: unknown };
		if (value.v !== 1) return null;
		const data = profileDataSchema.safeParse(value.data);
		if (!data.success) return null;
		const updatedAt = typeof value.updatedAt === "string" ? new Date(value.updatedAt) : null;
		if (updatedAt && Number.isNaN(updatedAt.getTime())) return null;
		return { data: data.data, updatedAt };
	} catch {
		return null;
	}
}

/** Keeps the edits; a full or failing store only means they can't come back after a restart. */
export function storePendingProfile(storage: KeyValueStorage, scope: string, pending: PendingProfile) {
	try {
		storage.setItemSync(
			keyOf(scope),
			JSON.stringify({ v: 1, data: pending.data, updatedAt: pending.updatedAt?.toISOString() ?? null }),
		);
	} catch {
		// The edits stay on screen; they just won't survive the app being closed.
	}
}

export function clearPendingProfile(storage: KeyValueStorage, scope: string) {
	try {
		storage.removeItemSync(keyOf(scope));
	} catch {
		// Left behind: the next open sends it again, and the version check catches anything stale.
	}
}
