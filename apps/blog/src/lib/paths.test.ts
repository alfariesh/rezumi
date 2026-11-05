import { describe, expect, it } from "vite-plus/test";
import { absoluteUrl, categoryPath, feedPath, homePath, localeFromPath, postPath, searchPath, tagPath } from "./paths";

describe("paths", () => {
	it("keeps the default locale unprefixed", () => {
		expect(homePath("en")).toBe("/");
		expect(postPath("en", "tailor-your-resume")).toBe("/tailor-your-resume");
		expect(categoryPath("en", "resume-tips")).toBe("/category/resume-tips");
		expect(tagPath("en", "ats")).toBe("/tag/ats");
		expect(searchPath("en")).toBe("/search");
		expect(feedPath("en")).toBe("/rss.xml");
	});

	it("prefixes other locales without a trailing slash", () => {
		expect(homePath("id")).toBe("/id");
		expect(postPath("id", "sesuaikan-cv")).toBe("/id/sesuaikan-cv");
		expect(categoryPath("id", "tips-cv")).toBe("/id/category/tips-cv");
		expect(feedPath("id")).toBe("/id/rss.xml");
	});

	it("encodes slugs", () => {
		expect(postPath("en", "a b/c")).toBe("/a%20b%2Fc");
	});

	it("builds absolute URLs on the public origin", () => {
		expect(absoluteUrl("/")).toBe("https://blog.rezumi.app/");
		expect(absoluteUrl("/id/tips")).toBe("https://blog.rezumi.app/id/tips");
	});

	it("reads the locale from a path's first segment", () => {
		expect(localeFromPath("/id/missing")).toBe("id");
		expect(localeFromPath("/id")).toBe("id");
		expect(localeFromPath("/idea")).toBe("en");
		expect(localeFromPath("/")).toBe("en");
	});
});
