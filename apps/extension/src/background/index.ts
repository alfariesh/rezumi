/**
 * The service worker: the only part that will hold the account's tokens and call the Rezumi API (from Phase 02). It
 * opens the side panel from the toolbar icon, keeps what each tab's content script reports, and runs the alarms.
 */
import type { TabPage } from "../shared/storage";
import { EXTENSION_VERSION } from "../shared/config";
import { tabPageKey } from "../shared/storage";
import { registerAlarms, runAlarm } from "./alarms";
import { createMessageRouter } from "./router";

// The toolbar icon (and its keyboard shortcut) opens the side panel for the active tab.
void chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

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
		status: () => Promise.resolve({ connected: false, version: EXTENSION_VERSION }),
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
