import { describe, expect, it } from "vite-plus/test";
import { publicResumeProxyPattern } from "./dev-server-proxy";

const pattern = new RegExp(publicResumeProxyPattern);

describe("public resume dev proxy", () => {
	it.each([
		"/",
		"/?locale=ar-SA",
		"/resume-templates?locale=id-ID",
		"/ats-checker?locale=en-US",
		"/auth/login?plan=plus",
		"/dashboard",
		"/src/main.tsx",
		"/.well-known/app.json",
		"/dashboard/settings/app",
		"/docs/guides/creating-a-portfolio",
		"/builder/portfolio/x",
		"/agent/abc/new",
		"/cards/tess/work/kopi.png",
		"/tess/other/kopi",
	])("keeps app and asset URL %s on Vite", (path) => expect(pattern.test(path)).toBe(false));

	it.each([
		"/tess",
		"/tess/",
		"/tess?locale=ar-SA",
		"/tess/game-dev",
		"/tess/game-dev?utm_source=portfolio",
		"/tess/work/kopi-senja",
		"/tess/work/kopi-senja?utm_source=qr",
	])("proxies public resume URL %s to the server", (path) => expect(pattern.test(path)).toBe(true));
});
