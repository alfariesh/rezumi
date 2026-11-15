import type { PageState } from "../shared/messages";
import type { SavedKeys, SavedPosting, Settings, TabPage } from "../shared/storage";
import { resolveLanguage } from "../shared/storage";

/**
 * The "Saved" marks (02-teknis.md §9): the account's saved posting keys, fetched from the server and kept in
 * `chrome.storage.local`, matched here against the key each tab's content script reports. No request is made per
 * page visited, and no visited address leaves the browser.
 */

/** Fetch the keys again when the copy is older than this and the panel opens (the alarm runs every 30 minutes). */
export const SAVED_KEYS_MAX_AGE_MS = 5 * 60 * 1000;

type SavedKeyRow = { key: string; id: string; status: string };

/** The server's list (newest first) as a lookup; the newest application wins when a key was saved twice. */
export function toSavedKeys(origin: string, rows: readonly SavedKeyRow[], now = Date.now()): SavedKeys {
	const keys: Record<string, SavedPosting> = {};
	for (const { key, id, status } of rows) keys[key] ??= { id, status };
	return { origin, syncedAt: now, keys };
}

/** The saved application for a key, from a copy that belongs to this server. */
export function lookupSaved(saved: SavedKeys | null, origin: string, key: string | null): SavedPosting | null {
	if (!key || !saved || saved.origin !== origin) return null;
	return saved.keys[key] ?? null;
}

/** Records one save or status change in the local copy (before the next full fetch). */
export function withSaved(saved: SavedKeys | null, origin: string, key: string, posting: SavedPosting): SavedKeys {
	const base = saved && saved.origin === origin ? saved : { origin, syncedAt: 0, keys: {} };
	return { ...base, keys: { ...base.keys, [key]: posting } };
}

/** What a tab's on-page button shows (01-desain.md §4, aturan turunan #5: also before connecting, unless turned off). */
export function pageState(input: {
	page: Pick<TabPage, "site" | "key"> | null;
	settings: Settings;
	connected: boolean;
	saved: SavedKeys | null;
	origin: string;
	uiLanguage: string;
}): PageState {
	const { page, settings, connected } = input;
	const onBoardPosting = Boolean(page?.site && page.key);
	return {
		button: onBoardPosting && settings.pageButton,
		floating: Boolean(page?.site) && !settings.floatingHidden.includes(page?.site ?? ""),
		connected,
		saved: connected ? lookupSaved(input.saved, input.origin, page?.key ?? null) : null,
		locale: resolveLanguage(settings.language, input.uiLanguage),
	};
}
