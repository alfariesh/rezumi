import type { Page } from "@playwright/test";
import { mockRpc, rpcError } from "../fixtures/rpc";
import { expect, test } from "../fixtures/test";

// The sources are answered in the browser, so nothing here reaches LinkedIn (Apify) or GitHub. The Profile, the
// preferences and the first resume are saved by the real server.

const SECTIONS = [
	"experience",
	"education",
	"projects",
	"skills",
	"languages",
	"certifications",
	"awards",
	"publications",
	"volunteer",
	"interests",
	"profiles",
	"references",
];

const emptyProfile = () => ({
	basics: {
		name: "",
		headline: "",
		email: "",
		phone: "",
		location: "",
		website: { url: "", label: "" },
		customFields: [],
	},
	picture: { url: "" },
	summary: { content: "" },
	sections: Object.fromEntries(SECTIONS.map((section) => [section, [] as unknown[]])),
});

const project = (id: string, name: string) => ({
	id,
	hidden: false,
	name,
	period: "",
	website: { url: `https://example.test/${id}`, label: "", inlineLink: false },
	description: "",
});

const githubResult = () => {
	const data = emptyProfile();
	data.basics.headline = "Data analyst";
	data.sections.projects = [project("gh-1", "Pasar dashboards"), project("gh-2", "Kopi forecast")];
	return { data, photoUrl: null, notes: [] };
};

async function stubSources(page: Page) {
	let githubCalls = 0;
	await mockRpc(page, {
		"profile/sources/status": () => ({
			linkedin: true,
			github: true,
			website: false,
			account: {
				name: "Fictional Person",
				email: "fictional@example.test",
				image: null,
				githubUsername: null,
				providers: [],
			},
		}),
		"profile/sources/linkedin": () => rpcError(404, "SOURCE_NOT_FOUND"),
		// The first read fails like a provider timing out; Retry reads it again.
		"profile/sources/github": () => (++githubCalls === 1 ? rpcError(502, "SOURCE_FAILED") : githubResult()),
	});
}

test("a new account brings what it has, reviews it and opens its first resume", async ({ authPage: page }) => {
	await stubSources(page);
	await page.goto("/dashboard");
	await page.waitForURL(/\/onboarding$/);
	await expect(page.getByRole("heading", { name: "Bring what you have", level: 1 })).toBeVisible();

	await page.getByLabel("LinkedIn profile link").fill("linkedin.com/in/fictional-person");
	await page.getByLabel("GitHub username").fill("fictional-dev");
	await page.getByRole("button", { name: "Continue", exact: true }).click();
	// LinkedIn waits for "This is my own profile".
	await expect(page.getByText("Confirm this is your own profile.")).toBeVisible();
	await page.getByRole("checkbox", { name: "This is my own profile" }).check({ force: true });
	await page.getByRole("button", { name: "Continue", exact: true }).click();

	// Each source fails on its own; only the one worth trying again offers Retry.
	await expect(page.getByRole("heading", { name: "While we read your details", level: 1 })).toBeVisible();
	await expect(page.getByText("That profile wasn't found, or it isn't public. Check the link.")).toBeVisible();
	await expect(page.getByText("GitHub didn't answer in time. Try again in a moment.")).toBeVisible();
	await expect(page.getByRole("button", { name: "Retry" })).toHaveCount(1);
	await page.getByRole("button", { name: "Retry" }).click();
	await expect(page.getByText("Found: Projects 2 · Details 1")).toBeVisible();

	await page.getByLabel("What roles are you aiming for?").fill("Data analyst");
	await page.getByLabel("What roles are you aiming for?").press("Enter");
	await page.getByRole("button", { name: "Review what we found" }).click();

	await expect(page.getByRole("heading", { name: "Check what we found", level: 1 })).toBeVisible();
	await page.getByRole("checkbox", { name: /Kopi forecast/ }).uncheck({ force: true });
	await expect(page.getByText("2 entries ticked")).toBeVisible();
	await page.getByRole("button", { name: "Save to my Profile" }).click();

	await expect(page.getByRole("heading", { name: "Pick a look for your first resume", level: 1 })).toBeVisible();
	await page.getByRole("button", { name: /^Sterling/ }).click();
	await page.getByRole("button", { name: "Create my resume" }).click();
	await page.waitForURL(/\/builder\/[^/]+$/);

	const profile = await (await page.request.get("/api/openapi/profile")).json();
	expect(profile.data.basics.headline).toBe("Data analyst");
	expect(profile.data.sections.projects.map((item: { name: string }) => item.name)).toEqual(["Pasar dashboards"]);
	const preferences = await (await page.request.get("/api/openapi/career/profile")).json();
	expect(preferences.targetRoles).toEqual(["Data analyst"]);

	// Saved once, onboarding doesn't open again.
	await page.goto("/dashboard");
	await expect(page.getByRole("heading", { name: "Home", level: 1 })).toBeVisible();
	await expect(page).toHaveURL(/\/dashboard$/);
});

test("Skip saves the Profile as it is, so onboarding opens once", async ({ authPage: page }) => {
	await stubSources(page);
	await page.goto("/dashboard");
	await page.waitForURL(/\/onboarding$/);
	await page.getByRole("button", { name: "Skip" }).click();
	await page.waitForURL(/\/dashboard$/);
	await page.reload();
	await expect(page.getByRole("heading", { name: "Home", level: 1 })).toBeVisible();
	await expect(page).toHaveURL(/\/dashboard$/);
});

test("starting from scratch skips the review and still offers a first resume", async ({ authPage: page }) => {
	await stubSources(page);
	await page.goto("/onboarding");
	await page.getByRole("button", { name: "Start from scratch" }).click();
	await expect(page.getByRole("heading", { name: "Two quick questions", level: 1 })).toBeVisible();
	await page.getByRole("button", { name: "Continue", exact: true }).click();
	await expect(page.getByRole("heading", { name: "Pick a look for your first resume", level: 1 })).toBeVisible();
	await page.getByRole("button", { name: "Not now" }).click();
	await page.waitForURL(/\/dashboard$/);
	await expect(page.getByRole("heading", { name: "Home", level: 1 })).toBeVisible();
});
