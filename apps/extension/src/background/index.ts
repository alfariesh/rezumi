/**
 * The service worker: signs in to Rezumi and holds the tokens (the panel asks it for an access token per call). It
 * opens the side panel from the toolbar icon, keeps what each tab's content script reports, and runs the alarms.
 */
import type { TabPage } from "../shared/storage";
import { EXTENSION_VERSION, REZUMI_ORIGIN } from "../shared/config";
import { tabPageKey } from "../shared/storage";
import { registerAlarms, runAlarm } from "./alarms";
import { ConnectError, createAuth } from "./auth";
import { createMessageRouter } from "./router";

// The toolbar icon (and its keyboard shortcut) opens the side panel for the active tab.
void chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

const auth = createAuth({
	origin: REZUMI_ORIGIN,
	redirectUri: chrome.identity.getRedirectURL(),
	local: chrome.storage.local,
	session: chrome.storage.session,
	fetch: (input, init) => fetch(input, init),
	launchWebAuthFlow: (url) => chrome.identity.launchWebAuthFlow({ url, interactive: true }),
});

const connectErrorCode = (error: unknown) =>
	error instanceof ConnectError ? error.code : error instanceof TypeError ? "network" : "failed";

const route = createMessageRouter({
	extensionId: chrome.runtime.id,
	extensionOrigin: chrome.runtime.getURL(""),
	handlers: {
		page: async ({ url, site, key }, tabId) => {
			const page: TabPage = { url, site, key, seenAt: Date.now() };
			await chrome.storage.session.set({ [tabPageKey(tabId)]: page });
			if (__DEV__) console.info(`[Rezumi] tab ${tabId}: ${key ?? "no posting"} (${url})`);
			return { ok: true };
		},
		status: async () => ({ ...(await auth.status()), version: EXTENSION_VERSION }),
		connect: async () => {
			try {
				return { ok: true, account: await auth.connect() };
			} catch (error) {
				return { ok: false, code: connectErrorCode(error) };
			}
		},
		disconnect: async () => {
			await auth.disconnect();
			return { ok: true };
		},
		token: async ({ force }) => {
			try {
				return { accessToken: await auth.accessToken({ force: force ?? false }) };
			} catch {
				return { accessToken: null, offline: true };
			}
		},
		expire: async () => {
			await auth.expire();
			return { ok: true };
		},
	},
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
	void route(message, sender).then(sendResponse);
	// The answer is sent asynchronously.
	return true;
});

chrome.tabs.onRemoved.addListener((tabId) => {
	void chrome.storage.session.remove(tabPageKey(tabId));
});

chrome.runtime.onInstalled.addListener(() => {
	void registerAlarms();
});
chrome.runtime.onStartup.addListener(() => {
	void registerAlarms();
});
chrome.alarms.onAlarm.addListener((alarm) => {
	void runAlarm(alarm);
});
