import type { AppStateStatus } from "react-native";
import { ORPCError } from "@orpc/client";
import { focusManager, onlineManager, QueryClient } from "@tanstack/react-query";
import * as Network from "expo-network";
import { AppState } from "react-native";
import { SessionChangedError } from "./client";

const MAX_RETRIES = 2;

/** Retry network hiccups and server errors, never answers that would come back the same (4xx) or a switched account. */
export function shouldRetry(failureCount: number, error: unknown) {
	if (failureCount >= MAX_RETRIES) return false;
	if (error instanceof SessionChangedError) return false;
	if (error instanceof ORPCError && error.status >= 400 && error.status < 500) return false;
	return true;
}

export function createQueryClient() {
	return new QueryClient({
		defaultOptions: {
			// Queries pause while offline (`networkMode: "online"`) and resume when `onlineManager` says so.
			queries: { staleTime: 30_000, retry: shouldRetry },
			// A mutation may not be safe to send twice; screens that can retry say so themselves.
			mutations: { retry: false },
		},
	});
}

export const queryClient = createQueryClient();

type Reachability = { isConnected?: boolean | null | undefined; isInternetReachable?: boolean | null | undefined };

/** Unknown (`null`, common on Android before the first probe) counts as reachable, so the app never sticks offline. */
export function isOnline(state: Reachability) {
	return state.isConnected !== false && state.isInternetReachable !== false;
}

/**
 * Ties TanStack Query to the app: refetch stale queries when the app comes back to the foreground, and pause or
 * resume queries with the network. Call once from the root layout; returns the cleanup.
 */
export function bindQueryManagers() {
	const appState = AppState.addEventListener("change", (status: AppStateStatus) => {
		focusManager.setFocused(status === "active");
	});
	onlineManager.setEventListener((setOnline) => {
		const subscription = Network.addNetworkStateListener((state) => setOnline(isOnline(state)));
		void Network.getNetworkStateAsync()
			.then((state) => setOnline(isOnline(state)))
			.catch(() => undefined);
		return () => subscription.remove();
	});
	return () => {
		appState.remove();
		onlineManager.setEventListener(() => undefined);
	};
}
