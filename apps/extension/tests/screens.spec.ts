import type { Page, Worker } from "@playwright/test";
import { localDay } from "../src/shared/follow-ups";
import { connect, screenshotDir, server, serverIsUp, signUp } from "./account";
import { expect, serveFixture, test } from "./fixtures";

/**
 * Pictures for the design check (plan rule #9), only with `EXTENSION_SCREENSHOTS=<dir>` and a local server: the save
 * form (with the match and the reminder from the posting's deadline), the saved view (match, AI score, preparation,
 * reminder) and the home screen with due follow-ups at 360 and 420 px, light and dark, English and Indonesian, and the
 * on-page button and chip on the four boards' fixtures.
 */

const boards = [
	{
		origin: "https://www.linkedin.com",
		fixture: "linkedin/view.html",
		url: "https://www.linkedin.com/jobs/view/4012345678/",
	},
	{
		origin: "https://id.indeed.com",
		fixture: "indeed/search-picked.html",
		url: "https://id.indeed.com/jobs?q=designer&l=Jakarta&vjk=0123456789abcdef",
	},
	{
		origin: "https://id.jobstreet.com",
		fixture: "jobstreet/detail.html",
		url: "https://id.jobstreet.com/id/job/81234567",
	},
	{
		origin: "https://glints.com",
		fixture: "glints/detail.html",
		url: "https://glints.com/id/opportunities/jobs/product-designer/1d6c1f1e-6f43-4d3c-9f5f-7b6a2d1c0e9a",
	},
];

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

const buttonState = (board: Page) =>
	board
		.locator("rezumi-save-button")
		.getAttribute("data-rezumi-state", { timeout: 5_000 })
		.catch(() => null);

async function shoot(panel: Page, name: string) {
	for (const width of [360, 420]) {
		for (const colorScheme of ["light", "dark"] as const) {
			await panel.setViewportSize({ width, height: 900 });
			await panel.emulateMedia({ colorScheme });
			await panel.mouse.move(0, 0);
			// Colours ease between themes; take the picture once they settle.
			await panel.waitForTimeout(400);
			await panel.screenshot({ path: `${screenshotDir}/${name}-${width}-${colorScheme}.png`, fullPage: true });
		}
	}
}

for (const uiLanguage of ["en-US", "id"] as const) {
	test.describe(`screens in ${uiLanguage}`, () => {
		test.use({ uiLanguage });
		test.beforeEach(async () => {
			test.skip(!screenshotDir, "Set EXTENSION_SCREENSHOTS to save pictures");
			test.skip(!(await serverIsUp()), `No Rezumi server at ${server}`);
		});

		test("save form, saved view, home, and the on-page button", async ({ context, serviceWorker, extensionId }) => {
			test.setTimeout(120_000);
			const english = uiLanguage === "en-US";
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
			// A resume to match with (a fictional persona's summary).
			const resume = await context.request.post(`${server}/api/openapi/resumes`, {
				headers: { origin: server },
				data: { name: "Rina Wijaya — Product Designer", tags: [], withSampleData: false },
			});
			const resumeId = (await resume.json()) as string;
			await context.request.patch(`${server}/api/openapi/resumes/${resumeId}`, {
				headers: { origin: server },
				data: {
					operations: [
						{
							op: "replace",
							path: "/summary/content",
							value: "<p>Product designer working in Figma, user research and design systems for health teams.</p>",
						},
					],
				},
			});

			for (const [index, board] of boards.entries()) {
				await serveFixture(context, board.origin, board.fixture);
				const page = await context.newPage();
				await page.setViewportSize({ width: 1280, height: 720 });
				await page.goto(board.url);
				await expect.poll(() => buttonState(page)).not.toBeNull();
				const site = board.fixture.split("/")[0];
				await page.screenshot({ path: `${screenshotDir}/button-${site}-${uiLanguage}.png` });

				const tabId = await tabIdFor(serviceWorker, board.url);
				await panel.goto(`chrome-extension://${extensionId}/sidepanel.html?tab=${tabId}&clean`);
				const save = panel.getByRole("button", { name: english ? "Save to Rezumi" : "Simpan ke Rezumi" });
				await expect(save).toBeVisible();
				await expect(panel.getByText(english ? "Checking your applications…" : "Mengecek lamaranmu…")).toBeHidden();
				// The first posting gets a reminder for today, so the home screen has something due.
				if (index === 0) await panel.getByLabel(english ? "Follow up on" : "Tindak lanjut pada").fill(localDay());
				// Glints states its salary and closing date: the fullest form.
				if (index === 3) {
					await expect(panel.getByTestId("match-percent")).toBeVisible();
					await shoot(panel, `form-${uiLanguage}`);
				}
				await save.click();
				await expect(
					panel.getByText(english ? "Saved to Rezumi" : "Tersimpan di Rezumi", { exact: true }),
				).toBeVisible();
				if (index === 3) {
					await expect(panel.getByTestId("match-percent")).toBeVisible();
					await shoot(panel, `saved-${uiLanguage}`);
				}
				await expect.poll(() => buttonState(page)).not.toBe(english ? "Save to Rezumi" : "Simpan ke Rezumi");
				await page.waitForTimeout(400);
				await page.screenshot({ path: `${screenshotDir}/chip-${site}-${uiLanguage}.png` });
				await page.close();
			}

			await panel.goto(`chrome-extension://${extensionId}/sidepanel.html`);
			await expect(panel.getByText(english ? "Recently saved" : "Terakhir disimpan")).toBeVisible();
			await expect(panel.getByRole("link", { name: /Product Designer/ }).first()).toBeVisible();
			await expect(panel.getByRole("button", { name: english ? /^Done: / : /^Selesai: / })).toBeVisible();
			await shoot(panel, `home-due-${uiLanguage}`);
		});
	});
}
