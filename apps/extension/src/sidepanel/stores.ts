import type { SavedKeys, SavedPosting, Settings } from "../shared/storage";
import { useCallback, useEffect, useState } from "react";
import { REZUMI_ORIGIN } from "../shared/config";
import { readSettings, SAVED_KEYS, SETTINGS } from "../shared/storage";

/**
 * The panel's view of what the extension keeps in `chrome.storage` (the panel is a trusted extension page and may read
 * it): its settings and the saved posting keys, followed live as the service worker or another window changes them.
 */

function useStored<T>(area: "local" | "session", key: string, read: (value: unknown) => T): T | undefined {
	const [value, setValue] = useState<T | undefined>(undefined);
	useEffect(() => {
		let active = true;
		void chrome.storage[area].get(key).then((stored) => {
			if (active) setValue(read(stored[key]));
		});
		const listener = (changes: Record<string, chrome.storage.StorageChange>, changed: string) => {
			if (changed === area && key in changes) setValue(read(changes[key]?.newValue));
		};
		chrome.storage.onChanged.addListener(listener);
		return () => {
			active = false;
			chrome.storage.onChanged.removeListener(listener);
		};
	}, [area, key, read]);
	return value;
}

/** The extension's settings (defaults until they load). */
export function useSettings(): [Settings | undefined, (patch: Partial<Settings>) => Promise<void>] {
	const settings = useStored("local", SETTINGS, readSettings);
	const update = useCallback(async (patch: Partial<Settings>) => {
		const stored = await chrome.storage.local.get(SETTINGS);
		await chrome.storage.local.set({ [SETTINGS]: { ...readSettings(stored[SETTINGS]), ...patch } });
	}, []);
	return [settings, update];
}

const readSavedKeys = (value: unknown) => {
	const saved = value as SavedKeys | undefined;
	return saved && saved.origin === REZUMI_ORIGIN ? saved : null;
};

/**
 * The application already saved for a posting key, from the local copy (no request: 02-teknis.md §9). `undefined`
 * while the copy loads.
 */
export function useSavedPosting(key: string | null): SavedPosting | null | undefined {
	const saved = useStored("local", SAVED_KEYS, readSavedKeys);
	if (saved === undefined) return undefined;
	return key ? (saved?.keys[key] ?? null) : null;
}
