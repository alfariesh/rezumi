import { defineConfig } from "@playwright/test";

/**
 * The extension's browser tests: Playwright's Chromium with the development build (dist/) loaded. Branded Chrome no
 * longer loads unpacked extensions from the command line, so these always use the bundled Chromium
 * (`pnpm exec playwright install chromium`). `pnpm --filter extension test:e2e` builds first.
 */
export default defineConfig({
	testDir: "tests",
	outputDir: "test-results",
	fullyParallel: false,
	workers: 1,
	retries: 0,
	reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
	use: { trace: "retain-on-failure" },
});
