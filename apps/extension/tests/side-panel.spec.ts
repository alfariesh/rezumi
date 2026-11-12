import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";

const screenshotDir = process.env.EXTENSION_SCREENSHOTS;

async function openPanel(page: Page, extensionId: string, width: number) {
	await page.setViewportSize({ width, height: 640 });
	await page.goto(`chrome-extension://${extensionId}/sidepanel.html`);
	await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
	// The brand mark ships inside the extension; a broken image has no natural width.
	await expect
		.poll(() => page.locator("img:visible").evaluate((image: HTMLImageElement) => image.naturalWidth))
		.toBeGreaterThan(0);
}

for (const uiLanguage of ["en-US", "id"] as const) {
	test.describe(`side panel in ${uiLanguage}`, () => {
		test.use({ uiLanguage });

		test("shows the connect screen", async ({ context, extensionId }) => {
			const page = await context.newPage();
			await openPanel(page, extensionId, 360);

			const english = uiLanguage === "en-US";
			await expect(page.getByRole("heading", { level: 1 })).toHaveText(
				english ? "Save jobs to Rezumi" : "Simpan loker ke Rezumi",
			);
			await expect(
				page.getByRole("button", { name: english ? "Connect to Rezumi" : "Hubungkan ke Rezumi" }),
			).toBeVisible();
			await expect(page.getByRole("link", { name: english ? "Sign up free" : "Daftar gratis" })).toHaveAttribute(
				"href",
				"http://localhost:3000/auth/register",
			);

			// EXTENSION_SCREENSHOTS=<dir> keeps a picture of every width and appearance, for review.
			for (const width of [360, 420]) {
				for (const colorScheme of ["light", "dark"] as const) {
					await page.emulateMedia({ colorScheme });
					await openPanel(page, extensionId, width);
					await expect(page.locator("html")).toHaveClass(colorScheme === "dark" ? /dark/ : /^(?!.*dark)/);
					if (screenshotDir)
						await page.screenshot({ path: `${screenshotDir}/panel-${uiLanguage}-${width}-${colorScheme}.png` });
				}
			}
		});
	});
}

test("the manifest declares the panel, the worker and the four boards", async ({ context, extensionId }) => {
	const page = await context.newPage();
	await page.goto(`chrome-extension://${extensionId}/manifest.json`);
	const manifest = JSON.parse((await page.locator("body").textContent()) ?? "{}") as chrome.runtime.ManifestV3;
	expect(manifest.side_panel?.default_path).toBe("sidepanel.html");
	expect(manifest.background).toEqual({ service_worker: "background.js", type: "module" });
	expect(manifest.content_scripts?.[0]?.matches).toHaveLength(4);
	// The development build carries the store's public key, so "Load unpacked" gets the Chrome Web Store id.
	expect(extensionId).toBe("fiogmglhgeiaaeajahbpmmehgmojbjjo");
});
