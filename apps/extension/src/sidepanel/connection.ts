import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { AUTH_KEYS } from "../shared/storage";
import { askWorker } from "./api";

export const connectionKey = ["connection"] as const;

/**
 * Whether the extension is connected, and to whom. Follows changes made anywhere (this panel, another window's panel,
 * the service worker ending an expired connection): account data cached for a previous connection is dropped.
 */
export function useConnection() {
	const queryClient = useQueryClient();
	useEffect(() => {
		const keys = new Set<string>([AUTH_KEYS.refresh, AUTH_KEYS.account, AUTH_KEYS.state]);
		const listener = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
			if (area !== "local" || !Object.keys(changes).some((key) => keys.has(key))) return;
			queryClient.removeQueries({ predicate: (query) => query.queryKey[0] !== connectionKey[0] });
			void queryClient.invalidateQueries({ queryKey: connectionKey });
		};
		chrome.storage.onChanged.addListener(listener);
		return () => chrome.storage.onChanged.removeListener(listener);
	}, [queryClient]);

	return useQuery({ queryKey: connectionKey, queryFn: () => askWorker({ type: "status" }), staleTime: Infinity });
}
