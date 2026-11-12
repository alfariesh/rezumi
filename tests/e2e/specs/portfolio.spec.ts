import { Pool } from "pg";
import { createResumeName } from "../fixtures/data";
import { expect, test } from "../fixtures/test";

// Portfolios stay behind PORTFOLIO_MODE until they launch (portfolio plan Phase 12), so the test server needs it on.
test.skip(process.env.PORTFOLIO_MODE !== "on", "Needs PORTFOLIO_MODE=on on the test server");

/** Publishing needs a verified email address; test sign-ups aren't verified by email. */
async function verifyEmail(email: string) {
	const pool = new Pool({ connectionString: process.env.DATABASE_URL });
	try {
		await pool.query('update "user" set email_verified = true where email = $1', [email]);
	} finally {
		await pool.end();
	}
}

test("creates a portfolio from a resume, publishes it, and a guest sees each change", async ({
	authPage: page,
	account,
	browser,
	baseURL,
}, testInfo) => {
	await verifyEmail(account.email);
	const resumeName = createResumeName(testInfo);
	const created = await page.request.post("/api/openapi/resumes", {
		data: { name: resumeName, tags: [], withSampleData: true },
	});
	expect(created.ok()).toBe(true);

	await page.goto("/dashboard/portfolio");
	await page.getByRole("button", { name: "Create portfolio" }).click();
	const dialog = page.getByRole("dialog");
	// With no primary resume, the most recent one is picked.
	await expect(dialog.getByRole("radio", { name: resumeName })).toBeChecked();
	await dialog.getByRole("button", { name: "Next" }).click();
	await dialog.getByRole("button", { name: "Create portfolio" }).click();

	await page.waitForURL(/\/builder\/portfolio/);
	const greeting = page.getByRole("textbox", { name: "Greeting" });
	await greeting.fill("I make payments simple.");
	await expect(
		page.frameLocator('iframe[title="Portfolio preview"]').getByText("I make payments simple."),
	).toBeVisible();
	// The save status names its state in its title; its live region only speaks up when saving fails.
	await expect(page.getByTitle("Saved", { exact: true })).toBeVisible();

	await page.getByRole("tab", { name: "Publish" }).click();
	// Publishing is the switch at the top of the panel; its input is visually hidden, so people press the row's label.
	await page.getByRole("region", { name: "Publish" }).getByText("Published", { exact: true }).click();
	const publish = page.getByRole("dialog");
	await expect(publish.getByRole("switch", { name: "Show in search engines" })).toBeChecked();
	await publish.getByRole("button", { name: "Publish" }).click();
	await expect(page.getByText("Your portfolio is live")).toBeVisible();

	const guest = await browser.newContext({ baseURL });
	try {
		const visitor = await guest.newPage();
		await visitor.goto(`/${account.username}`);
		await expect(visitor.getByText("I make payments simple.")).toBeVisible();

		await page.getByRole("tab", { name: "Content" }).click();
		await page.getByRole("textbox", { name: "Greeting" }).fill("I make payments simple and safe.");
		await expect(page.getByTitle("Saved", { exact: true })).toBeVisible();
		await visitor.reload();
		await expect(visitor.getByText("I make payments simple and safe.")).toBeVisible();
	} finally {
		await guest.close();
	}
});
