// The deep-link map of plans/mobile 02-teknis 7: every web page with an app screen opens it; pages without one yet
// land on the tab that will hold them; anything else is left to the browser.
import { parseDeepLink } from "./parse";
import { DEFAULT_SERVER } from "@/auth/session";

const web = (path: string) => parseDeepLink(`${DEFAULT_SERVER}${path}`, DEFAULT_SERVER);
const href = (path: string) => {
	const link = web(path);
	return link?.kind === "target" ? link.href : null;
};

describe("parseDeepLink: web pages to app screens", () => {
	it.each([
		["/dashboard", "/home"],
		["/dashboard/", "/home"],
		["/dashboard/career", "/home"],
		["/dashboard?schedule=sch_123", "/home?schedule=sch_123"],
		["/dashboard/career?schedule=interview-preparation", "/home?schedule=interview-preparation"],
		["/dashboard?schedule=new:discovery", "/home?schedule=new%3Adiscovery"],
		["/dashboard/documents", "/documents"],
		["/dashboard/documents?type=resume&q=design", "/documents"],
		["/dashboard/resumes", "/documents"],
		["/dashboard/cover-letters", "/documents"],
		["/dashboard/trash", "/documents/trash"],
		["/builder/abc", "/builder/abc/write"],
		["/builder/abc?mode=design", "/builder/abc/design"],
		["/builder/letter/xyz", "/letter/xyz/write"],
		["/builder/portfolio", "/portfolio"],
		["/builder/portfolio?mode=design", "/portfolio"],
		["/dashboard/portfolio", "/portfolio"],
		["/dashboard/profile", "/profile"],
		["/dashboard/profile/stories/st_1", "/profile"],
		["/dashboard/career/knowledge/facts", "/profile"],
		["/dashboard/applications", "/applications"],
		["/dashboard/applications/app_1", "/applications/app_1/fit"],
		["/dashboard/applications/app_1/prepare", "/applications/app_1/prepare"],
		["/dashboard/applications/app_1/messages", "/applications/app_1/messages"],
		["/dashboard/applications/jobs", "/applications"],
		["/dashboard/jobs", "/applications"],
		["/dashboard/applications/offers", "/applications/offers"],
		["/dashboard/career/offers", "/applications/offers"],
		["/dashboard/coach", "/coach"],
		["/dashboard/coach/conv_1", "/coach"],
		["/dashboard/career/coach", "/coach"],
		["/dashboard/career/coach/conv_1", "/coach"],
		["/dashboard/settings", "/account"],
		["/dashboard/settings/account", "/account/account"],
		["/dashboard/settings/profile", "/account/account"],
		["/dashboard/settings/preferences", "/account/preferences"],
		["/dashboard/settings/app", "/account/preferences"],
		["/dashboard/settings/ai", "/account/ai"],
		["/dashboard/settings/api-keys", "/account/ai"],
		["/dashboard/settings/billing", "/account"],
	])("%s opens %s", (path, expected) => {
		expect(href(path)).toBe(expected);
	});

	it.each([
		"/dashboard/admin",
		"/dashboard/admin/costs",
		"/dashboard/applications/app_1/unknown-tab",
		"/dashboard/applications/app_1/prepare/extra",
		"/dashboard/documents/extra",
		"/dashboard/settings/unknown",
		"/dashboard/somewhere",
	])("%s is left to the browser", (path) => {
		expect(web(path)).toBeNull();
	});

	it("drops a malformed schedule id instead of forwarding it", () => {
		expect(href("/dashboard?schedule=a%20b")).toBe("/home");
		expect(href(`/dashboard?schedule=${"x".repeat(200)}`)).toBe("/home");
	});

	it("maps the in-app paths that notifications carry", () => {
		expect(parseDeepLink("/dashboard/applications/app_1/prepare", DEFAULT_SERVER)).toEqual({
			kind: "target",
			server: null,
			href: "/applications/app_1/prepare",
		});
		expect(parseDeepLink("/dashboard/career?schedule=sch_1", DEFAULT_SERVER)).toMatchObject({
			href: "/home?schedule=sch_1",
		});
	});

	it("keeps the app's own tab names out of public resume links", () => {
		for (const name of ["home", "portfolio", "profile", "account", "coach"])
			expect(parseDeepLink(`app.rezumi://${name}/anything`, DEFAULT_SERVER)).toBeNull();
		expect(href("/someone/resume")).toBe("/r/someone/resume");
	});
});
