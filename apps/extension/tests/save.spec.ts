import type { BrowserContext, Page, Worker } from "@playwright/test";
import { connect, screenshotDir, server, serverIsUp, signUp } from "./account";
import { expect, serveFixture, test } from "./fixtures";

/**
 * Phase 04: saving a posting with one click and the "Saved" marks, against a local Rezumi server (skipped without one
 * at http://localhost:3000). The job boards are served from fixtures at their real addresses.
 */

const boards = [
	{
		origin: "https://www.linkedin.com",
		fixture: "linkedin/view.html",
		url: "https://www.linkedin.com/jobs/view/4012345678/?trk=public_jobs",
		canonical: "https://www.linkedin.com/jobs/view/4012345678/",
		key: "linkedin:4012345678",
	},
	{
		origin: "https://id.indeed.com",
		fixture: "indeed/search-picked.html",
		url: "https://id.indeed.com/jobs?q=designer&l=Jakarta&vjk=0123456789abcdef",
		canonical: "https://id.indeed.com/viewjob?jk=0123456789abcdef",
		key: "indeed:0123456789abcdef",
	},
	{
		origin: "https://id.jobstreet.com",
		fixture: "jobstreet/detail.html",
		url: "https://id.jobstreet.com/id/job/81234567",
		canonical: "https://id.jobstreet.com/job/81234567",
		key: "jobstreet:81234567",
	},
	{
		origin: "https://glints.com",
		fixture: "glints/detail.html",
		url: "https://glints.com/id/opportunities/jobs/product-designer/1d6c1f1e-6f43-4d3c-9f5f-7b6a2d1c0e9a?utm_source=x",
		canonical: "https://glints.com/id/opportunities/jobs/product-designer/1d6c1f1e-6f43-4d3c-9f5f-7b6a2d1c0e9a",
		key: "glints:1d6c1f1e-6f43-4d3c-9f5f-7b6a2d1c0e9a",
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

/** The on-page button's label (development builds copy it onto the host: the shadow root is closed). */
const buttonState = (board: Page) =>
	board
		.locator("rezumi-save-button")
		.getAttribute("data-rezumi-state", { timeout: 5_000 })
		.catch(() => null);

async function connectedPanel(context: BrowserContext, extensionId: string) {
	await signUp(context);
	const panel = await context.newPage();
	await panel.goto(`chrome-extension://${extensionId}/sidepanel.html`);
	const consent = await connect(context, panel);
	await consent.getByRole("button", { name: "Allow access" }).click();
	await expect(panel.getByRole("button", { name: "Settings" })).toBeVisible();
	return panel;
}

/** The account's applications, through the REST API with the browser's Rezumi session. */
async function applications(context: BrowserContext) {
	const response = await context.request.get(`${server}/api/openapi/applications`, { headers: { origin: server } });
	expect(response.ok()).toBe(true);
	return (await response.json()) as {
		id: string;
		role: string;
		company: string;
		status: string;
		sourceUrl: string | null;
		postingSource: { method: string } | null;
		contacts: { email: string; phone: string }[];
	}[];
}

test.describe("saving postings", () => {
	test.beforeEach(async () => {
		test.skip(!(await serverIsUp()), `No Rezumi server at ${server}`);
	});

	test("the on-page button opens the panel, the posting saves, and every board shows it saved", async ({
		context,
		serviceWorker,
		extensionId,
	}) => {
		test.setTimeout(120_000);
		const panel = await connectedPanel(context, extensionId);

		for (const [index, board] of boards.entries()) {
			await serveFixture(context, board.origin, board.fixture);
			const page = await context.newPage();
			await page.goto(board.url);
			await expect.poll(() => buttonState(page)).toBe("Save to Rezumi");

			// A real click on the button (trusted, as a person's): the service worker opens the side panel from it.
			const host = page.locator("rezumi-save-button");
			const box = await host.boundingBox();
			expect(box).not.toBeNull();
			if (box && index === 0) {
				await page.mouse.click(box.x + 20, box.y + box.height / 2);
				// No "click the toolbar icon" hint: the browser accepted the gesture (02-teknis.md §8).
				await page.waitForTimeout(500);
				expect(await host.getAttribute("data-rezumi-hint")).toBeNull();
			}

			const tabId = await tabIdFor(serviceWorker, board.url);
			await panel.goto(`chrome-extension://${extensionId}/sidepanel.html?tab=${tabId}&clean`);
			const role = panel.getByRole("textbox", { name: "Role" });
			await expect(role).toHaveValue("Product Designer");
			await expect(panel.getByRole("textbox", { name: "Company" })).toHaveValue("Lumen Health");
			if (index === 0) await role.fill("Senior Product Designer");
			// Wait for the server's reading (similar and existing applications) before saving.
			await expect(panel.getByText("Checking your applications…")).toBeHidden();

			const started = Date.now();
			await panel.getByRole("button", { name: "Save to Rezumi" }).click();
			await expect(panel.getByText("Saved to Rezumi", { exact: true })).toBeVisible();
			const elapsed = Date.now() - started;
			console.info(`[save] ${board.key}: ${elapsed} ms`);
			expect(elapsed).toBeLessThan(3_000);

			await expect.poll(() => buttonState(page)).toBe("Saved");
			await page.close();
		}

		const saved = await applications(context);
		expect(saved).toHaveLength(4);
		for (const board of boards) {
			const application = saved.find((item) => item.sourceUrl === board.canonical);
			expect(application, board.key).toBeDefined();
			expect(application?.postingSource?.method).toBe("extension");
		}
		expect(saved.some((item) => item.role === "Senior Product Designer")).toBe(true);

		// Opening a saved posting again: the button and the panel know it, without saving twice (aturan turunan #4).
		const [first] = boards;
		if (!first) throw new Error("No board");
		await serveFixture(context, first.origin, first.fixture);
		const again = await context.newPage();
		await again.goto(first.url);
		await expect.poll(() => buttonState(again)).toBe("Saved");
		const tabId = await tabIdFor(serviceWorker, first.url);
		await panel.goto(`chrome-extension://${extensionId}/sidepanel.html?tab=${tabId}&clean`);
		await expect(panel.getByRole("heading", { name: "Senior Product Designer" })).toBeVisible();
		await expect(panel.getByRole("button", { name: "Save as a new application" })).toBeVisible();
		if (screenshotDir) await panel.screenshot({ path: `${screenshotDir}/saved-en.png` });

		// The status changes from the panel, and the page's chip follows.
		await panel.getByRole("button", { name: /Status/ }).click();
		await panel.getByRole("option", { name: "Interview" }).click();
		await expect.poll(() => buttonState(again)).toBe("Saved · Interview");
		await expect
			.poll(async () => (await applications(context)).find((item) => item.sourceUrl === first.canonical)?.status)
			.toBe("interview");

		// A note goes to the application's timeline.
		await panel.getByRole("textbox", { name: "Add a note" }).fill("Asked Rina for a referral.");
		await panel.getByRole("button", { name: "Add note" }).click();
		await expect(panel.getByText("Note added.")).toBeVisible();
	});

	test("an offline save keeps the form, a ticked contact is saved, and a similar job is flagged", async ({
		context,
		serviceWorker,
		extensionId,
	}) => {
		test.setTimeout(90_000);
		const panel = await connectedPanel(context, extensionId);

		// The JobStreet posting first, then the same job on LinkedIn: flagged as similar, not blocked.
		const jobstreet = boards[2];
		const linkedin = boards[0];
		if (!jobstreet || !linkedin) throw new Error("No board");
		await serveFixture(context, jobstreet.origin, jobstreet.fixture);
		const first = await context.newPage();
		await first.goto(jobstreet.url);
		await panel.goto(
			`chrome-extension://${extensionId}/sidepanel.html?tab=${await tabIdFor(serviceWorker, jobstreet.url)}&clean`,
		);
		await expect(panel.getByRole("textbox", { name: "Role" })).toHaveValue("Product Designer");
		await expect(panel.getByText("Checking your applications…")).toBeHidden();
		await panel.getByRole("button", { name: "Save to Rezumi" }).click();
		await expect(panel.getByText("Saved to Rezumi", { exact: true })).toBeVisible();

		await serveFixture(context, linkedin.origin, linkedin.fixture);
		const second = await context.newPage();
		await second.goto(linkedin.url);
		const tabId = await tabIdFor(serviceWorker, linkedin.url);
		await panel.goto(`chrome-extension://${extensionId}/sidepanel.html?tab=${tabId}&clean`);
		await expect(panel.getByText("You already saved a similar job:")).toBeVisible();
		await expect(
			panel.getByRole("link", { name: /Product Designer · Lumen Health \(id\.jobstreet\.com\)/ }),
		).toBeVisible();

		// The posting's text names an HR email: suggested, unticked by default.
		await panel.getByRole("button", { name: "Description" }).click();
		const description = panel.getByRole("textbox", { name: "Job description" });
		await description.fill(`${await description.inputValue()}\nKirim CV ke hr@lumen.example atau WA 0812-3456-7890.`);
		const email = panel.getByRole("checkbox", { name: "hr@lumen.example" });
		await expect(email).not.toBeChecked();
		await expect(panel.getByRole("checkbox", { name: "+6281234567890" })).not.toBeChecked();
		// HeroUI draws the box over the input; a person clicks the label.
		await panel.getByText("hr@lumen.example", { exact: true }).click();
		await expect(email).toBeChecked();
		await panel.getByRole("radio", { name: "Already applied" }).click();
		await expect(panel.getByRole("textbox", { name: "Applied on" })).toBeVisible();

		// The connection drops (Playwright's offline mode does not reach extension pages, so the requests fail instead):
		// the form stays as it was, with a way to try again.
		await context.route(`${server}/api/rpc/**`, (route) => route.abort("internetdisconnected"));
		await panel.getByRole("button", { name: "Save to Rezumi" }).click();
		await expect(panel.getByText("You're offline. We kept what you entered here.")).toBeVisible();
		if (screenshotDir) await panel.screenshot({ path: `${screenshotDir}/offline-en.png`, fullPage: true });
		await context.unroute(`${server}/api/rpc/**`);

		// Closing and opening the panel keeps the draft.
		await panel.reload();
		await expect(panel.getByRole("checkbox", { name: "hr@lumen.example" })).toBeChecked();
		await panel.getByRole("button", { name: "Save to Rezumi" }).click();
		await expect(panel.getByText("Saved to Rezumi", { exact: true })).toBeVisible();

		const saved = (await applications(context)).find((item) => item.sourceUrl === linkedin.canonical);
		expect(saved?.status).toBe("applied");
		expect(saved?.contacts).toEqual([expect.objectContaining({ email: "hr@lumen.example", phone: "" })]);
	});

	test("the context menu saves selected text from any site", async ({ context, serviceWorker, extensionId }) => {
		test.setTimeout(60_000);
		const panel = await connectedPanel(context, extensionId);
		const url = "https://careers.acme.example/jobs/42";
		await context.route("https://careers.acme.example/**", (route) =>
			route.fulfill({
				status: 200,
				contentType: "text/html",
				body: "<!doctype html><title>Acme careers</title><main><h1>Careers</h1><p>Data Analyst at Acme. SQL and Python.</p></main>",
			}),
		);
		const page = await context.newPage();
		await page.goto(url);
		await page.bringToFront();
		// Without the "tabs" permission tabs cannot be found by address; the page just opened is the active one.
		const tab = await serviceWorker.evaluate(async () => {
			const [found] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
			return found?.id ?? null;
		});
		expect(tab).not.toBeNull();
		// The menu item's handler, as the browser calls it when the person picks "Save selected text to Rezumi".
		await serviceWorker.evaluate(
			({ tabId, address }) =>
				(globalThis as unknown as { rezumiContextMenu: (info: object, tab: object) => void }).rezumiContextMenu(
					{ menuItemId: "save-selection", selectionText: "Data Analyst at Acme. SQL and Python.", pageUrl: address },
					{ id: tabId, url: address },
				),
			{ tabId: tab as number, address: url },
		);
		await panel.goto(`chrome-extension://${extensionId}/sidepanel.html?tab=${tab}&clean`);
		await panel.getByRole("button", { name: "Description" }).click();
		await expect(panel.getByRole("textbox", { name: "Job description" })).toHaveValue(
			"Data Analyst at Acme. SQL and Python.",
		);
	});

	test("a page with no posting takes a pasted description", async ({ context, serviceWorker, extensionId }) => {
		test.setTimeout(60_000);
		const panel = await connectedPanel(context, extensionId);
		const url = "https://www.linkedin.com/jobs/view/4099999999/";
		// A posting page that drew nothing readable (the board changed its markup, say).
		await context.route("https://www.linkedin.com/**", (route) =>
			route.fulfill({
				status: 200,
				contentType: "text/html",
				body: "<!doctype html><title>LinkedIn</title><main></main>",
			}),
		);
		const page = await context.newPage();
		await page.goto(url);
		await panel.goto(
			`chrome-extension://${extensionId}/sidepanel.html?tab=${await tabIdFor(serviceWorker, url)}&clean`,
		);
		await expect(panel.getByText("We couldn't find a job posting on this page.")).toBeVisible();
		await panel.getByRole("button", { name: "Paste description" }).click();
		await panel.getByRole("textbox", { name: "Job description" }).fill("Data Analyst at Acme. SQL and Python.");
		await panel.getByRole("button", { name: "Continue" }).click();
		await panel.getByRole("textbox", { name: "Role" }).fill("Data Analyst");
		await panel.getByRole("textbox", { name: "Company" }).fill("Acme");
		await panel.getByRole("button", { name: "Save to Rezumi" }).click();
		await expect(panel.getByText("Saved to Rezumi", { exact: true })).toBeVisible();
		const saved = (await applications(context)).find((item) => item.role === "Data Analyst");
		expect(saved?.sourceUrl).toBe(url);
	});

	test("the on-page button can be turned off in the extension's settings (aturan turunan #5)", async ({
		context,
		extensionId,
	}) => {
		test.setTimeout(60_000);
		const board = boards[3];
		if (!board) throw new Error("No board");
		// Before connecting, the button shows too.
		await serveFixture(context, board.origin, board.fixture);
		const page = await context.newPage();
		await page.goto(board.url);
		await expect.poll(() => buttonState(page)).toBe("Save to Rezumi");

		const panel = await connectedPanel(context, extensionId);
		await panel.getByRole("button", { name: "Settings" }).click();
		// HeroUI draws the switch over its input; a person clicks the row.
		const toggle = panel.getByText("Button on job sites", { exact: true });
		await toggle.click();
		await expect(panel.getByRole("switch", { name: /Button on job sites/ })).not.toBeChecked();
		await expect(page.locator("rezumi-save-button")).toHaveCount(0);
		await toggle.click();
		await expect.poll(() => buttonState(page)).toBe("Save to Rezumi");
	});
});
