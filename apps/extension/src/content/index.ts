/**
 * The content script. On the four job boards (manifest.config.ts) it works out which posting the tab has open from
 * the address alone, tells the service worker, and draws the "Save to Rezumi" button or "Saved" chip the worker's
 * answer asks for. On any other site the side panel injects it once (activeTab + scripting, after the person opened
 * the panel), with no button. It reads the page only when the side panel asks (`read`), holds no token and calls no
 * API. Plain TypeScript: no React, no Zod (≤ 50 KB, 02-teknis.md §4).
 */
import type {
	HideFloatingMessage,
	OpenPanelMessage,
	PageMessage,
	PageState,
	PageStateUpdate,
	ReadRequest,
} from "../shared/messages";
import type { JobSite } from "@rezumi/job-sites/sites";
import { detectSite, jobKey } from "@rezumi/job-sites/sites";
import { createSaveButton } from "./button";
import { watchAddress } from "./navigation";
import { readPage } from "./read";
import { SITE_ADAPTERS } from "./sites";

// The side panel injects this only into a tab that did not answer, so it runs once per page.
let lastKey: string | null | undefined;
let site: JobSite | null = null;
let state: PageState | null = null;

/** How long to wait for a single-page board to draw its buttons before floating ours. */
const ANCHOR_WAIT_MS = 4_000;

const send = <T>(message: PageMessage | OpenPanelMessage | HideFloatingMessage) =>
	// Rejects once the extension is reloaded or removed while the page stays open; nothing to do then.
	(chrome.runtime.sendMessage(message) as Promise<{ ok: true; data: T } | { ok: false } | undefined>).then(
		(response) => (response?.ok ? response.data : null),
		() => null,
	);

const button = createSaveButton({
	onPress: async () => (await send<{ opened: boolean }>({ type: "open-panel" }))?.opened ?? false,
	onHide: () => {
		if (site) void send({ type: "hide-floating", site });
	},
});

let anchorTimer: ReturnType<typeof setTimeout> | undefined;
let anchorObserver: MutationObserver | undefined;

const findAnchor = () => (site ? SITE_ADAPTERS[site].anchor(document) : null);

/** Draws the button beside the board's own buttons; waits a moment for them on single-page boards, then floats. */
function draw() {
	clearTimeout(anchorTimer);
	anchorObserver?.disconnect();
	if (!state?.button) {
		button.remove();
		return;
	}
	const anchor = findAnchor();
	if (anchor) {
		button.render(state, anchor);
		return;
	}
	button.remove();
	anchorObserver = new MutationObserver(() => {
		const found = findAnchor();
		if (!found || !state) return;
		anchorObserver?.disconnect();
		clearTimeout(anchorTimer);
		button.render(state, found);
	});
	anchorObserver.observe(document.body, { childList: true, subtree: true });
	anchorTimer = setTimeout(() => {
		anchorObserver?.disconnect();
		if (state) button.render(state, findAnchor());
	}, ANCHOR_WAIT_MS);
}

const report = (href: string) => {
	const key = jobKey(href);
	if (key === lastKey) return;
	lastKey = key;
	site = detectSite(href);
	if (__DEV__) console.info(`[Rezumi] job key: ${key ?? "none"}`);
	void send<PageState>({ type: "page", url: href, site, key }).then((answer) => {
		// Another posting may have opened meanwhile; its own answer draws it.
		if (!answer || lastKey !== key) return;
		state = answer;
		draw();
	});
};

chrome.runtime.onMessage.addListener((message: ReadRequest | PageStateUpdate, sender, sendResponse) => {
	// Only the extension's own pages (the side panel) and its service worker may ask; they carry no tab.
	if (sender.id !== chrome.runtime.id || sender.tab) return false;
	if (message?.type === "read") {
		sendResponse(readPage(document, location.href, getSelection()?.toString() ?? ""));
		return false;
	}
	// The saved keys, a setting or the connection changed: redraw in place.
	if (message?.type === "state" && message.key === lastKey && site) {
		state = message.state;
		draw();
	}
	return false;
});

report(location.href);
watchAddress(report);
