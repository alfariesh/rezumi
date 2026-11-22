// Whether the device is online, as the query client sees it (`onlineManager` follows expo-network in query-client.ts).
import { onlineManager } from "@tanstack/react-query";
import { useSyncExternalStore } from "react";

const subscribe = (listener: () => void) => onlineManager.subscribe(listener);

export const isOnline = () => onlineManager.isOnline();

export function useOnline() {
	return useSyncExternalStore(subscribe, isOnline, isOnline);
}
