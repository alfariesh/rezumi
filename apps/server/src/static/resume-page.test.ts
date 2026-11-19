import { createHash } from "node:crypto";
import { expect, it, vi } from "vite-plus/test";
import { WEB_PAGE_SCRIPT } from "@rezumi/pdf/web-page-document";
import { defaultResumeData } from "@rezumi/schema/resume/default";

vi.mock("@rezumi/env/server", () => ({ env: { APP_URL: "https://resume.example" } }));
vi.mock("@rezumi/api/features/resume/web-page", () => ({
	loadPublicWebPage: vi.fn(),
	verifyWebPagePassword: vi.fn(),
}));
vi.mock("@rezumi/pdf/web-page", () => ({
	renderResumeWebPage: vi.fn(async () => ({ lang: "en-US", html: "<svg><script>untrusted()</script></svg>", css: "" })),
	webPageImageUrl: () => () => undefined,
}));

it("authorizes only the fixed application script, even if rendered content contains a script", async () => {
	const { loadPublicWebPage } = await import("@rezumi/api/features/resume/web-page");
	vi.mocked(loadPublicWebPage).mockResolvedValue({
		status: "ready",
		data: structuredClone(defaultResumeData),
		username: "ada",
		slug: "resume",
		updatedAt: new Date(),
		indexable: false,
		hasPassword: false,
		showDownloadButtons: false,
		customDomain: null,
	} as never);
	const { serveResumePage } = await import("./resume-page");
	const response = await serveResumePage(
		new Request("https://resume.example/ada/resume"),
		{ username: "ada", slug: "resume" },
		"test",
	);
	const csp = response.headers.get("content-security-policy");
	const hash = (script: string) => createHash("sha256").update(script).digest("base64");
	expect(response.status).toBe(200);
	expect(await response.text()).toContain("untrusted()");
	expect(csp).toContain(`'sha256-${hash(WEB_PAGE_SCRIPT)}'`);
	expect(csp).not.toContain(hash("untrusted()"));
	expect(csp?.match(/script-src ([^;]*)/)?.[1]).not.toContain("'unsafe-inline'");
});

it("says 'page' where nothing is shared at `/<username>`, which can be a portfolio's address, and 'resume' elsewhere", async () => {
	const { loadPublicWebPage } = await import("@rezumi/api/features/resume/web-page");
	vi.mocked(loadPublicWebPage).mockResolvedValue({ status: "unavailable" });
	const { serveResumePage } = await import("./resume-page");
	const english = { headers: { "accept-language": "en-US" } };
	const primary = await serveResumePage(
		new Request("https://resume.example/ada", english),
		{ username: "ada", primary: true },
		"test",
	);
	expect(primary.status).toBe(404);
	expect(await primary.text()).toContain("This page isn&#39;t shared right now.");
	const resume = await serveResumePage(
		new Request("https://resume.example/ada/cv", english),
		{ username: "ada", slug: "cv" },
		"test",
	);
	expect(await resume.text()).toContain("This resume isn&#39;t shared right now.");
});
