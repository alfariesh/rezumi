import { defineConfig, devices } from "@playwright/test";

const port = Number.parseInt(process.env.PORT ?? "3000", 10);
const baseURL = process.env.APP_URL ?? `http://localhost:${port}`;
const isCI = process.env.CI === "true" || process.env.CI === "1";
// Job searches go to a stand-in for treg (tests/e2e/fixtures/treg-stub.ts): tests never call treg or pay for listings.
const tregStubPort = process.env.TREG_STUB_PORT ?? "3999";
const tregStubUrl = `http://127.0.0.1:${tregStubPort}`;

export default defineConfig({
	testDir: "./tests/e2e/specs",
	fullyParallel: true,
	forbidOnly: isCI,
	retries: 0,
	workers: isCI ? 1 : undefined,
	timeout: 30_000,
	expect: {
		timeout: 10_000,
	},
	reporter: isCI
		? [["list"], ["github"], ["junit", { outputFile: "test-results/e2e-junit.xml" }]]
		: [["list"], ["html", { open: "never" }]],
	use: {
		baseURL,
		trace: "retain-on-failure",
		screenshot: "only-on-failure",
		video: "retain-on-failure",
	},
	projects: [
		{
			name: "chromium",
			use: { ...devices["Desktop Chrome"] },
		},
	],
	webServer: [
		{
			command: "node tests/e2e/fixtures/treg-stub.ts",
			url: `${tregStubUrl}/health`,
			reuseExistingServer: !isCI,
			timeout: 30_000,
			env: { ...process.env, TREG_STUB_PORT: tregStubPort },
		},
		{
			// Run node directly: pnpm >=12.6 moves script children into their own process group,
			// so Playwright's group kill misses the server and the job hangs after the tests finish.
			command: "node apps/server/dist/index.mjs",
			url: `${baseURL}/api/health`,
			reuseExistingServer: !isCI,
			timeout: 120_000,
			env: {
				...process.env,
				APP_URL: baseURL,
				NODE_ENV: "production",
				PORT: String(port),
				// Always the stand-in, whatever token the shell has.
				TREG_API_KEY: "e2e-treg-stub",
				TREG_BASE_URL: tregStubUrl,
				FLAG_DISABLE_JOB_SEARCH: "false",
			},
		},
	],
});
