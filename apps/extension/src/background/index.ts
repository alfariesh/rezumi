/**
 * The service worker: signs in to Rezumi and holds the tokens (the panel asks it for an access token per call). It
 * opens the side panel from the toolbar icon, the on-page button and the context menu, keeps what each tab's content
 * script reports, keeps the saved posting keys behind the "Saved" marks and the toolbar badge, and runs the alarms.
 */
import type { PageState, PageStateUpdate } from "../shared/messages";
import type { SavedKeys, TabPage } from "../shared/storage";
import { EXTENSION_VERSION, REZUMI_ORIGIN } from "../shared/config";
import {
	AUTH_KEYS,
	draftKey,
	readSettings,
	resolveLanguage,
	SAVED_KEYS,
	SETTINGS,
	tabPageKey,
	tabSelectionKey,
} from "../shared/storage";
import { registerAlarms, runAlarm } from "./alarms";
import { createWorkerClient } from "./api";
import { ConnectError, createAuth } from "./auth";
import { createMessageRouter } from "./router";
import { pageState, SAVED_KEYS_MAX_AGE_MS, toSavedKeys, withSaved } from "./saved";

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
const api = createWorkerClient(auth);

const connectErrorCode = (error: unknown) =>
	error instanceof ConnectError ? error.code : error instanceof TypeError ? "network" : "failed";

// --- Saved posting keys (02-teknis.md §9) ---

async function storedSavedKeys(): Promise<SavedKeys | null> {
	const stored = await chrome.storage.local.get(SAVED_KEYS);
	return (stored[SAVED_KEYS] as SavedKeys | undefined) ?? null;
}

let syncing: Promise<void> | null = null;

/** Fetches the saved keys again (one at a time); quietly keeps the old copy when offline or signed out. */
function syncSavedKeys(): Promise<void> {
	syncing ??= (async () => {
		try {
			if ((await auth.status()).state !== "connected") return;
			const { keys } = await api.applications.savedKeys();
			await chrome.storage.local.set({ [SAVED_KEYS]: toSavedKeys(REZUMI_ORIGIN, keys) });
		} catch (error) {
			if (__DEV__) console.warn("[Rezumi] saved keys not refreshed", error);
		} finally {
			syncing = null;
		}
	})();
	return syncing;
}

async function syncIfStale() {
	const saved = await storedSavedKeys();
	if (!saved || saved.origin !== REZUMI_ORIGIN || Date.now() - saved.syncedAt > SAVED_KEYS_MAX_AGE_MS)
		await syncSavedKeys();
}

// --- Each tab's on-page button and toolbar badge (01-desain.md §4, §5) ---

async function stateFor(page: TabPage | null): Promise<PageState> {
	const [{ state }, stored] = await Promise.all([auth.status(), chrome.storage.local.get([SAVED_KEYS, SETTINGS])]);
	return pageState({
		page,
		settings: readSettings(stored[SETTINGS]),
		connected: state === "connected",
		saved: (stored[SAVED_KEYS] as SavedKeys | undefined) ?? null,
		origin: REZUMI_ORIGIN,
		uiLanguage: chrome.i18n.getUILanguage(),
	});
}

const BADGE_TITLES = {
	en: "Rezumi: this job is saved",
	id: "Rezumi: loker ini sudah tersimpan",
} as const;

/** A green check on the toolbar icon in a tab whose posting is saved; the default title otherwise. */
async function setBadge(tabId: number, state: PageState) {
	try {
		await chrome.action.setBadgeText({ tabId, text: state.saved ? "✓" : "" });
		if (state.saved) {
			await chrome.action.setBadgeBackgroundColor({ tabId, color: "#16a34a" });
			await chrome.action.setBadgeTextColor({ tabId, color: "#ffffff" });
		}
		// An empty title puts the manifest's default back.
		await chrome.action.setTitle({ tabId, title: state.saved ? BADGE_TITLES[state.locale] : "" });
	} catch {
		// The tab closed meanwhile.
	}
}

/** Works out a tab's state again, updates its badge and tells its content script. */
async function refreshTab(tabId: number) {
	const stored = await chrome.storage.session.get(tabPageKey(tabId));
	const page = (stored[tabPageKey(tabId)] as TabPage | undefined) ?? null;
	const state = await stateFor(page);
	await setBadge(tabId, state);
	if (!page?.site) return;
	const update: PageStateUpdate = { type: "state", key: page.key, state };
	// Rejects when the tab has no content script any more (navigated away); nothing to do then.
	await chrome.tabs.sendMessage(tabId, update, { frameId: 0 }).catch(() => {});
}

async function refreshAllTabs() {
	const stored = await chrome.storage.session.get(null);
	const tabIds = Object.keys(stored).flatMap((key) => {
		const id = /^tabPage:(\d+)$/.exec(key)?.[1];
		return id ? [Number(id)] : [];
	});
	await Promise.all(tabIds.map(refreshTab));
}

// --- Messages ---

const route = createMessageRouter({
	extensionId: chrome.runtime.id,
	extensionOrigin: chrome.runtime.getURL(""),
	handlers: {
		page: async ({ url, site, key }, tabId) => {
			const page: TabPage = { url, site, key, seenAt: Date.now() };
			await chrome.storage.session.set({ [tabPageKey(tabId)]: page });
			if (__DEV__) console.info(`[Rezumi] tab ${tabId}: ${key ?? "no posting"} (${url})`);
			const state = await stateFor(page);
			await setBadge(tabId, state);
			return state;
		},
		// Called straight from the click's message, before anything is awaited: the browser opens the panel only while
		// the person's gesture still counts (02-teknis.md §8, checked in Phase 04).
		"open-panel": async (_message, tabId) => {
			try {
				await chrome.sidePanel.open({ tabId });
				return { opened: true };
			} catch (error) {
				if (__DEV__) console.warn("[Rezumi] side panel not opened", error);
				return { opened: false };
			}
		},
		"hide-floating": async ({ site }) => {
			const stored = await chrome.storage.local.get(SETTINGS);
			const settings = readSettings(stored[SETTINGS]);
			if (!settings.floatingHidden.includes(site))
				await chrome.storage.local.set({
					[SETTINGS]: { ...settings, floatingHidden: [...settings.floatingHidden, site] },
				});
			return { ok: true };
		},
		status: async () => {
			const status = await auth.status();
			// The panel asks this when it opens: a good moment to refresh old marks.
			if (status.state === "connected") void syncIfStale();
			return { ...status, version: EXTENSION_VERSION };
		},
		connect: async () => {
			try {
				const account = await auth.connect();
				void syncSavedKeys();
				return { ok: true, account };
			} catch (error) {
				return { ok: false, code: connectErrorCode(error) };
			}
		},
		disconnect: async () => {
			await auth.disconnect();
			await chrome.storage.local.remove(SAVED_KEYS);
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
		saved: async ({ key, id, status }) => {
			if (key)
				await chrome.storage.local.set({
					[SAVED_KEYS]: withSaved(await storedSavedKeys(), REZUMI_ORIGIN, key, { id, status }),
				});
			void syncSavedKeys();
			return { ok: true };
		},
	},
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
	void route(message, sender).then(sendResponse);
	// The answer is sent asynchronously.
	return true;
});

// The marks, badges and buttons follow every change of the saved keys, the settings and the connection.
chrome.storage.onChanged.addListener((changes, area) => {
	if (area !== "local") return;
	const watched: string[] = [SAVED_KEYS, SETTINGS, AUTH_KEYS.refresh, AUTH_KEYS.state];
	if (Object.keys(changes).some((key) => watched.includes(key))) void refreshAllTabs();
});

chrome.tabs.onRemoved.addListener((tabId) => {
	void chrome.storage.session.remove([tabPageKey(tabId), draftKey(tabId), tabSelectionKey(tabId)]);
});

// --- Context menu (01-desain.md §2.4) ---

const CONTEXT_MENU_ID = "save-selection";

function createContextMenu() {
	chrome.contextMenus.removeAll(() => {
		const language = resolveLanguage("system", chrome.i18n.getUILanguage());
		chrome.contextMenus.create({
			id: CONTEXT_MENU_ID,
			title: language === "id" ? "Simpan teks terpilih ke Rezumi" : "Save selected text to Rezumi",
			contexts: ["selection"],
		});
	});
}

function onContextMenu(info: chrome.contextMenus.OnClickData, tab?: chrome.tabs.Tab) {
	if (info.menuItemId !== CONTEXT_MENU_ID || tab?.id === undefined || tab.id < 0) return;
	const tabId = tab.id;
	// First, while the click still counts as the person's gesture.
	void chrome.sidePanel.open({ tabId }).catch(() => {});
	const text = (info.selectionText ?? "").slice(0, 20_000);
	// The page's address comes with the click (no "tabs" permission needed), for when the page itself can't be read.
	const url = /^https?:\/\//.test(info.pageUrl ?? "") ? (info.pageUrl ?? "").slice(0, 2_000) : null;
	if (text) void chrome.storage.session.set({ [tabSelectionKey(tabId)]: { text, url, at: Date.now() } });
}

chrome.contextMenus.onClicked.addListener(onContextMenu);
// Development builds: tests click the menu item through this (Playwright cannot open the browser's context menu).
if (__DEV__) (globalThis as { rezumiContextMenu?: typeof onContextMenu }).rezumiContextMenu = onContextMenu;

// --- Lifecycle ---

chrome.runtime.onInstalled.addListener(() => {
	void registerAlarms();
	createContextMenu();
});
chrome.runtime.onStartup.addListener(() => {
	void registerAlarms();
	createContextMenu();
});
chrome.alarms.onAlarm.addListener((alarm) => {
	void runAlarm(alarm, { syncSavedKeys });
});
