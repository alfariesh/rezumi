import type { BrowserContext, Worker } from "@playwright/test";
import { connect, screenshotDir, server, serverIsUp, signUp } from "./account";
import { expect, serveFixture, test } from "./fixtures";

/**
 * The connected panel on a posting: the save form filled from the page (Phase 04), and "Report this page" sent to the
 * local server (Phase 03).
 * Skipped when no Rezumi server answers at http://localhost:3000.
 */

async function tabIdFor(serviceWorker: Worker, url: string) {
	let id: number | undefined;
	await expect
		.poll(async () => {
			id = await serviceWorker.evaluate(async (address) => {
				const all = await chrome.storage.session.get(null);
				const entry = Object.entries(all).find(
					([key, value]) => key.startsWith("tabPage:") && (value as { url: string }).url === address,
				);
				return entry ? Number(entry[0].slice("tabPage:".length)) : undefined;
			}, url);
			return id;
		})
		.toBeDefined();
	return id as number;
}

async function connectedPanel(context: BrowserContext, extensionId: string, english: boolean) {
	await signUp(context);
	const panel = await context.newPage();
	await panel.goto(`chrome-extension://${extensionId}/sidepanel.html`);
	if (english) {
		const consent = await connect(context, panel);
		await consent.getByRole("button", { name: "Allow access" }).click();
	} else {
		const consentWindow = context.waitForEvent("page");
		await panel.getByRole("button", { name: "Hubungkan ke Rezumi" }).click();
		const consent = await consentWindow;
		await consent.waitForURL(/\/auth\/consent/);
		await consent.getByRole("button", { name: "Allow access" }).click();
	}
	await expect(panel.getByRole("button", { name: english ? "Settings" : "Pengaturan" })).toBeVisible();
	return panel;
}

for (const uiLanguage of ["en-US", "id"] as const) {
	test.describe(`reading a posting in ${uiLanguage}`, () => {
		test.use({ uiLanguage });
		test.beforeEach(async () => {
			test.skip(!(await serverIsUp()), `No Rezumi server at ${server}`);
		});

		test("shows the posting it read, and reports a page it could not read fully", async ({
			context,
			serviceWorker,
			extensionId,
		}) => {
			const english = uiLanguage === "en-US";
			const panel = await connectedPanel(context, extensionId, english);

			const url = "https://id.jobstreet.com/id/job/81234567";
			await serveFixture(context, "https://id.jobstreet.com", "jobstreet/detail.html");
			const board = await context.newPage();
			await board.goto(url);
			const tabId = await tabIdFor(serviceWorker, url);

			for (const width of [360, 420]) {
				for (const colorScheme of ["light", "dark"] as const) {
					await panel.setViewportSize({ width, height: 640 });
					await panel.emulateMedia({ colorScheme });
					await panel.goto(`chrome-extension://${extensionId}/sidepanel.html?tab=${tabId}&clean`);
					await expect(panel.getByRole("textbox", { name: english ? "Role" : "Posisi" })).toHaveValue(
						"Product Designer",
					);
					await expect(panel.getByRole("textbox", { name: english ? "Salary" : "Gaji" })).toHaveValue(
						"Rp 15.000.000 – Rp 20.000.000 per month",
					);
					await expect(panel.getByText(english ? "Checking your applications…" : "Mengecek lamaranmu…")).toBeHidden();
					if (screenshotDir)
						await panel.screenshot({ path: `${screenshotDir}/posting-${uiLanguage}-${width}-${colorScheme}.png` });
				}
			}

			// An expired posting: the place is missing, and the person may report the page.
			await board.close();
			const expired = await context.newPage();
			await context.unroute("https://id.jobstreet.com/**");
			await serveFixture(context, "https://id.jobstreet.com", "jobstreet/expired.html");
			await expired.goto(url);
			const expiredTab = await tabIdFor(serviceWorker, url);
			await panel.goto(`chrome-extension://${extensionId}/sidepanel.html?tab=${expiredTab}&clean`);
			await panel.setViewportSize({ width: 360, height: 640 });
			await panel.emulateMedia({ colorScheme: "light" });
			const report = panel.getByRole("button", { name: english ? "Report this page" : "Laporkan halaman ini" });
			await expect(report).toBeVisible();
			// The pointer still rests where "Connect to Rezumi" was; move it off the button for a plain picture.
			await panel.mouse.move(0, 0);
			if (screenshotDir) await panel.screenshot({ path: `${screenshotDir}/report-${uiLanguage}-before.png` });
			await report.click();
			await expect(
				panel.getByText(english ? "Thanks, we'll look into it." : "Terima kasih, kami akan memeriksanya."),
			).toBeVisible();
			if (screenshotDir) await panel.screenshot({ path: `${screenshotDir}/report-${uiLanguage}-sent.png` });
		});
	});
}
