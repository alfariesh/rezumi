/**
 * The content script, on the four job boards only (manifest.config.ts). It works out which posting the tab has open
 * from the address alone and tells the service worker; it reads nothing else from the page until the person asks
 * (Phase 03/04), holds no token and calls no API. Plain TypeScript: no React, no Zod (≤ 50 KB, 02-teknis.md §4).
 */
import type { PageMessage } from "../shared/messages";
import { detectSite, jobKey } from "@rezumi/job-sites/sites";
import { watchAddress } from "./navigation";

let lastKey: string | null | undefined;

function report(href: string) {
	const key = jobKey(href);
	if (key === lastKey) return;
	lastKey = key;
	if (__DEV__) console.info(`[Rezumi] job key: ${key ?? "none"}`);
	const message: PageMessage = { type: "page", url: href, site: detectSite(href), key };
	// Rejects once the extension is reloaded or removed while the page stays open; nothing to do then.
	chrome.runtime.sendMessage(message).catch(() => {});
}

report(location.href);
watchAddress(report);
