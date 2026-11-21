// The entry forms pointed at the Profile, and the hook that keeps the open Profile in step with the server.
import type { WriteSource } from "@/features/entries/source";
import { useLingui } from "@lingui/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { closeProfile, openProfile, saveProfileNow, undoProfile, updateProfile, useProfileEditor } from "./store";
import { useSession } from "@/auth/session";
import { profileQuery } from "@/features/onboarding/queries";

const noop = () => undefined;

export const profileWriteSource: WriteSource = {
	kind: "profile",
	useData: (select, fallback) => useProfileEditor((state) => (state.data ? select(state.data) : fallback)),
	getData: () => useProfileEditor.getState().data,
	update: updateProfile,
	undo: undoProfile,
	useLocked: () => false,
	// The Profile has no page of its own: dates read and show in the app's language.
	usePage: () => ({ locale: useLingui().i18n.locale }),
	focus: { onFocus: noop, onBlur: noop },
};

/**
 * Reads the Profile and opens it in the editor; a newer version read later (pull to refresh, the app coming back)
 * replaces it unless edits are waiting. Leaving the Profile tab sends what's unsent.
 */
export function useProfileQuery() {
	const session = useSession();
	const queryClient = useQueryClient();
	const query = useQuery({ ...profileQuery(session.server), enabled: session.status === "signed-in" });
	const ready = useProfileEditor((state) => state.data !== null && state.server === session.server);

	useEffect(() => {
		if (query.data && session.status === "signed-in") openProfile(query.data, session.server, queryClient);
	}, [query.data, session.server, session.status, queryClient]);

	useEffect(() => {
		if (session.status !== "signed-in") closeProfile();
	}, [session.status]);

	useEffect(() => () => void saveProfileNow(), []);

	return { query, ready };
}
