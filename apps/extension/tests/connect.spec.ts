import type { BrowserContext, Page } from "@playwright/test";
import { randomBytes } from "node:crypto";
import { expect, test } from "./fixtures";

/**
 * The whole sign-in against a local Rezumi server (the development build talks to http://localhost:3000): a fictional
 * account signs up, the panel's "Connect to Rezumi" opens Rezumi's consent window, "Allow access" brings the panel to
 * the connected screen, and "Sign out" (or revoking the app in Rezumi's settings) brings back "Connect".
 * Skipped when no server answers there.
 */
const server = "http://localhost:3000";
const screenshotDir = process.env.EXTENSION_SCREENSHOTS;

async function serverIsUp() {
	try {
		return (await fetch(`${server}/api/health`, { signal: AbortSignal.timeout(3_000) })).ok;
	} catch {
		return false;
	}
}

/** Signs up a fresh fictional account; the browser context keeps its session cookie, as after a sign-in on the web. */
async function signUp(context: BrowserContext) {
	const id = randomBytes(4).toString("hex");
	const response = await context.request.post(`${server}/api/auth/sign-up/email`, {
		headers: { origin: server },
		data: {
			email: `extension-${id}@example.test`,
			password: randomBytes(12).toString("hex"),
			name: "Rina Wijaya",
			username: `rina-${id}`,
			displayUsername: `rina-${id}`,
		},
	});
	expect(response.ok()).toBe(true);
	return { email: `extension-${id}@example.test` };
}

/** Presses "Connect to Rezumi" and approves the request in the window Rezumi opens. */
async function connect(context: BrowserContext, panel: Page) {
	const consentWindow = context.waitForEvent("page");
	await panel.getByRole("button", { name: "Connect to Rezumi" }).click();
	const consent = await consentWindow;
	await consent.waitForURL(/\/auth\/consent/);
	await expect(consent.getByText("Rezumi browser extension")).toBeVisible();
	return consent;
}

test.describe("connecting to Rezumi", () => {
	test.beforeEach(async () => {
		test.skip(!(await serverIsUp()), `No Rezumi server at ${server}`);
	});

	test("connects, shows the account and its plan, and signs out", async ({ context, extensionId }) => {
		const { email } = await signUp(context);
		const panel = await context.newPage();
		await panel.setViewportSize({ width: 360, height: 640 });
		await panel.goto(`chrome-extension://${extensionId}/sidepanel.html`);

		const consent = await connect(context, panel);
		await consent.getByRole("button", { name: "Allow access" }).click();

		await expect(panel.getByText("Open a job posting to save it to Rezumi.")).toBeVisible();
		await panel.getByRole("button", { name: "Settings" }).click();
		await expect(panel.getByText("Rina Wijaya")).toBeVisible();
		await expect(panel.getByText(email)).toBeVisible();
		// The dev server runs with BILLING_MODE=on: a free account, and the free plan may use the extension.
		await expect(panel.getByText("Free", { exact: true })).toBeVisible();
		if (screenshotDir) await panel.screenshot({ path: `${screenshotDir}/connected-settings.png` });

		// The tokens stay in the service worker's storage, out of reach of web pages and content scripts.
		const stored = await panel.evaluate(async () => ({
			session: Object.keys(await chrome.storage.session.get(null)),
			local: Object.keys(await chrome.storage.local.get(null)),
		}));
		expect(stored.session).toContain("auth:access");
		expect(stored.local).toContain("auth:refresh");

		await panel.getByRole("button", { name: "Sign out" }).click();
		await expect(panel.getByRole("button", { name: "Connect to Rezumi" })).toBeVisible();
		expect(await panel.evaluate(async () => Object.keys(await chrome.storage.session.get("auth:access")))).toEqual([]);
	});

	test("asks to connect again after the extension is disconnected in Rezumi's settings", async ({
		context,
		extensionId,
	}) => {
		await signUp(context);
		const panel = await context.newPage();
		await panel.goto(`chrome-extension://${extensionId}/sidepanel.html`);
		const consent = await connect(context, panel);
		await consent.getByRole("button", { name: "Allow access" }).click();
		await expect(panel.getByText("Open a job posting to save it to Rezumi.")).toBeVisible();

		// Connected applications in Rezumi's settings names the extension and revokes it.
		const settings = await context.newPage();
		await settings.goto(`${server}/dashboard/settings/app#connected-apps`);
		const row = settings.getByRole("listitem").filter({ hasText: "Rezumi browser extension" });
		await expect(row).toBeVisible();
		await expect(row.getByText("Saves job postings from your browser to your applications.")).toBeVisible();
		if (screenshotDir) await row.screenshot({ path: `${screenshotDir}/connected-apps-row.png` });
		await row.getByRole("button", { name: "Revoke access" }).click();
		await expect(row).toBeHidden();

		// The next call is refused even after a refresh: the panel says the connection ended.
		await panel.reload();
		await expect(panel.getByText("The connection to Rezumi ended. Connect again to continue.")).toBeVisible();
		if (screenshotDir) await panel.screenshot({ path: `${screenshotDir}/connection-ended.png` });
	});

	test("changes nothing when the sign-in window is closed", async ({ context, extensionId }) => {
		await signUp(context);
		const panel = await context.newPage();
		await panel.goto(`chrome-extension://${extensionId}/sidepanel.html`);
		const consent = await connect(context, panel);
		await consent.close();
		await expect(panel.getByRole("button", { name: "Connect to Rezumi" })).toBeEnabled();
		await expect(panel.getByRole("alert")).toHaveCount(0);
	});
});

for (const uiLanguage of ["en-US", "id"] as const) {
	test.describe(`connected panel in ${uiLanguage}`, () => {
		test.use({ uiLanguage });
		test.beforeEach(async () => {
			test.skip(!(await serverIsUp()), `No Rezumi server at ${server}`);
		});

		test("shows the home and settings screens at both widths and appearances", async ({ context, extensionId }) => {
			const english = uiLanguage === "en-US";
			await signUp(context);
			const panel = await context.newPage();
			await panel.goto(`chrome-extension://${extensionId}/sidepanel.html`);
			const consentWindow = context.waitForEvent("page");
			await panel.getByRole("button", { name: english ? "Connect to Rezumi" : "Hubungkan ke Rezumi" }).click();
			const consent = await consentWindow;
			await consent.waitForURL(/\/auth\/consent/);
			await consent.getByRole("button", { name: "Allow access" }).click();

			const home = english
				? "Open a job posting to save it to Rezumi."
				: "Buka halaman lowongan untuk menyimpannya ke Rezumi.";
			await expect(panel.getByText(home)).toBeVisible();
			for (const width of [360, 420]) {
				for (const colorScheme of ["light", "dark"] as const) {
					await panel.setViewportSize({ width, height: 640 });
					await panel.emulateMedia({ colorScheme });
					await panel.reload();
					await expect(panel.getByText(home)).toBeVisible();
					if (screenshotDir)
						await panel.screenshot({ path: `${screenshotDir}/home-${uiLanguage}-${width}-${colorScheme}.png` });
					await panel.getByRole("button", { name: english ? "Settings" : "Pengaturan" }).click();
					await expect(panel.getByRole("button", { name: english ? "Sign out" : "Keluar" })).toBeVisible();
					await expect(panel.getByText(english ? "Free" : "Gratis", { exact: true })).toBeVisible();
					if (screenshotDir)
						await panel.screenshot({ path: `${screenshotDir}/settings-${uiLanguage}-${width}-${colorScheme}.png` });
				}
			}
		});
	});
}
