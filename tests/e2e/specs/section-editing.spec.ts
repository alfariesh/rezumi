import { createSampleResumeFromDashboard, openSidebarSection } from "../fixtures/resume";
import { expect, test } from "../fixtures/test";

test("adds an experience item and persists it across reloads", async ({ authPage: page }, testInfo) => {
	await createSampleResumeFromDashboard(page, testInfo);

	const company = `E2E Corp ${Date.now()}`;
	const position = "Principal Tester";

	await openSidebarSection(page, "Experience");
	await page.getByRole("button", { name: "Add experience", exact: true }).click();

	// The new draft opens in place with its first field focused; it saves as you type.
	const entry = page.locator("#sidebar-experience [data-entry-id]").last();
	await expect(entry.getByText("Draft", { exact: true })).toBeVisible();
	await expect(entry.getByRole("textbox", { name: "Position" })).toBeFocused();

	const savePromise = page.waitForResponse((response) => {
		if (!response.url().includes("/api/rpc")) return false;
		if (response.request().method() !== "POST") return false;
		if (!response.ok()) return false;
		return (response.request().postData() ?? "").includes(company);
	});
	await entry.getByRole("textbox", { name: "Position" }).fill(position);
	await entry.getByRole("textbox", { name: "Company" }).fill(company);
	await savePromise;

	// With a company it's no longer a draft, and its card is titled by the position.
	await expect(entry.getByText("Draft", { exact: true })).toHaveCount(0);
	await expect(entry.getByRole("button", { name: new RegExp(`^${position}, entry`) })).toBeVisible();

	// And it survives a full reload: the card shows the position, and opening it shows the company.
	await page.reload();
	await openSidebarSection(page, "Experience");
	const saved = page.locator("#sidebar-experience [data-entry-id]").last();
	await expect(saved.getByRole("button", { name: new RegExp(`^${position}, entry`) })).toBeVisible();
	await saved.getByRole("button", { name: new RegExp(`^${position}, entry`) }).click();
	await expect(saved.getByRole("textbox", { name: "Company" })).toHaveValue(company);
});

test("keeps formatting controls accessible when tabbing from the editor", async ({ authPage: page }, testInfo) => {
	await createSampleResumeFromDashboard(page, testInfo);
	await openSidebarSection(page, "Summary");
	const summary = page.getByRole("textbox", { name: "Summary", exact: true });
	await summary.fill("Keyboard formatting");
	await summary.press("ControlOrMeta+A");
	expect(await summary.evaluate(() => window.getSelection()?.toString())).toBe("Keyboard formatting");
	await summary.press("Tab");
	const toolbar = page.getByRole("toolbar", { name: "Formatting" });
	const bold = toolbar.getByRole("button", { name: "Bold", exact: true });
	await expect(bold).toBeFocused();
	const wasBold = (await bold.getAttribute("aria-pressed")) === "true";
	await bold.press("Enter");
	await expect(bold).toHaveAttribute("aria-pressed", String(!wasBold));
	if (wasBold) await expect(summary.locator("strong")).toHaveCount(0);
	else await expect(summary.locator("strong")).toHaveText("Keyboard formatting");
	await expect(toolbar).toBeVisible();
});
