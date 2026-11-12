/**
 * The Manifest V3 file, written by scripts/build.ts into dist/manifest.json. Every permission here has its reason in
 * .agents/docs/plans/plugin-browser/02-teknis.md §12; a new one needs a reason there first.
 */

/** Chrome 116 is the first with `sidePanel.open()`; Edge follows Chromium's numbering. */
export const MINIMUM_CHROME_VERSION = "116";

/**
 * The four job boards with their own reader: the content script runs only there. ponytail: the hosts are the plan's
 * first guess; Phase 03 settles them against real pages (country subdomains of LinkedIn, Glints and JobStreet).
 */
export const JOB_BOARD_MATCHES = [
	"https://www.linkedin.com/*",
	"https://*.indeed.com/*",
	"https://*.jobstreet.com/*",
	"https://glints.com/*",
] as const;

/**
 * The Chrome Web Store item's public key (not a secret: it only fixes the extension id). Development builds carry it so
 * "Load unpacked" gets the store's id, and with it the same OAuth redirect address. Filled in from the store draft
 * (02-teknis.md §15).
 */
// Chrome Web Store item fiogmglhgeiaaeajahbpmmehgmojbjjo.
export const CHROME_STORE_PUBLIC_KEY: string | undefined =
	"MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAsJG/XlEoimADPCfRO0tlIBGaSA8eXuChajw6vNjzd0YcLdpSrmYZx/xqL7zygY6w5lzz+xA7WXKSZNdzBxqzlnpznPk3Vk0ym+LMZXElW73p80a6AzMkc5iLfxGKP1UhrOirXS6lsrU5Z8DErDFyd9OVXRfeSJPD1J9kPRJ0l8vWx1GFvnLc8NAPY2QEWlgrJhIZRGLkuI7Y262X26aCPklyYZyiPSWuqAq4RxJ4VKfC9lU2oO+OOls7U5XwEiyGsioZNs6vXS8s3Ol4b2nLVb3M93/1Eyw1dOVoYKQrCqJKuJjw1gEoY4PlvmBksl8KAA/TyC10OZXdfpszhmI8OwIDAQAB";

export type ManifestOptions = {
	/** From package.json; the stores refuse a version that goes down. */
	version: string;
	/** The Rezumi server the extension talks to (REZUMI_URL at build time). */
	rezumiUrl: string;
	/**
	 * The Chrome Web Store item's public key, in development builds only, so "Load unpacked" gets the store's
	 * extension id (and the same OAuth redirect address). The store refuses an upload that carries it.
	 */
	key?: string | undefined;
};

export function buildManifest({ version, rezumiUrl, key }: ManifestOptions): chrome.runtime.ManifestV3 {
	const server = new URL(rezumiUrl);
	return {
		manifest_version: 3,
		name: "__MSG_extName__",
		short_name: "Rezumi",
		description: "__MSG_extDescription__",
		default_locale: "en",
		version,
		minimum_chrome_version: MINIMUM_CHROME_VERSION,
		icons: { 16: "icons/icon-16.png", 32: "icons/icon-32.png", 48: "icons/icon-48.png", 128: "icons/icon-128.png" },
		action: {
			default_title: "__MSG_actionTitle__",
			default_icon: { 16: "icons/icon-16.png", 32: "icons/icon-32.png" },
		},
		side_panel: { default_path: "sidepanel.html" },
		background: { service_worker: "background.js", type: "module" },
		permissions: ["sidePanel", "storage", "identity", "activeTab", "scripting", "contextMenus", "alarms"],
		optional_permissions: ["notifications"],
		host_permissions: [...JOB_BOARD_MATCHES, `${server.origin}/*`],
		content_scripts: [{ matches: [...JOB_BOARD_MATCHES], js: ["content.js"], run_at: "document_idle" }],
		commands: {
			_execute_action: { suggested_key: { default: "Alt+Shift+S" }, description: "__MSG_actionTitle__" },
		},
		...(key ? { key } : {}),
	};
}
