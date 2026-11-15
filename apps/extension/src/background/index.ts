/**
 * The service worker: signs in to Rezumi and holds the tokens (the panel asks it for an access token per call). It
 * opens the side panel from the toolbar icon, the on-page button and the context menu, keeps what each tab's content
 * script reports, keeps the saved posting keys behind the "Saved" marks and the due follow-ups behind the badge count,
 * shows the desktop reminders, and runs the alarms.
 */
import type { PageState, PageStateUpdate } from "../shared/messages";
import type { DueFollowUp, DueFollowUps, SavedKeys, TabPage } from "../shared/storage";
import { EXTENSION_VERSION, REZUMI_ORIGIN, rezumiLink } from "../shared/config";
import { markReminded, remindersToShow } from "../shared/follow-ups";
import {
	AUTH_KEYS,
	draftKey,
	DUE_FOLLOW_UPS,
	NOTIFIED_FOLLOW_UPS,
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
import { badgeFor } from "./badge";
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

// --- Due follow-ups, the badge count and desktop reminders (02-teknis.md §11) ---

async function storedDue(): Promise<DueFollowUps | null> {
	const stored = await chrome.storage.local.get(DUE_FOLLOW_UPS);
	const due = stored[DUE_FOLLOW_UPS] as DueFollowUps | undefined;
	return due && due.origin === REZUMI_ORIGIN ? due : null;
}

async function dueCount() {
	return (await storedDue())?.total ?? 0;
}

let syncingFollowUps: Promise<void> | null = null;

/** Fetches the due follow-ups again (one at a time), then shows the reminders due now; keeps the old copy offline. */
function syncFollowUps(): Promise<void> {
	syncingFollowUps ??= (async () => {
		try {
			if ((await auth.status()).state !== "connected") return;
			const { items, total } = await api.applications.dueFollowUps({});
			const due: DueFollowUps = {
				origin: REZUMI_ORIGIN,
				syncedAt: Date.now(),
				total,
				items: items.map((item) => ({ ...item, followUpAt: new Date(item.followUpAt).toISOString() })),
			};
			await chrome.storage.local.set({ [DUE_FOLLOW_UPS]: due });
			await showReminders(due.items);
		} catch (error) {
			if (__DEV__) console.warn("[Rezumi] follow-ups not refreshed", error);
		} finally {
			syncingFollowUps = null;
		}
	})();
	return syncingFollowUps;
}

const REMINDER_TEXT = {
	en: { title: "Follow up today", message: (role: string, company: string) => `${role} at ${company}` },
	id: { title: "Tindak lanjut hari ini", message: (role: string, company: string) => `${role} di ${company}` },
} as const;

/** Whether reminders may show: turned on in the extension, and the browser still grants the permission. */
async function remindersAllowed() {
	const stored = await chrome.storage.local.get(SETTINGS);
	if (!readSettings(stored[SETTINGS]).notifications) return false;
	return chrome.permissions.contains({ permissions: ["notifications"] });
}

/**
 * Aturan turunan #7: one desktop reminder per due application per day, from 09:00 on this device, only while the
 * person turned them on and the browser grants the permission (01-desain.md §6).
 */
async function showReminders(items: readonly DueFollowUp[], now = new Date()) {
	if (!(await remindersAllowed()) || !chrome.notifications) return [];
	const stored = await chrome.storage.local.get([NOTIFIED_FOLLOW_UPS, SETTINGS]);
	const notified = (stored[NOTIFIED_FOLLOW_UPS] as Record<string, string> | undefined) ?? {};
	const show = remindersToShow(items, notified, now);
	if (!show.length) return [];
	const text = REMINDER_TEXT[resolveLanguage(readSettings(stored[SETTINGS]).language, chrome.i18n.getUILanguage())];
	const shown: chrome.notifications.NotificationCreateOptions[] = [];
	for (const item of show) {
		const options: chrome.notifications.NotificationCreateOptions = {
			type: "basic",
			iconUrl: chrome.runtime.getURL("icons/icon-128.png"),
			title: text.title,
			message: text.message(item.role, item.company),
			...(item.followUpNote ? { contextMessage: item.followUpNote.slice(0, 200) } : {}),
		};
		await chrome.notifications.create(`follow-up:${item.id}`, options);
		shown.push(options);
	}
	await chrome.storage.local.set({
		[NOTIFIED_FOLLOW_UPS]: markReminded(
			notified,
			show.map((item) => item.id),
			now,
		),
	});
	return shown;
}

let listeningToReminders = false;

/** A reminder opens its application in Rezumi. The API exists only while the permission is granted. */
function listenToReminders() {
	if (listeningToReminders || !chrome.notifications) return;
	listeningToReminders = true;
	chrome.notifications.onClicked.addListener((notificationId) => {
		const id = /^follow-up:(.+)$/.exec(notificationId)?.[1];
		if (!id) return;
		void chrome.tabs.create({ url: rezumiLink(`/dashboard/applications/${encodeURIComponent(id)}`) });
		void chrome.notifications.clear(notificationId);
	});
}
listenToReminders();

chrome.permissions.onAdded.addListener(({ permissions }) => {
	if (permissions?.includes("notifications")) listenToReminders();
});
// Taken back in the browser's settings: reminders turn off, so the switch tells the truth.
chrome.permissions.onRemoved.addListener(({ permissions }) => {
	if (!permissions?.includes("notifications")) return;
	void chrome.storage.local
		.get(SETTINGS)
		.then((stored) =>
			chrome.storage.local.set({ [SETTINGS]: { ...readSettings(stored[SETTINGS]), notifications: false } }),
		);
});

// Development builds: tests run the reminders with a chosen clock (Playwright cannot answer the permission prompt).
if (__DEV__)
	(globalThis as { rezumiReminders?: unknown }).rezumiReminders = async (now: string) =>
		showReminders((await storedDue())?.items ?? [], new Date(now));

// --- The toolbar badge (01-desain.md §5) ---

/** A green check in a tab whose posting is saved, else the due count (badge.ts). */
async function setBadge(tabId: number, state: PageState) {
	const badge = badgeFor({ saved: Boolean(state.saved), due: await dueCount(), locale: state.locale });
	try {
		await chrome.action.setBadgeText({ tabId, text: badge.text });
		await chrome.action.setBadgeBackgroundColor({ tabId, color: badge.color });
		await chrome.action.setBadgeTextColor({ tabId, color: "#ffffff" });
		await chrome.action.setTitle({ tabId, title: badge.title });
	} catch {
		// The tab closed meanwhile.
	}
}

/** The badge in tabs the content script never reported (other sites, new tabs): the due count. */
async function setDefaultBadge() {
	const stored = await chrome.storage.local.get(SETTINGS);
	const locale = resolveLanguage(readSettings(stored[SETTINGS]).language, chrome.i18n.getUILanguage());
	const badge = badgeFor({ saved: false, due: await dueCount(), locale });
	await chrome.action.setBadgeText({ text: badge.text });
	await chrome.action.setBadgeBackgroundColor({ color: badge.color });
	await chrome.action.setBadgeTextColor({ color: "#ffffff" });
	await chrome.action.setTitle({ title: badge.title });
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
	await setDefaultBadge();
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
				void syncFollowUps();
				return { ok: true, account };
			} catch (error) {
				return { ok: false, code: connectErrorCode(error) };
			}
		},
		disconnect: async () => {
			await auth.disconnect();
			await chrome.storage.local.remove([SAVED_KEYS, DUE_FOLLOW_UPS, NOTIFIED_FOLLOW_UPS]);
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
		"follow-ups": async () => {
			await syncFollowUps();
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
	const watched: string[] = [SAVED_KEYS, SETTINGS, DUE_FOLLOW_UPS, AUTH_KEYS.refresh, AUTH_KEYS.state];
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
	void syncFollowUps();
});
chrome.runtime.onStartup.addListener(() => {
	void registerAlarms();
	createContextMenu();
	void syncFollowUps();
});
chrome.alarms.onAlarm.addListener((alarm) => {
	void runAlarm(alarm, { syncSavedKeys, syncFollowUps });
});
