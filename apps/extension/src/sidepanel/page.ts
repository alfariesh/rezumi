import type { ReadRequest } from "../shared/messages";
import type { PageReading } from "./reading";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { pageReadingSchema } from "../shared/messages";
import { tabPageKey } from "../shared/storage";

/** How long a single-page board takes to show the next posting after its address changed. */
const SETTLE_MS = 600;

/** What reading the active tab gave: the page, or why there is nothing to read (a browser page, no access). */
export type TabReading = { state: "read"; reading: PageReading } | { state: "unavailable" };

const ask = (tabId: number) => chrome.tabs.sendMessage(tabId, { type: "read" } satisfies ReadRequest, { frameId: 0 });

/**
 * Asks the tab's content script to read the page. On a site without it (anything but the four boards), injects it
 * first: the extension may, for the tab where the person opened the panel (activeTab). Chrome's own pages and tabs
 * opened before the panel cannot be read, and give `unavailable`.
 */
async function readTab(tabId: number): Promise<TabReading> {
	let answer: unknown;
	try {
		answer = await ask(tabId);
	} catch {
		try {
			await chrome.scripting.executeScript({ target: { tabId }, files: ["content.js"] });
			answer = await ask(tabId);
		} catch {
			return { state: "unavailable" };
		}
	}
	const parsed = pageReadingSchema.safeParse(answer);
	if (!parsed.success) {
		if (__DEV__) console.warn("[Rezumi] unreadable page reading", parsed.error);
		return { state: "unavailable" };
	}
	return { state: "read", reading: parsed.data };
}

/** The tab the panel works on: the active tab of the panel's window (a test may name one with `?tab=` in dev builds). */
async function activeTabId(): Promise<number | null> {
	const named = __DEV__ ? Number(new URLSearchParams(location.search).get("tab")) : Number.NaN;
	if (Number.isInteger(named) && named > 0) return named;
	const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
	return tab?.id ?? null;
}

/**
 * Reads the active tab when the panel opens, when the person switches tabs, when the tab finishes loading, and when
 * the content script reports another posting (a single-page board switching postings).
 */
export function useTabReading() {
	const [tabId, setTabId] = useState<number | null>(null);
	const [stamp, setStamp] = useState(0);

	useEffect(() => {
		let current: number | null = null;
		const pick = async () => {
			current = await activeTabId();
			setTabId(current);
		};
		void pick();
		const fixed = __DEV__ && new URLSearchParams(location.search).has("tab");
		const onActivated = () => {
			if (!fixed) void pick();
		};
		const onUpdated = (id: number, change: { status?: string }) => {
			if (id === current && change.status === "complete") setStamp((value) => value + 1);
		};
		const onStorage = (changes: Record<string, unknown>, area: string) => {
			// The board switches its posting pane a moment after the address changes.
			if (area === "session" && current !== null && tabPageKey(current) in changes)
				setTimeout(() => setStamp((value) => value + 1), SETTLE_MS);
		};
		chrome.tabs.onActivated.addListener(onActivated);
		chrome.tabs.onUpdated.addListener(onUpdated);
		chrome.storage.onChanged.addListener(onStorage);
		return () => {
			chrome.tabs.onActivated.removeListener(onActivated);
			chrome.tabs.onUpdated.removeListener(onUpdated);
			chrome.storage.onChanged.removeListener(onStorage);
		};
	}, []);

	return useQuery({
		queryKey: ["tab-reading", tabId, stamp],
		queryFn: () => (tabId === null ? ({ state: "unavailable" } as const) : readTab(tabId)),
		enabled: tabId !== null,
		staleTime: Number.POSITIVE_INFINITY,
		gcTime: 60_000,
		retry: false,
		// Keep showing the last posting while the same tab moves to the next one; another tab starts afresh.
		placeholderData: (previous, previousQuery) => (previousQuery?.queryKey[1] === tabId ? previous : undefined),
	});
}
