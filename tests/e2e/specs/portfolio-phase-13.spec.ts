import type { E2EAccount } from "../fixtures/data";
import type { Browser, Page } from "@playwright/test";
import { devices } from "@playwright/test";
import { Pool } from "pg";
import { createResumeName } from "../fixtures/data";
import { expect, test } from "../fixtures/test";

// Phase 13 (`.agents/docs/plans/portfolio/phase-13-fitur-lanjutan.md` section 5, pf-web item 8): work pages, the
// password, the vCard and business card, Embed blocks and the statistics range, end to end with a fictional account.
test.skip(process.env.PORTFOLIO_MODE !== "on", "Needs PORTFOLIO_MODE=on on the test server");

const PASSWORD = "kopi-senja-2026";
const LOOM = "https://www.loom.com/share/0123456789abcdef0123456789abcdef";

/**
 * A visitor's browser. `browser.newContext()` doesn't take the project's device settings, so it would say
 * `HeadlessChrome`, which the server treats as a crawler and doesn't count (Phase 13 3.7).
 */
const guestContext = (browser: Browser, baseURL: string | undefined) =>
	browser.newContext({ baseURL, userAgent: devices["Desktop Chrome"].userAgent, locale: "en-US" });

/** Publishing needs a verified email address; test sign-ups aren't verified by email. */
async function verifyEmail(email: string) {
	const pool = new Pool({ connectionString: process.env.DATABASE_URL });
	try {
		await pool.query('update "user" set email_verified = true where email = $1', [email]);
	} finally {
		await pool.end();
	}
}

/** The save status names its state in its title; waiting for "Saved" waits for the autosave. */
const saved = (page: Page) => expect(page.getByTitle("Saved", { exact: true })).toBeVisible();

/** A published portfolio made from a sample resume, with the editor open on Content. */
async function publishedPortfolio(page: Page, account: E2EAccount, resumeName: string) {
	await verifyEmail(account.email);
	const created = await page.request.post("/api/openapi/resumes", {
		data: { name: resumeName, tags: [], withSampleData: true },
	});
	expect(created.ok()).toBe(true);

	await page.goto("/dashboard/portfolio");
	await page.getByRole("button", { name: "Create portfolio" }).click();
	const dialog = page.getByRole("dialog");
	await dialog.getByRole("button", { name: "Next" }).click();
	await dialog.getByRole("button", { name: "Create portfolio" }).click();
	await page.waitForURL(/\/builder\/portfolio/);

	await page.getByRole("tab", { name: "Publish" }).click();
	await page.getByRole("region", { name: "Publish" }).getByText("Published", { exact: true }).click();
	await page.getByRole("dialog").getByRole("button", { name: "Publish" }).click();
	await expect(page.getByText("Your portfolio is live")).toBeVisible();
	await page.getByRole("tab", { name: "Content" }).click();
}

/** Adds an empty work with this title from Content → Work, and leaves its editor open. */
async function addWork(page: Page, title: string) {
	await page.getByRole("button", { name: "Work", exact: true }).click();
	await page.getByRole("button", { name: "Add work" }).click();
	await page.getByRole("dialog").getByRole("button", { name: /Empty/ }).click();
	await page.getByRole("textbox", { name: "Title" }).fill(title);
	await saved(page);
}

test("a work has its own page, Back returns home, and an old address forwards to the new one", async ({
	authPage: page,
	account,
	browser,
	baseURL,
}, testInfo) => {
	await publishedPortfolio(page, account, createResumeName(testInfo));
	await addWork(page, "Kopi Senja");

	const guest = await guestContext(browser, baseURL);
	try {
		const visitor = await guest.newPage();
		await visitor.goto(`/${account.username}`);
		await visitor
			.getByRole("link", { name: /Kopi Senja/ })
			.first()
			.click();
		await expect(visitor).toHaveURL(new RegExp(`/${account.username}/work/kopi-senja$`));
		await expect(visitor.getByRole("heading", { level: 1, name: "Kopi Senja" })).toBeVisible();
		await visitor.goBack();
		await expect(visitor).toHaveURL(new RegExp(`/${account.username}$`));

		// A new address keeps the old one working (Phase 13 3.1).
		await page.getByRole("textbox", { name: "Page address" }).fill("kopi-senja-app");
		await saved(page);
		await visitor.goto(`/${account.username}/work/kopi-senja`);
		await expect(visitor).toHaveURL(new RegExp(`/${account.username}/work/kopi-senja-app$`));
		await expect(visitor.getByRole("heading", { level: 1, name: "Kopi Senja" })).toBeVisible();
	} finally {
		await guest.close();
	}

	// The visitor's opening counts for the work (once per visitor and hour), and its own numbers open from the table.
	await page.goto("/dashboard/portfolio");
	const row = page.getByRole("row", { name: /Kopi Senja/ });
	await expect(row).toContainText("1");
	await row.getByRole("button", { name: "Details for Kopi Senja" }).click();
	const details = page.getByRole("dialog", { name: "Kopi Senja" });
	await expect(details.getByText("Times opened", { exact: true })).toBeVisible();
});

test("a password locks the portfolio and its works until it's entered once", async ({
	authPage: page,
	account,
	browser,
	baseURL,
}, testInfo) => {
	await publishedPortfolio(page, account, createResumeName(testInfo));
	await addWork(page, "Rahasia Klien");

	await page.getByRole("tab", { name: "Publish" }).click();
	await page.getByText("Protect with a password", { exact: true }).click();
	const dialog = page.getByRole("dialog");
	// Exact: the field's "Show password" button is labelled too.
	await dialog.getByLabel("Password", { exact: true }).fill(PASSWORD);
	await dialog.getByRole("button", { name: "Set password" }).click();
	await expect(page.getByText("Password set")).toBeVisible();
	await expect(page.getByText("Off while your portfolio has a password.")).toBeVisible();

	const guest = await guestContext(browser, baseURL);
	try {
		const visitor = await guest.newPage();
		await visitor.goto(`/${account.username}`);
		await expect(visitor.getByRole("button", { name: "Open portfolio" })).toBeVisible();
		await expect(visitor.getByText("Rahasia Klien")).toHaveCount(0);

		await visitor.getByLabel("Password").fill("not-the-password");
		await visitor.getByRole("button", { name: "Open portfolio" }).click();
		await expect(visitor.getByRole("alert")).toContainText("That password isn't right");

		await visitor.getByLabel("Password").fill(PASSWORD);
		await visitor.getByRole("button", { name: "Open portfolio" }).click();
		await expect(visitor.getByRole("link", { name: /Rahasia Klien/ }).first()).toBeVisible();

		// The access holds for the work pages too.
		await visitor.goto(`/${account.username}/work/rahasia-klien`);
		await expect(visitor.getByRole("heading", { level: 1, name: "Rahasia Klien" })).toBeVisible();
	} finally {
		await guest.close();
	}
});

test("visitors save a contact card, and the business card's code carries utm_source=qr", async ({
	authPage: page,
	account,
	browser,
	baseURL,
}, testInfo) => {
	await publishedPortfolio(page, account, createResumeName(testInfo));

	const guest = await guestContext(browser, baseURL);
	try {
		const response = await guest.request.get(`/api/portfolio/${account.username}/vcard`);
		expect(response.status()).toBe(200);
		expect(response.headers()["content-type"]).toContain("text/vcard");
		expect(response.headers()["content-disposition"]).toContain(`${account.username}.vcf`);
		expect(await response.text()).toMatch(/^FN:/m);
	} finally {
		await guest.close();
	}

	await page.getByRole("tab", { name: "Publish" }).click();
	await page.getByRole("button", { name: "Business card" }).click();
	const card = page.getByRole("dialog", { name: "Business card" });
	await expect(card.getByText("Scan to see my portfolio")).toBeVisible();
	const value = await card.locator("[data-qr-value]").getAttribute("data-qr-value");
	expect(value).toMatch(new RegExp(`/${account.username}\\?utm_source=qr$`));
	const download = page.waitForEvent("download");
	await card.getByRole("button", { name: "Download QR (SVG)" }).click();
	// The file is named from the username as letters, digits and dashes (`cardFileName`).
	const base = account.username
		.toLowerCase()
		.replace(/[^\da-z-]+/g, "-")
		.replace(/^-+|-+$/g, "");
	expect((await download).suggestedFilename()).toBe(`${base}-qr.svg`);
});

test("an Embed block is saved and shows on the work's page as a button, not a frame", async ({
	authPage: page,
	account,
	browser,
	baseURL,
}, testInfo) => {
	await publishedPortfolio(page, account, createResumeName(testInfo));
	await addWork(page, "Demo Produk");

	await page.getByRole("button", { name: "Add a block", exact: true }).click();
	await page.getByRole("menuitem", { name: /Embed/ }).click();
	// The link is asked for in the app's prompt, an alert dialog.
	const prompt = page.getByRole("alertdialog");
	await prompt.getByRole("textbox").fill(LOOM);
	await prompt.getByRole("button", { name: "Add embed" }).click();
	await expect(page.getByRole("textbox", { name: "Link" }).last()).toHaveValue(LOOM);
	await saved(page);

	const guest = await guestContext(browser, baseURL);
	try {
		const visitor = await guest.newPage();
		await visitor.goto(`/${account.username}/work/demo-produk`);
		const facade = visitor.locator("a[data-embed]");
		await expect(facade).toHaveAttribute("data-embed", /^https:\/\/www\.loom\.com\/embed\//);
		await expect(visitor.getByText("Loads content from Loom")).toBeVisible();
		await expect(visitor.locator("iframe")).toHaveCount(0);
	} finally {
		await guest.close();
	}
});

test("the statistics show the last 7, 30 or 90 days, kept in the address", async ({
	authPage: page,
	account,
}, testInfo) => {
	await publishedPortfolio(page, account, createResumeName(testInfo));

	await page.goto("/dashboard/portfolio");
	await expect(page.getByRole("img", { name: /Daily visits over 30 days/ })).toBeVisible();
	await page.getByRole("radio", { name: "Last 7 days" }).click();
	await expect(page).toHaveURL(/range=7/);
	await expect(page.getByRole("img", { name: /Daily visits over 7 days/ })).toBeVisible();
	await page.reload();
	await expect(page.getByRole("img", { name: /Daily visits over 7 days/ })).toBeVisible();
	await expect(page.getByText("Per work")).toBeVisible();
});
