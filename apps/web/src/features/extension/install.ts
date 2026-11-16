/**
 * Where the Rezumi browser extension is installed from (plan: .agents/docs/plans/plugin-browser, Phase 06).
 *
 * Both addresses stay empty until the extension is published (Phase 07). While they are empty nothing on the site asks
 * anyone to install it. Fill them with the stores' detail pages:
 * - Chrome Web Store: https://chromewebstore.google.com/detail/<item id>
 * - Edge Add-ons: https://microsoftedge.microsoft.com/addons/detail/<store id>
 */
export const EXTENSION_STORE_URLS = { chrome: "", edge: "" } as const;

export type ExtensionStore = "chrome" | "edge";
export type ExtensionStoreUrls = Readonly<Record<ExtensionStore, string>>;

/**
 * The store for a visitor's browser: Edge Add-ons for Edge, the Chrome Web Store for the other Chromium desktop browsers
 * (Chrome, Brave, Vivaldi, Arc). Firefox, Safari, Opera and phones can't install it, so they get no store.
 */
export function browserStore(userAgent: string): ExtensionStore | null {
	if (/Mobi|Android|iPhone|iPad|iPod|CrOS|OPR\/|Opera|Firefox|FxiOS/i.test(userAgent)) return null;
	if (/Edg\//.test(userAgent)) return "edge";
	return /Chrome\//.test(userAgent) ? "chrome" : null;
}

export type ExtensionInstall = {
	/** The store address for this browser, or null when it can't install the extension or the address isn't set yet. */
	url: string | null;
	store: ExtensionStore | null;
	/** Whether any store address is set: false hides every invitation to install. */
	published: boolean;
};

export function extensionInstall(userAgent: string, urls: ExtensionStoreUrls = EXTENSION_STORE_URLS): ExtensionInstall {
	const store = browserStore(userAgent);
	const url = store ? urls[store].trim() : "";
	return { url: url || null, store: url ? store : null, published: Boolean(urls.chrome.trim() || urls.edge.trim()) };
}

/** The install state for the browser this page runs in. */
export function currentExtensionInstall(urls: ExtensionStoreUrls = EXTENSION_STORE_URLS): ExtensionInstall {
	return extensionInstall(typeof navigator === "undefined" ? "" : navigator.userAgent, urls);
}
