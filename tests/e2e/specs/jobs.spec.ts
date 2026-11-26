import { expect, test } from "../fixtures/test";

/**
 * Jobs (`.agents/docs/plans/lowongan`): the server searches through the treg stand-in (fixtures/treg-stub.ts), never
 * treg itself. Each test searches its own title, so the shared search cache never answers one test from another.
 */

const uniqueTitle = (testId: string) => `Data Analyst ${testId.slice(0, 8)}`;

test("searches with no setup, opens a listing and tracks it into Applications", async ({
	authPage: page,
}, testInfo) => {
	const title = uniqueTitle(testInfo.testId);
	await page.goto("/dashboard/applications/jobs");
	await expect(page.getByRole("heading", { name: "Jobs", level: 1 })).toBeVisible();
	const form = page.getByRole("search", { name: "Search jobs" });
	await form.getByRole("searchbox", { name: "Role or keywords" }).fill(title);
	await form.getByRole("button", { name: "Search", exact: true }).click();

	const first = page.getByRole("article", { name: title, exact: true });
	await expect(first).toBeVisible();
	// The search as the address holds it, with the country the form started from.
	const searched = page.url();
	// A page holds ten; "Load more" brings the other two.
	await expect(page.getByText("10 jobs")).toBeVisible();
	await page.getByRole("button", { name: "Load more" }).click();
	await expect(page.getByText("12 jobs")).toBeVisible();
	// On a wide screen the first listing opens beside the results: the provider's description as text.
	const open = page.getByRole("complementary", { name: "Job details" });
	await expect(open.getByRole("heading", { name: title, exact: true })).toBeVisible();
	await expect(open.getByText(/Join .* as /)).toBeVisible();
	await expect(open.locator("li", { hasText: "Own the reporting" })).toHaveCount(0);
	const original = open.getByRole("link", { name: /View original/ });
	await expect(original).toHaveAttribute("target", "_blank");
	await expect(original).toHaveAttribute("rel", "noopener noreferrer");

	await open.getByRole("button", { name: "Track", exact: true }).click();
	await expect(open.getByRole("link", { name: /Tracked/ })).toBeVisible();
	await expect(first.getByText("Tracked")).toBeVisible();

	const applications = await (await page.request.get("/api/openapi/applications")).json();
	expect(applications).toEqual(
		expect.arrayContaining([
			expect.objectContaining({
				role: title,
				status: "saved",
				sourceUrl: expect.stringMatching(/^https:\/\/careers\.example\.com\//),
				postingSource: expect.objectContaining({ method: "job-search" }),
			}),
		]),
	);
	await page.goto("/dashboard/applications");
	await expect(page.getByText(title, { exact: true }).first()).toBeVisible();

	// Searching again marks it as tracked, and tracking again doesn't make a second application.
	await page.goto(searched);
	await expect(page.getByRole("article", { name: title, exact: true }).getByText("Tracked")).toBeVisible();
});

test("keeps the old Jobs address working, as a page of Applications", async ({ authPage: page }) => {
	await page.goto("/dashboard/jobs?q=Designer");
	await expect(page).toHaveURL(/\/dashboard\/applications\/jobs\?q=Designer/);
	await expect(
		page.getByRole("navigation", { name: "Applications" }).getByRole("link", { name: "Jobs" }),
	).toBeVisible();
});

test("shows a plain message once the day's searches are used up", async ({ authPage: page }, testInfo) => {
	const title = uniqueTitle(testInfo.testId);
	const quota = await (await page.request.get("/api/openapi/jobs/quota")).json();
	expect(quota.available).toBe(true);
	for (let index = quota.quota.used; index < quota.quota.max; index += 1) {
		const response = await page.request.post("/api/openapi/jobs/search", {
			data: { query: `${title} filler ${index}` },
		});
		await expect(response).toBeOK();
	}

	await page.goto("/dashboard/applications/jobs");
	await expect(page.getByText(`No searches left today (of ${quota.quota.max})`)).toBeVisible();
	const form = page.getByRole("search", { name: "Search jobs" });
	await form.getByRole("searchbox", { name: "Role or keywords" }).fill(`${title} one more`);
	await form.getByRole("button", { name: "Search", exact: true }).click();
	await expect(page.getByText(/You've reached today's search limit/)).toBeVisible();
	await expect(page.getByRole("link", { name: "See plans" })).toBeVisible();

	// A page already opened today still opens.
	await page.goto(`/dashboard/applications/jobs?q=${encodeURIComponent(`${title} filler 0`)}`);
	await expect(page.getByRole("article", { name: `${title} filler 0`, exact: true })).toBeVisible();
});

test("Save a job links to Jobs instead of searching in the dialog", async ({ authPage: page }) => {
	await page.goto("/dashboard/applications");
	await page.getByRole("button", { name: "Save job", exact: true }).first().click();
	const dialog = page.getByRole("dialog", { name: "Save a job", exact: true });
	await expect(dialog.getByText("Search job postings")).toHaveCount(0);
	await dialog.getByRole("link", { name: "Find jobs" }).click();
	await expect(page).toHaveURL(/\/dashboard\/applications\/jobs/);
});
