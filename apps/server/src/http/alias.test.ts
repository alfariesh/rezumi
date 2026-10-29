import { describe, expect, it, vi } from "vite-plus/test";

vi.mock("@rezumi/env/server", () => ({
	env: { APP_URL: "https://rezumi.app", APP_ALIAS_URL: "https://rx.cv" },
}));

const { handleAlias, onAppDomain } = await import("./alias");

const visit = (path: string) => handleAlias(new Request(`https://rx.cv${path}`));

describe("the app's alias domain", () => {
	it.each(["/auth/login?redirect=%2Fdashboard", "/dashboard", "/builder/abc", "/agent/new"])(
		"moves %s to the app's own address for good",
		(path) => {
			const response = visit(path);
			expect(response?.status).toBe(301);
			expect(response?.headers.get("Location")).toBe(`https://rezumi.app${path}`);
		},
	);

	it.each(["/", "/tess", "/tess/game-dev", "/resume-templates", "/api/rpc/flags/get", "/authors"])(
		"serves %s itself",
		(path) => {
			expect(visit(path)).toBeNull();
		},
	);

	it("keeps a path that looks like another host on the app's own address", () => {
		expect(onAppDomain(new URL("https://rx.cv//evil.example/login?next=1"))).toBe(
			"https://rezumi.app//evil.example/login?next=1",
		);
	});
});
