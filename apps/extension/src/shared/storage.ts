/**
 * Storage keys. `chrome.storage.session` holds per-tab state (and, from Phase 02, the access token): it lives in
 * memory, is cleared when the browser closes, and content scripts cannot read it.
 */

/** The page a tab shows and the posting it has open, as its content script last reported. */
export const tabPageKey = (tabId: number) => `tabPage:${tabId}`;

export type TabPage = {
	url: string;
	site: string | null;
	key: string | null;
	/** When the content script reported it (ms since epoch). */
	seenAt: number;
};
