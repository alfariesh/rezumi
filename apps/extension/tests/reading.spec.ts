import type { BrowserContext, Page, Worker } from "@playwright/test";
import { expect, serveFixture, test } from "./fixtures";

/**
 * The side panel reads the open posting through the content script (Phase 03). Synthetic pages are served at each
 * board's real address; `sidepanel.html?tab=<id>&reading` (development builds) shows the reading without an account,
 * with the development-only list of every field and where it came from.
 */

/** The tab id the content script reported for this address. */
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

async function openBoard(context: BrowserContext, origin: string, fixture: string, url: string) {
	await serveFixture(context, origin, fixture);
	const page = await context.newPage();
	await page.goto(url);
	return page;
}

async function openReading(context: BrowserContext, extensionId: string, tabId: number) {
	const panel = await context.newPage();
	await panel.setViewportSize({ width: 360, height: 720 });
	await panel.goto(`chrome-extension://${extensionId}/sidepanel.html?tab=${tabId}&reading`);
	return panel;
}

const field = (panel: Page, name: string) => panel.getByTestId("debug-reading").locator(`[data-field="${name}"]`);

const boards = [
	{
		origin: "https://www.linkedin.com",
		fixture: "linkedin/search-picked.html",
		url: "https://www.linkedin.com/jobs/search-results/?currentJobId=4012345678&keywords=designer",
		key: "linkedin:4012345678",
		location: "Jakarta, Indonesia",
	},
	{
		origin: "https://id.indeed.com",
		fixture: "indeed/search-picked.html",
		url: "https://id.indeed.com/jobs?q=designer&l=Jakarta&vjk=0123456789abcdef",
		key: "indeed:0123456789abcdef",
		location: "Jakarta Selatan",
	},
	{
		origin: "https://id.jobstreet.com",
		fixture: "jobstreet/search-picked.html",
		url: "https://id.jobstreet.com/id/designer-jobs/in-Jakarta-Raya?jobId=81234567&type=standard",
		key: "jobstreet:81234567",
		location: "Jakarta Selatan, Jakarta Raya",
	},
	{
		origin: "https://glints.com",
		fixture: "glints/detail.html",
		url: "https://glints.com/id/opportunities/jobs/product-designer/1d6c1f1e-6f43-4d3c-9f5f-7b6a2d1c0e9a",
		key: "glints:1d6c1f1e-6f43-4d3c-9f5f-7b6a2d1c0e9a",
		location: "Jakarta Selatan, DKI Jakarta, ID",
	},
];

for (const board of boards) {
	test(`the panel reads the posting on ${board.fixture}`, async ({ context, serviceWorker, extensionId }) => {
		await openBoard(context, board.origin, board.fixture, board.url);
		const panel = await openReading(context, extensionId, await tabIdFor(serviceWorker, board.url));

		await expect(panel.getByRole("heading", { name: "Product Designer" })).toBeVisible();
		await expect(panel.getByText("Lumen Health", { exact: true })).toBeVisible();
		await expect(field(panel, "key")).toHaveText(board.key);
		await expect(field(panel, "kind")).toHaveText("posting");
		await expect(field(panel, "role")).toHaveAttribute("data-source", "site");
		await expect(field(panel, "location")).toContainText(board.location);
		await expect(field(panel, "description")).not.toHaveAttribute("data-source", "none");
		await expect(field(panel, "missing")).toHaveText("—");
	});
}

test("a single-page switch to another posting reads it again", async ({ context, serviceWorker, extensionId }) => {
	const url = "https://www.linkedin.com/jobs/search-results/?currentJobId=4012345678&keywords=designer";
	const page = await openBoard(context, "https://www.linkedin.com", "linkedin/search-picked.html", url);
	const panel = await openReading(context, extensionId, await tabIdFor(serviceWorker, url));
	await expect(field(panel, "key")).toHaveText("linkedin:4012345678");

	// LinkedIn swaps the picked posting in place, without loading a page.
	await page.evaluate(() =>
		history.pushState({}, "", "/jobs/search-results/?currentJobId=4098765432&keywords=designer"),
	);
	await expect(field(panel, "key")).toHaveText("linkedin:4098765432");

	// With none picked, the panel asks to pick one.
	await page.evaluate(() => history.pushState({}, "", "/jobs/search-results/?keywords=designer"));
	await expect(panel.getByText("Pick one job posting to save it.")).toBeVisible();
});

test("an expired posting lists what could not be read", async ({ context, serviceWorker, extensionId }) => {
	const url = "https://id.jobstreet.com/id/job/81234567";
	await openBoard(context, "https://id.jobstreet.com", "jobstreet/expired.html", url);
	const panel = await openReading(context, extensionId, await tabIdFor(serviceWorker, url));

	await expect(panel.getByRole("heading", { name: "Product Designer" })).toBeVisible();
	await expect(field(panel, "missing")).toHaveText("location");
	await expect(panel.getByText("Some details could not be read from this page.")).toBeVisible();
	await expect(panel.getByRole("button", { name: "Report this page" })).toBeVisible();
});
