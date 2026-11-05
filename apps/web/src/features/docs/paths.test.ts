import { describe, expect, it } from "vite-plus/test";
import { docsPath, resolveDocsHref, resolveDocsSlug } from "./paths";

const routes = {
	slugs: new Set(["getting-started", "guides/editor-overview", "legal/kontak"]),
	redirects: { "guides/using-the-builder-dock": "guides/editor-overview", "guides/gone": "guides/missing" },
};

describe("docsPath", () => {
	it("puts the introduction at /docs and every other page under it", () => {
		expect(docsPath("getting-started")).toBe("/docs");
		expect(docsPath("guides/editor-overview")).toBe("/docs/guides/editor-overview");
	});
});

describe("resolveDocsSlug", () => {
	it("finds pages, follows redirects and ignores slashes", () => {
		expect(resolveDocsSlug("", routes)).toBe("getting-started");
		expect(resolveDocsSlug("/guides/editor-overview/", routes)).toBe("guides/editor-overview");
		expect(resolveDocsSlug("guides/using-the-builder-dock", routes)).toBe("guides/editor-overview");
	});

	it("returns undefined for unknown pages and redirects to them", () => {
		expect(resolveDocsSlug("guides/missing", routes)).toBeUndefined();
		expect(resolveDocsSlug("guides/gone", routes)).toBeUndefined();
	});
});

describe("resolveDocsHref", () => {
	it("moves docs pages under /docs and keeps the anchor", () => {
		expect(resolveDocsHref("/guides/editor-overview#modes", routes)).toEqual({
			href: "/docs/guides/editor-overview#modes",
			known: true,
		});
		expect(resolveDocsHref("https://docs.rezumi.app/legal/kontak", routes)).toEqual({
			href: "/docs/legal/kontak",
			known: true,
		});
		expect(resolveDocsHref("https://docs.rezumi.app", routes)).toEqual({ href: "/docs", known: true });
	});

	it("keeps links to the app on the current instance", () => {
		expect(resolveDocsHref("https://rezumi.app/auth/register", routes)).toEqual({
			href: "/auth/register",
			known: true,
		});
		expect(resolveDocsHref("https://rezumi.app", routes)).toEqual({ href: "/", known: true });
	});

	it("sends the API reference and unknown pages to the hosted docs", () => {
		expect(resolveDocsHref("/api-reference/resumes", routes)).toEqual({
			href: "https://docs.rezumi.app/api-reference/resumes",
			known: true,
		});
		expect(resolveDocsHref("/guides/missing", routes)).toEqual({
			href: "https://docs.rezumi.app/guides/missing",
			known: false,
		});
	});

	it("leaves anchors, other sites and mail links alone", () => {
		expect(resolveDocsHref("#steps", routes)).toBeUndefined();
		expect(resolveDocsHref("https://example.com/x", routes)).toBeUndefined();
		expect(resolveDocsHref("mailto:hi@rezumi.app", routes)).toBeUndefined();
		expect(resolveDocsHref("//cdn.example.com/x", routes)).toBeUndefined();
	});
});
