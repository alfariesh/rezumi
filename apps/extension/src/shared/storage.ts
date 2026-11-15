/**
 * Storage keys. `chrome.storage.session` holds per-tab state and the access token: it lives in memory, is cleared when
 * the browser closes, and content scripts cannot read it. `chrome.storage.local` holds the refresh token, the OAuth
 * client and the connected account (never `sync`: tokens stay on this device).
 */

/** Where the sign-in keeps its parts (src/background/auth.ts). */
export const AUTH_KEYS = {
	/** local: `{ origin, clientId }` from dynamic client registration. */
	client: "auth:client",
	/** local: `{ origin, refreshToken }`. */
	refresh: "auth:refresh",
	/** local: `{ name, email }` from the ID token at sign-in, for the panel. */
	account: "auth:account",
	/** local: why there is no connection: "signed-out" or "expired" (the panel says "Connect again"). */
	state: "auth:state",
	/** session: `{ origin, accessToken, expiresAt }`. */
	access: "auth:access",
} as const;

/** Who is connected, from the ID token's claims at sign-in (display only). */
export type Account = { name: string; email: string };

/** `connected`, never connected (or signed out), or ended by the server (refresh refused, access revoked). */
export type AuthState = "connected" | "signed-out" | "expired";

/** The page a tab shows and the posting it has open, as its content script last reported. */
export const tabPageKey = (tabId: number) => `tabPage:${tabId}`;

export type TabPage = {
	url: string;
	site: string | null;
	key: string | null;
	/** When the content script reported it (ms since epoch). */
	seenAt: number;
};

/**
 * local: the posting keys of the account's saved applications (`applications.savedKeys`), so the "Saved" marks are
 * worked out in the browser and no visited address ever leaves it (02-teknis.md §9). Removed on sign-out.
 */
export const SAVED_KEYS = "saved:keys";

export type SavedPosting = { id: string; status: string };

export type SavedKeys = {
	/** The server the keys came from (a development build and a store build never share them). */
	origin: string;
	/** When they were last fetched (ms since epoch). */
	syncedAt: number;
	keys: Record<string, SavedPosting>;
};

/** local: the extension's own settings (01-desain.md §3.8), kept on this device only. */
export const SETTINGS = "settings";

export type PanelLanguage = "system" | "en" | "id";

export type Settings = {
	/** The panel's and the on-page button's language; "system" follows the browser (02-teknis.md §13). */
	language: PanelLanguage;
	/** The "Save to Rezumi" button on the four boards (aturan turunan #5: on by default, also before connecting). */
	pageButton: boolean;
	/** "Read with AI", remembered on this device (aturan turunan #3: off by default). */
	readWithAi: boolean;
	/** Boards where the person closed the floating button (it shows when the board's usual spot is missing). */
	floatingHidden: string[];
};

export const DEFAULT_SETTINGS: Settings = {
	language: "system",
	pageButton: true,
	readWithAi: false,
	floatingHidden: [],
};

/** Settings as stored, with defaults for anything missing or malformed. */
export function readSettings(value: unknown): Settings {
	const stored = (value && typeof value === "object" ? value : {}) as Partial<Record<keyof Settings, unknown>>;
	return {
		language: stored.language === "en" || stored.language === "id" ? stored.language : "system",
		pageButton: typeof stored.pageButton === "boolean" ? stored.pageButton : DEFAULT_SETTINGS.pageButton,
		readWithAi: typeof stored.readWithAi === "boolean" ? stored.readWithAi : DEFAULT_SETTINGS.readWithAi,
		floatingHidden: Array.isArray(stored.floatingHidden)
			? stored.floatingHidden.filter((site): site is string => typeof site === "string").slice(0, 10)
			: [],
	};
}

/** The language to use: the extension's setting, else the browser's when it is Indonesian, else English. */
export function resolveLanguage(setting: PanelLanguage, uiLanguage: string): "en" | "id" {
	if (setting !== "system") return setting;
	return /^id\b|^in\b/i.test(uiLanguage) ? "id" : "en";
}

/** session: what the person typed into a tab's save form, so closing the panel loses nothing (01-desain.md §1). */
export const draftKey = (tabId: number) => `draft:${tabId}`;

/** session: text the person saved through the context menu in a tab, until the panel reads it. */
export const tabSelectionKey = (tabId: number) => `tabSelection:${tabId}`;
