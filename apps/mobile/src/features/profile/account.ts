// The account the Profile screens belong to: the draft store's scope (`JSON.stringify([server, user id])`), so two
// accounts on one server never share an open Profile, a story draft or a pending Undo. It stays through `expired`,
// where the session gate keeps the person on screen to sign in again, and clears on sign-out.
import { useSyncExternalStore } from "react";
import { getAccountScope, getSession, subscribeSession } from "@/auth/session";

let last: string | null = null;

/** The signed-in account, or while signed out again (expired, still loading) the last one; null once signed out. */
export function profileAccount(): string | null {
	const { status } = getSession();
	if (status === "signed-in") last = getAccountScope();
	else if (status === "signed-out") last = null;
	return last;
}

/** `profileAccount`, re-rendering when the session changes. Key account-scoped screens with it. */
export function useProfileAccount(): string | null {
	return useSyncExternalStore(subscribeSession, profileAccount);
}
