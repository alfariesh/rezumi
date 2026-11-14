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
