import type { BrowserContext, Worker } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { test as base, chromium } from "@playwright/test";

const extensionPath = fileURLToPath(new URL("../dist", import.meta.url));
const fixturesPath = fileURLToPath(new URL("../src/content/sites/__fixtures__", import.meta.url));

type ExtensionFixtures = {
	/** The browser UI language, as `chrome.i18n.getUILanguage()` reports it. */
	uiLanguage: string;
	context: BrowserContext;
	serviceWorker: Worker;
	extensionId: string;
};

export const test = base.extend<ExtensionFixtures>({
	uiLanguage: ["en-US", { option: true }],
	context: async ({ uiLanguage }, use) => {
		const context = await chromium.launchPersistentContext("", {
			channel: "chromium",
			locale: uiLanguage,
			args: [
				`--disable-extensions-except=${extensionPath}`,
				`--load-extension=${extensionPath}`,
				`--lang=${uiLanguage}`,
			],
		});
		await use(context);
		await context.close();
	},
	serviceWorker: async ({ context }, use) => {
		const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent("serviceworker"));
		await use(worker);
	},
	extensionId: async ({ serviceWorker }, use) => {
		await use(new URL(serviceWorker.url()).host);
	},
});

export const expect = test.expect;

/** Serves a synthetic job board page (src/content/sites/__fixtures__) at the board's real address. */
export async function serveFixture(context: BrowserContext, origin: string, fixture: string) {
	const body = await readFile(`${fixturesPath}/${fixture}`, "utf8");
	await context.route(`${origin}/**`, (route) => route.fulfill({ status: 200, contentType: "text/html", body }));
}

/** What the service worker keeps for every tab, from chrome.storage.session. */
export function tabPages(serviceWorker: Worker) {
	return serviceWorker.evaluate(async () => {
		const all = await chrome.storage.session.get(null);
		return Object.entries(all)
			.filter(([key]) => key.startsWith("tabPage:"))
			.map(([, value]) => value as { url: string; site: string | null; key: string | null });
	});
}
