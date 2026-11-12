import { expect, serveFixture, tabPages, test } from "./fixtures";

const boards = [
	{
		origin: "https://www.linkedin.com",
		fixture: "linkedin.html",
		url: "https://www.linkedin.com/jobs/view/product-designer-at-lumen-health-4012345678/?trk=public_jobs",
		key: "linkedin:4012345678",
	},
	{
		origin: "https://id.indeed.com",
		fixture: "indeed.html",
		url: "https://id.indeed.com/viewjob?jk=0123456789abcdef&from=serp",
		key: "indeed:0123456789abcdef",
	},
	{
		origin: "https://id.jobstreet.com",
		fixture: "jobstreet.html",
		url: "https://id.jobstreet.com/id/job/81234567",
		key: "jobstreet:81234567",
	},
	{
		origin: "https://glints.com",
		fixture: "glints.html",
		url: "https://glints.com/id/opportunities/jobs/product-designer/1d6c1f1e-6f43-4d3c-9f5f-7b6a2d1c0e9a",
		key: "glints:1d6c1f1e-6f43-4d3c-9f5f-7b6a2d1c0e9a",
	},
];

for (const board of boards) {
	test(`the service worker receives the posting key on ${board.fixture.replace(".html", "")}`, async ({
		context,
		serviceWorker,
	}) => {
		await serveFixture(context, board.origin, board.fixture);
		const page = await context.newPage();
		await page.goto(board.url);

		await expect
			.poll(async () => (await tabPages(serviceWorker)).find((tab) => tab.url === board.url)?.key)
			.toBe(board.key);
	});
}

test("a single-page switch to another posting reports the new key", async ({ context, serviceWorker }) => {
	await serveFixture(context, "https://www.linkedin.com", "linkedin.html");
	const page = await context.newPage();
	await page.goto("https://www.linkedin.com/jobs/search/?currentJobId=4012345678");
	await expect.poll(async () => (await tabPages(serviceWorker)).map((tab) => tab.key)).toContain("linkedin:4012345678");

	// LinkedIn swaps the picked posting in place, without loading a page.
	await page.evaluate(() => history.pushState({}, "", "/jobs/search/?currentJobId=4098765432"));
	await expect.poll(async () => (await tabPages(serviceWorker)).map((tab) => tab.key)).toEqual(["linkedin:4098765432"]);

	// A search page with no posting picked clears it.
	await page.evaluate(() => history.pushState({}, "", "/jobs/search/?keywords=designer"));
	await expect.poll(async () => (await tabPages(serviceWorker)).map((tab) => tab.key)).toEqual([null]);
});

test("the content script runs only on the four boards", async ({ context, serviceWorker }) => {
	await context.route("https://lumen.example/**", (route) =>
		route.fulfill({ status: 200, contentType: "text/html", body: "<h1>Product Designer</h1>" }),
	);
	const page = await context.newPage();
	await page.goto("https://lumen.example/careers/designer");
	await page.waitForTimeout(500);
	expect(await tabPages(serviceWorker)).toEqual([]);
});
