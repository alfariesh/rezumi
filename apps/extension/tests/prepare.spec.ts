import type { BrowserContext, Page, Worker } from "@playwright/test";
import { defaultFollowUpDay, localDay } from "../src/shared/follow-ups";
import { connect, screenshotDir, server, serverIsUp, signUp } from "./account";
import { AI_STUB_PORT, startAiStub, STUB_POSTING } from "./ai-stub";
import { expect, serveFixture, test } from "./fixtures";

/**
 * Phase 05: the match with a resume, AI with its cost, the preparation buttons and reminders, against a local Rezumi
 * server (skipped without one at http://localhost:3000). AI runs on the scripted stub (ai-stub.ts), never a real one.
 */

const glints = {
	origin: "https://glints.com",
	fixture: "glints/detail.html",
	url: "https://glints.com/id/opportunities/jobs/product-designer/1d6c1f1e-6f43-4d3c-9f5f-7b6a2d1c0e9a",
	// The fixture's JSON-LD `validThrough`.
	closes: "2026-12-14",
};

const JOB_TEXT =
	"We need a product designer with Figma, user research, accessibility and SQL experience to design calm tools.";

const headers = { origin: server };

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

async function connectedPanel(context: BrowserContext, extensionId: string) {
	await signUp(context);
	const panel = await context.newPage();
	await panel.setViewportSize({ width: 420, height: 1400 });
	await panel.goto(`chrome-extension://${extensionId}/sidepanel.html`);
	const consent = await connect(context, panel);
	await consent.getByRole("button", { name: "Allow access" }).click();
	await expect(panel.getByRole("button", { name: "Settings" })).toBeVisible();
	return panel;
}

/** A resume through the REST API with the browser's Rezumi session; `summary` fills its summary. */
async function createResume(context: BrowserContext, name: string, summary?: string) {
	const created = await context.request.post(`${server}/api/openapi/resumes`, {
		headers,
		data: { name, tags: [], withSampleData: false },
	});
	expect(created.ok()).toBe(true);
	const id = (await created.json()) as string;
	if (summary) {
		const patched = await context.request.patch(`${server}/api/openapi/resumes/${id}`, {
			headers,
			data: { operations: [{ op: "replace", path: "/summary/content", value: `<p>${summary}</p>` }] },
		});
		expect(patched.ok()).toBe(true);
	}
	return id;
}

async function openPosting(context: BrowserContext, serviceWorker: Worker, panel: Page, extensionId: string) {
	await serveFixture(context, glints.origin, glints.fixture);
	const page = await context.newPage();
	await page.goto(glints.url);
	const tabId = await tabIdFor(serviceWorker, glints.url);
	await panel.goto(`chrome-extension://${extensionId}/sidepanel.html?tab=${tabId}&clean`);
	await expect(panel.getByRole("textbox", { name: "Role" })).toHaveValue("Product Designer");
	await expect(panel.getByText(/Checking your applications…|Reading with AI…/)).toBeHidden();
	return { page, tabId };
}

const badgeText = (serviceWorker: Worker, tabId?: number) =>
	serviceWorker.evaluate((id) => chrome.action.getBadgeText(id === undefined ? {} : { tabId: id }), tabId);

test.describe("match, AI, preparation and reminders", () => {
	test.beforeEach(async () => {
		test.skip(!(await serverIsUp()), `No Rezumi server at ${server}`);
	});

	test("the match follows the resume, the reminder starts from the deadline and shows on the badge", async ({
		context,
		serviceWorker,
		extensionId,
	}) => {
		test.setTimeout(120_000);
		const panel = await connectedPanel(context, extensionId);
		const blank = await createResume(context, "Blank resume");
		const designer = await createResume(
			context,
			"Designer resume",
			"Product designer working in Figma on user research.",
		);
		// The designer resume is the account's primary one (aturan turunan #11); a primary resume must be public.
		expect(
			(
				await context.request.patch(`${server}/api/openapi/resumes/${designer}/metadata`, {
					headers,
					data: { isPublic: true, isPrimary: true },
				})
			).ok(),
		).toBe(true);

		const { page, tabId } = await openPosting(context, serviceWorker, panel, extensionId);

		// Aturan turunan #6: two days before the posting closes.
		const reminder = panel.getByLabel("Follow up on");
		await expect(reminder).toHaveValue(defaultFollowUpDay(glints.closes, localDay()));

		// The match: the primary resume first, then another one picked (and remembered).
		await panel.getByRole("button", { name: "Description" }).click();
		await panel.getByRole("textbox", { name: "Job description" }).fill(JOB_TEXT);
		const percent = panel.getByTestId("match-percent");
		await expect(percent).toBeVisible();
		await expect(panel.getByRole("list", { name: "Missing from your resume" })).toContainText("SQL");
		await expect(panel.getByRole("list", { name: "In your resume" })).toContainText(/Figma/i);
		const withDesigner = await percent.textContent();
		if (screenshotDir) await panel.screenshot({ path: `${screenshotDir}/match-en.png`, fullPage: true });
		await panel.getByRole("button", { name: /Resume to compare/ }).click();
		await panel.getByRole("option", { name: "Blank resume" }).click();
		await expect(percent).not.toHaveText(withDesigner ?? "");
		await expect(percent).toHaveText("0% of terms");
		expect(
			await serviceWorker.evaluate(
				async () =>
					((await chrome.storage.local.get("settings")).settings as { matchResumeId?: string } | undefined)
						?.matchResumeId,
			),
		).toBe(blank);

		// A reminder for today: saved with the application, and counted on the badge in other tabs.
		await reminder.fill(localDay());
		await panel.getByRole("textbox", { name: "Reminder note" }).fill("Ask about the portfolio review");
		await panel.getByRole("button", { name: "Save to Rezumi" }).click();
		await expect(panel.getByText("Saved to Rezumi", { exact: true })).toBeVisible();
		await expect.poll(() => badgeText(serviceWorker)).toBe("1");
		// The posting's own tab keeps the saved check.
		await expect.poll(() => badgeText(serviceWorker, tabId)).toBe("✓");
		// Reminders turned on but the browser's permission missing (never granted, or taken back): none shows (#7).
		const shown = await serviceWorker.evaluate(async (day) => {
			const stored = (await chrome.storage.local.get("settings")).settings as Record<string, unknown> | undefined;
			await chrome.storage.local.set({ settings: { ...stored, notifications: true } });
			const remind = (globalThis as { rezumiReminders?: (now: string) => Promise<unknown[]> }).rezumiReminders;
			return remind?.(`${day}T10:00:00`);
		}, localDay());
		expect(shown).toEqual([]);
		if (screenshotDir) await panel.screenshot({ path: `${screenshotDir}/saved-full-en.png`, fullPage: true });

		// Preparation: "Tailor resume" opens the application on the web with "Copy for a job" for it.
		const applications = (await (
			await context.request.get(`${server}/api/openapi/applications`, { headers })
		).json()) as { id: string; followUpAt: string | null; followUpNote: string | null }[];
		const [saved] = applications;
		if (!saved) throw new Error("Nothing saved");
		expect(saved.followUpAt?.slice(0, 10)).toBe(localDay());
		expect(saved.followUpNote).toBe("Ask about the portfolio review");
		const tailor = panel.getByRole("link", { name: "Tailor resume" });
		await expect(tailor).toHaveAttribute(
			"href",
			`${server}/dashboard/applications/${saved.id}?prepare=resume&from=${blank}`,
		);
		const web = await context.newPage();
		await web.goto((await tailor.getAttribute("href")) ?? "");
		await expect(web.getByText("Copy a resume for a job")).toBeVisible({ timeout: 30_000 });
		await expect(web).not.toHaveURL(/prepare=resume/);
		await web.close();

		// "Write cover letter" starts a letter for this job and opens it in the web editor.
		const letterTab = context.waitForEvent("page");
		await panel.getByRole("button", { name: "Write cover letter" }).click();
		const letter = await letterTab;
		await expect(letter).toHaveURL(new RegExp(`^${server}/builder/letter/`));
		await letter.close();
		await expect(panel.getByRole("link", { name: "Open cover letter" })).toBeVisible();

		// The home screen lists it as due; "Done" clears the reminder and the badge.
		await page.close();
		await panel.goto(`chrome-extension://${extensionId}/sidepanel.html`);
		await expect(panel.getByText("Ask about the portfolio review")).toBeVisible();
		if (screenshotDir) await panel.screenshot({ path: `${screenshotDir}/home-due-en.png`, fullPage: true });
		await panel.getByRole("button", { name: /^Done: / }).click();
		await expect(panel.getByText("Ask about the portfolio review")).toBeHidden();
		await expect.poll(() => badgeText(serviceWorker)).toBe("");
	});

	test("Read with AI and the AI score show their cost first; out of credits offers saving without AI; the own AI connection runs them", async ({
		context,
		serviceWorker,
		extensionId,
	}) => {
		test.setTimeout(120_000);
		const stub = await startAiStub();
		try {
			const panel = await connectedPanel(context, extensionId);
			await createResume(context, "Designer resume", "Product designer working in Figma on user research.");
			await openPosting(context, serviceWorker, panel, extensionId);

			// A new Free account has no Rezumi AI credits: the cost shows before it runs, the server refuses, and the
			// form keeps the page's fields with "Save without AI".
			const aiSwitch = panel.getByText("Read with AI", { exact: true });
			await aiSwitch.click();
			await expect(panel.getByText("Uses 1 credit each time.", { exact: false })).toBeVisible();
			await expect(panel.getByText("0 credits left")).toBeVisible();
			await expect(panel.getByText("You're out of credits.")).toBeVisible();
			await expect(panel.getByRole("textbox", { name: "Role" })).toHaveValue("Product Designer");
			if (screenshotDir) await panel.screenshot({ path: `${screenshotDir}/ai-credits-en.png`, fullPage: true });
			await panel.getByRole("button", { name: "Save without AI" }).click();
			await expect(panel.getByText("You're out of credits.")).toBeHidden();
			expect(
				await serviceWorker.evaluate(
					async () =>
						((await chrome.storage.local.get("settings")).settings as { readWithAi?: boolean } | undefined)?.readWithAi,
				),
			).toBe(false);
			expect(stub.calls).not.toContain("posting");

			// The account adds its own AI connection (the stub): the panel offers it, and it runs without credits.
			const provider = await context.request.post(`${server}/api/openapi/ai-providers`, {
				headers,
				data: {
					label: "Stub",
					provider: "openai-compatible",
					model: "stub",
					baseURL: `http://127.0.0.1:${AI_STUB_PORT}/v1`,
					apiKey: "stub-key",
				},
			});
			expect(provider.ok()).toBe(true);
			const providerId = ((await provider.json()) as { id: string }).id;
			expect(
				(await context.request.post(`${server}/api/openapi/ai-providers/${providerId}/test`, { headers })).ok(),
			).toBe(true);
			await panel.reload();
			await expect(panel.getByRole("textbox", { name: "Role" })).toHaveValue("Product Designer");
			await aiSwitch.click();
			await panel.getByRole("button", { name: /Run AI with/ }).click();
			await panel.getByRole("option", { name: "Your AI connection" }).click();
			await expect(panel.getByText("with your AI connection", { exact: false })).toBeVisible();
			await expect(panel.getByRole("textbox", { name: "Role" })).toHaveValue(STUB_POSTING.role, { timeout: 20_000 });
			await expect(panel.getByRole("textbox", { name: "Salary" })).toHaveValue(/IDR 15/);
			expect(stub.calls).toContain("posting");
			if (screenshotDir) await panel.screenshot({ path: `${screenshotDir}/ai-read-en.png`, fullPage: true });
			await panel.getByRole("button", { name: "Save to Rezumi" }).click();
			await expect(panel.getByText("Saved to Rezumi", { exact: true })).toBeVisible();

			// The AI score shows its cost on Rezumi AI before it runs; on the own connection it runs and shows reasons.
			await panel.getByRole("button", { name: /Run AI with/ }).click();
			await panel.getByRole("option", { name: "Rezumi AI (uses credits)" }).click();
			await expect(panel.getByRole("button", { name: "AI score (4 credits)" })).toBeVisible();
			await panel.getByRole("button", { name: /Run AI with/ }).click();
			await panel.getByRole("option", { name: "Your AI connection" }).click();
			await panel.getByRole("button", { name: "AI score", exact: true }).click();
			await expect(panel.getByTestId("ai-score")).toHaveText("72/100", { timeout: 20_000 });
			await expect(panel.getByText("Designs in Figma")).toBeVisible();
			expect(stub.calls).toContain("score");
			if (screenshotDir) await panel.screenshot({ path: `${screenshotDir}/ai-score-en.png`, fullPage: true });
		} finally {
			await stub.close();
		}
	});
});
