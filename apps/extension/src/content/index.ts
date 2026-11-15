/**
 * The content script. On the four job boards (manifest.config.ts) it works out which posting the tab has open from
 * the address alone and tells the service worker. On any other site the side panel injects it once (activeTab +
 * scripting, after the person opened the panel). It reads the page only when the side panel asks (`read`), holds no
 * token and calls no API. Plain TypeScript: no React, no Zod (≤ 50 KB, 02-teknis.md §4).
 */
import type { PageMessage, ReadRequest } from "../shared/messages";
import { detectSite, jobKey } from "@rezumi/job-sites/sites";
import { watchAddress } from "./navigation";
import { readPage } from "./read";

// The side panel injects this only into a tab that did not answer, so it runs once per page.
let lastKey: string | null | undefined;

const report = (href: string) => {
	const key = jobKey(href);
	if (key === lastKey) return;
	lastKey = key;
	if (__DEV__) console.info(`[Rezumi] job key: ${key ?? "none"}`);
	const message: PageMessage = { type: "page", url: href, site: detectSite(href), key };
	// Rejects once the extension is reloaded or removed while the page stays open; nothing to do then.
	chrome.runtime.sendMessage(message).catch(() => {});
};

// Only the extension's own pages (the side panel) may ask; they carry no tab.
chrome.runtime.onMessage.addListener((message: ReadRequest, sender, sendResponse) => {
	if (sender.id !== chrome.runtime.id || sender.tab || message?.type !== "read") return false;
	sendResponse(readPage(document, location.href, getSelection()?.toString() ?? ""));
	return false;
});

report(location.href);
watchAddress(report);
