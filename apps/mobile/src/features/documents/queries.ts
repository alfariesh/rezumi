import type { DocumentSummary } from "./filter";
import { t } from "@lingui/core/macro";
import { ORPCError } from "@orpc/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getNetworkStateAsync } from "expo-network";
import { useRef, useState } from "react";
import { documentRef } from "./filter";
import { client, orpc } from "@/api/client";
import { getServer, useSession } from "@/auth/session";
import { showToast } from "@/ui";

export function documentError(error: unknown) {
	if (error instanceof ORPCError) {
		if (error.code === "UNAUTHORIZED") return t`Your session expired. Sign in again.`;
		if (error.code === "FORBIDDEN") return t`Unlock it first, then try again.`;
		if (error.code === "NOT_FOUND") return t`This document is no longer available. Refresh and try again.`;
		if (error.code === "TOO_MANY_REQUESTS" || error.code === "RATE_LIMIT_EXCEEDED")
			return t`Too many requests. Try again later.`;
		if (error.code === "BAD_REQUEST") return t`Check the file or fields and try again.`;
		if (error.code === "RESUME_SLUG_ALREADY_EXISTS")
			return t`Another resume already uses this address. Choose a different one.`;
		if (error.code === "RESUME_LOCKED") return t`This resume is locked. Unlock it to make changes.`;
		if (error.code === "INVALID_SLUG")
			return `${t`Use at most 64 characters.`} ${t`The address must contain only lowercase letters and numbers, separated by single dashes.`}`;
	}
	return t`Couldn't complete this action. Try again.`;
}

/** The library (or Trash); `enabled` false keeps a read the screen doesn't show yet from loading. */
export function useDocuments(trashed = false, enabled = true) {
	const session = useSession();
	const options = orpc.documents.list.queryOptions({ input: { trashed } });
	return useQuery({
		...options,
		queryKey: [...options.queryKey, session.server],
		enabled: enabled && session.status === "signed-in",
	});
}

function useDocumentRefresh() {
	const queryClient = useQueryClient();
	return () =>
		Promise.all([
			queryClient.invalidateQueries({ queryKey: orpc.documents.key() }),
			queryClient.invalidateQueries({ queryKey: orpc.resume.key() }),
			queryClient.invalidateQueries({ queryKey: orpc.coverLetters.key() }),
			queryClient.invalidateQueries({ queryKey: orpc.applications.key() }),
		]);
}

/**
 * Serialize user actions: check the session and network first, report a failure as a translated toast (and in `error`
 * for screens that show it inline), and refresh the library after each one.
 */
export function useDocumentOperations() {
	const refresh = useDocumentRefresh();
	const session = useSession();
	const active = useRef(false);
	const idle = useRef(Promise.resolve());
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const fail = (message: string) => {
		setError(message);
		showToast({ title: message, variant: "danger" });
		return false;
	};
	const run = async (task: () => Promise<unknown>) => {
		if (active.current) return false;
		active.current = true;
		let finish = () => {};
		idle.current = new Promise<void>((resolve) => {
			finish = resolve;
		});
		setBusy(true);
		setError(null);
		try {
			if (session.status !== "signed-in" || getServer() !== session.server) {
				return fail(t`Sign in to continue.`);
			}
			const network = await getNetworkStateAsync();
			if (network.isConnected === false || network.isInternetReachable === false) {
				return fail(t`You're offline. Try again when you reconnect.`);
			}
			if (getServer() !== session.server) return false;
			await task();
			return true;
		} catch (cause) {
			return fail(documentError(cause));
		} finally {
			try {
				await refresh();
			} finally {
				active.current = false;
				setBusy(false);
				finish();
			}
		}
	};
	/** Move to Trash with Undo; a failure reports the server's reason through `run`. */
	const trash = async (document: DocumentSummary) => {
		const moved = await run(() => client.documents.trash(documentRef(document)));
		if (moved)
			showToast({
				title: t`“${document.name}” moved to Trash`,
				undo: {
					label: t`Undo`,
					onUndo: () => {
						void idle.current.then(() => run(() => client.documents.restore(documentRef(document))));
					},
				},
			});
		return moved;
	};
	return { run, trash, busy, error };
}
