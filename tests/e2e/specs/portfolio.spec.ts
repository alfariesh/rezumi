import { Pool } from "pg";
import { createResumeName } from "../fixtures/data";
import { expect, test } from "../fixtures/test";

// Portfolios stay behind PORTFOLIO_MODE until they launch (portfolio plan Phase 12), so the test server needs it on.
test.skip(process.env.PORTFOLIO_MODE !== "on", "Needs PORTFOLIO_MODE=on on the test server");

for (const device of ["Desktop", "Phone"] as const) {
	test(`opens case studies in the Prima landing preview on ${device}`, async ({ page }) => {
		await page.setViewportSize({ width: 1440, height: 900 });
		await page.goto("/");
		const dialog = page.getByRole("dialog", { name: "Prima", exact: true });
		// The prerendered button is visible before React attaches its click handler.
		await expect(async () => {
			if (await dialog.isVisible()) return;
			await page.getByRole("button", { name: "Preview the Prima theme" }).click({ timeout: 2000 });
			await expect(dialog).toBeVisible({ timeout: 1000 });
		}).toPass({ timeout: 10_000 });
		const iframe = dialog.locator('iframe[title="Prima portfolio theme sample"]');
		await expect(iframe).toBeVisible();
		const preview = iframe.contentFrame();
		const menu = preview.locator("details.pf-menu");
		if (device === "Phone") {
			await dialog.getByRole("radio", { name: "Phone" }).click();
			await menu.locator("summary").click();
		}

		const heading = preview.locator("#work--title");
		await expect(heading).toBeAttached();
		await expect(heading).not.toBeInViewport();
		await preview
			.getByRole("navigation", { name: "Page navigation" })
			.getByRole("link", { name: "Case studies" })
			.click();
		await expect(heading).toBeInViewport();
		await expect(menu).not.toHaveAttribute("open", "");

		const title = "Second-generation family business succession";
		await preview.getByRole("link", { name: title }).click();
		await expect(preview.getByRole("heading", { level: 1, name: title })).toBeVisible();
		await preview.locator('a[rel="next"]').click();
		await expect(
			preview.getByRole("heading", { level: 1, name: "Education funds for three children abroad" }),
		).toBeVisible();
		await preview.getByRole("link", { name: "All work" }).click();
		await expect(heading).toBeInViewport();
	});
}

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

test("reads portfolio edits and images across mobile RPC and the web editor", async ({ authPage: page }) => {
	const created = await page.request.post("/api/rpc/portfolio/create", {
		data: { json: { startEmpty: true, basics: { name: "Maya Santoso" } } },
	});
	expect(created.ok()).toBe(true);
	const png = Buffer.from(
		"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/eioAAAAASUVORK5CYII=",
		"base64",
	);
	const uploaded = await page.request.post("/api/rpc/portfolio/uploadImage", {
		multipart: {
			data: JSON.stringify({ json: { file: null, thumbnail: null }, maps: [["file"], ["thumbnail"]] }),
			"0": { name: "sample.png", mimeType: "image/png", buffer: png },
			"1": { name: "sample-small.png", mimeType: "image/png", buffer: png },
		},
	});
	expect(uploaded.ok()).toBe(true);
	const { json: image } = await uploaded.json();
	expect(image).toMatchObject({ width: 1, height: 1, key: expect.any(String), thumbKey: expect.any(String) });
	const { json: initial } = await created.json();
	const mobileSave = await page.request.post("/api/rpc/portfolio/update", {
		data: {
			json: {
				expectedUpdatedAt: initial.updatedAt,
				data: {
					...initial.data,
					basics: {
						...initial.data.basics,
						picture: {
							key: image.key,
							thumbKey: image.thumbKey,
							width: image.width,
							height: image.height,
							alt: "Sample photo",
						},
					},
					hero: { ...initial.data.hero, showPicture: true, greeting: "Edited from the phone" },
				},
			},
			meta: [[1, "expectedUpdatedAt"]],
		},
	});
	expect(mobileSave.ok()).toBe(true);

	await page.goto("/builder/portfolio");
	const greeting = page.getByRole("textbox", { name: "Greeting" });
	await expect(greeting).toHaveValue("Edited from the phone");
	await greeting.fill("Edited from the web");
	await expect(page.getByTitle("Saved", { exact: true })).toBeVisible();
	const preview = await page.request.post("/api/rpc/portfolio/preview", { data: { json: { width: "phone" } } });
	expect(preview.ok()).toBe(true);
	const { json: rendered } = await preview.json();
	expect(rendered.html).toContain("Edited from the web");
	expect(rendered.html).toContain("Sample photo");
});
