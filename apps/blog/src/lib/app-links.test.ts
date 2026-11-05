import { describe, expect, it } from "vite-plus/test";
import { appLink } from "./app-links";

describe("appLink", () => {
	it("tags links for attribution", () => {
		const url = new URL(appLink("register", { locale: "en", placement: "header", campaign: "ats-check" }));
		expect(url.origin + url.pathname).toBe("https://rezumi.app/auth/register");
		expect(Object.fromEntries(url.searchParams)).toEqual({
			utm_source: "blog",
			utm_medium: "referral",
			utm_campaign: "ats-check",
			utm_content: "header",
		});
	});

	it("opens the app in the reader's language", () => {
		const url = new URL(appLink("ats-checker", { locale: "id", placement: "article" }));
		expect(url.pathname).toBe("/ats-checker");
		expect(url.searchParams.get("locale")).toBe("id-ID");
		expect(url.searchParams.get("utm_campaign")).toBe("blog");
	});

	it("keeps a section anchor after the query", () => {
		const href = appLink("pricing", { locale: "en", placement: "footer" });
		expect(href).toMatch(/^https:\/\/rezumi\.app\/\?.+#pricing$/);
	});
});
