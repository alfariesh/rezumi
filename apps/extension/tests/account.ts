import type { BrowserContext, Page } from "@playwright/test";
import { randomBytes } from "node:crypto";
import { expect } from "./fixtures";

/** A local Rezumi server for the specs that sign in (the development build talks to http://localhost:3000). */
export const server = "http://localhost:3000";
export const screenshotDir = process.env.EXTENSION_SCREENSHOTS;

export async function serverIsUp() {
	try {
		return (await fetch(`${server}/api/health`, { signal: AbortSignal.timeout(3_000) })).ok;
	} catch {
		return false;
	}
}

/** Signs up a fresh fictional account; the browser context keeps its session cookie, as after a sign-in on the web. */
export async function signUp(context: BrowserContext) {
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
export async function connect(context: BrowserContext, panel: Page) {
	const consentWindow = context.waitForEvent("page");
	await panel.getByRole("button", { name: "Connect to Rezumi" }).click();
	const consent = await consentWindow;
	await consent.waitForURL(/\/auth\/consent/);
	await expect(consent.getByText("Rezumi browser extension")).toBeVisible();
	return consent;
}
