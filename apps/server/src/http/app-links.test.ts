import { describe, expect, it, vi } from "vite-plus/test";
import { handleAppleAppSiteAssociation } from "./app-links";

vi.mock("@rezumi/env/server", () => ({
	env: { MOBILE_IOS_APP_IDS: ["ZAVWN3Z2YX.app.rezumi"], MOBILE_ANDROID_PACKAGES: [], MOBILE_ANDROID_CERT_SHA256: [] },
}));

/** iOS applies the first pattern that matches a path, so a page opens the app only above the NOT rules. */
function opensApp(paths: string[], path: string) {
	for (const pattern of paths) {
		const negated = pattern.startsWith("NOT ");
		const glob = negated ? pattern.slice(4) : pattern;
		const regex = new RegExp(`^${glob.replaceAll(/[.+?^${}()|[\]\\]/g, "\\$&").replaceAll("*", ".*")}$`);
		if (regex.test(path)) return !negated;
	}
	return false;
}

describe("apple-app-site-association", () => {
	it("opens the app for pages with an app screen and leaves billing and admin to the web", async () => {
		const body = (await handleAppleAppSiteAssociation().json()) as {
			applinks: { details: { appID: string; paths: string[] }[] };
		};
		const paths = body.applinks.details[0]?.paths ?? [];
		for (const path of [
			"/auth/native-callback",
			"/builder/abc",
			"/dashboard",
			"/dashboard/career",
			"/dashboard/documents",
			"/dashboard/applications/app_1/prepare",
			"/dashboard/profile/facts",
			"/dashboard/portfolio",
			"/dashboard/settings/preferences",
		])
			expect(opensApp(paths, path), path).toBe(true);
		for (const path of [
			"/dashboard/settings/billing",
			"/dashboard/settings/billing/success",
			"/dashboard/admin/costs",
			"/api/health",
			"/auth/login",
			"/someone/resume",
		])
			expect(opensApp(paths, path), path).toBe(false);
	});
});
