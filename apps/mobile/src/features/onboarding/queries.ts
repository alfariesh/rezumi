import type { KeyValueStorage } from "./saved-run";
// Onboarding's reads: the Profile it fills, the Preferences its two questions keep, and which sources the account and
// server offer. Keys carry the server, like every query in the app (the Preferences key matches features/career).
import type { RouterOutput } from "@/api/client";
import type { QueryClient } from "@tanstack/react-query";
import { useQuery } from "@tanstack/react-query";
import Storage from "expo-sqlite/kv-store";
import { needsOnboarding } from "@rezumi/career/onboarding";
import { clearSavedOnboarding, loadSavedOnboarding } from "./saved-run";
import { orpc } from "@/api/client";
import { useSession } from "@/auth/session";

export type ProfileDto = RouterOutput["profile"]["get"];
export type SourcesStatus = RouterOutput["profile"]["sources"]["status"];

export const profileQuery = (server: string) => ({
	...orpc.profile.get.queryOptions(),
	queryKey: [...orpc.profile.get.key(), server],
});

const preferencesQuery = (server: string) => ({
	...orpc.career.profile.queryOptions(),
	queryKey: [...orpc.career.profile.key(), server],
});

const statusQuery = (server: string) => ({
	...orpc.profile.sources.status.queryOptions(),
	queryKey: [...orpc.profile.sources.status.key(), server],
});

// The same key as Documents' list (features/documents/queries.ts), so both read one cache.
const documentsQuery = (server: string) => {
	const options = orpc.documents.list.queryOptions({ input: { trashed: false } });
	return { ...options, queryKey: [...options.queryKey, server] };
};

export function useOnboardingData() {
	const session = useSession();
	const enabled = session.status === "signed-in";
	return {
		profile: useQuery({ ...profileQuery(session.server), enabled }),
		preferences: useQuery({ ...preferencesQuery(session.server), enabled }),
		// An older server or a failed read: a file and GitHub still work (see `fallbackStatus`).
		status: useQuery({ ...statusQuery(session.server), enabled, retry: false }),
	};
}

/** Keeps a Profile onboarding saved in the cache, so Home and the next check see it at once. */
export function storeSavedProfile(queryClient: QueryClient, server: string, profile: ProfileDto) {
	queryClient.setQueryData(profileQuery(server).queryKey, profile);
}

export const preferencesKey = (server: string) => preferencesQuery(server).queryKey;

/**
 * Whether Home hands over to onboarding: a new account (Profile never saved, no documents, not a guest), or one whose
 * onboarding was left at the first resume after saving the Profile. A failed read never blocks Home: it just opens.
 */
export async function shouldStartOnboarding(
	queryClient: QueryClient,
	server: string,
	scope: string | null,
	storage: KeyValueStorage = Storage,
): Promise<boolean> {
	if (!scope) return false;
	try {
		const [profile, documents] = await Promise.all([
			queryClient.ensureQueryData(profileQuery(server)),
			queryClient.ensureQueryData(documentsQuery(server)),
		]);
		const saved = loadSavedOnboarding(storage, scope);
		const pickUp = saved !== null && saved.savedAt !== null && profile.updatedAt !== null;
		if (documents.length > 0 || (profile.updatedAt !== null && !pickUp)) {
			// Finished elsewhere (a document, a Profile saved on the web): nothing to pick up.
			if (saved) clearSavedOnboarding(storage, scope);
			return false;
		}
		if (pickUp) return true;
		const status = await queryClient.ensureQueryData(statusQuery(server));
		// Guests can't use most sources: the server offers them no website reading.
		return needsOnboarding({ isGuest: !status.website, profileUpdatedAt: profile.updatedAt, documentCount: 0 });
	} catch {
		return false;
	}
}
