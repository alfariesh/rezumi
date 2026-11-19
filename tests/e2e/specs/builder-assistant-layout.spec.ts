import { createSampleResumeFromDashboard } from "../fixtures/resume";
import { expect, test } from "../fixtures/test";

// How long the main thread is held while the assistant's column opens, as mounting the panel does on a slower machine.
// Chromium got the layout wrong from about 300 ms; this leaves margin.
const STALL_MS = 600;

/**
 * With only an implicit grid row, Chromium laid the editor's canvas out zero tall on the frame the assistant's column
 * finished opening, when the main thread was busy during the transition, and the page showed as a strip for 15 seconds
 * or more. `EditorFrame` gives that grid an explicit row. The bug hides from anything that lays the page out while the
 * column opens (Playwright's own visibility checks, a node added to the grid), so this test only reads sizes until it's
 * over.
 */
test("opening the assistant's column keeps the page canvas full height", async ({ authPage: page }, testInfo) => {
	// Wide enough for the assistant's own column (≥1280). Set on the page: the signed-in context is made by hand, so
	// `test.use({ viewport })` wouldn't reach it.
	await page.setViewportSize({ width: 1440, height: 790 });
	await createSampleResumeFromDashboard(page, testInfo);
	const canvas = page.locator("#main-content");
	await expect(page.locator('canvas[aria-label^="Resume page 1 of"]').first()).toBeVisible({ timeout: 30_000 });
	const before = await canvas.boundingBox();
	expect(before?.height).toBeGreaterThan(300);
	// At rest: one preview layer (no render still fading in) and every page drawn (a canvas keeps the 300px default width
	// until its page is).
	await expect(page.locator("[data-resume-preview-template]")).toHaveCount(1);
	await expect
		.poll(() =>
			page
				.locator('canvas[aria-label^="Resume page "]')
				.evaluateAll((pages) => pages.length > 0 && pages.every((page) => (page as HTMLCanvasElement).width !== 300)),
		)
		.toBe(true);

	// Hovering preloads the panel, as it does for people; the pause lets the loaded module run before the press.
	const toggle = page.getByRole("button", { name: "AI", exact: true });
	const panelLoaded = page.waitForResponse((response) => /\/assistant-panel-[\w-]+\.js$/.test(response.url()));
	await toggle.hover();
	await panelLoaded;
	await page.waitForTimeout(500);
	// Pressed and stalled in one task, so the stall lands inside the column's transition every run.
	await toggle.evaluate((button: HTMLButtonElement, stall) => {
		button.click();
		setTimeout(() => {
			const end = performance.now() + stall;
			while (performance.now() < end);
		}, 50);
	}, STALL_MS);

	// The canvas through the transition and well after it, read only.
	const heights: number[] = [];
	for (let sample = 0; sample < 8; sample++) {
		await page.waitForTimeout(250);
		heights.push(await canvas.evaluate((main) => main.getBoundingClientRect().height));
	}
	await expect(page.getByRole("region", { name: "Assistant" })).toBeVisible();
	expect(heights).toEqual(heights.map(() => before?.height));
	const scroller = page.getByRole("region", { name: "Resume page", exact: true });
	expect((await scroller.boundingBox())?.height).toBe(before?.height);
});
