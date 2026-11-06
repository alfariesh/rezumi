import { describe, expect, it } from "vite-plus/test";
import { decodePage, parseLinkMeta } from "./link-meta";

// Shaped like the pages people paste (a repository, a design case study); fictional content, no network.
const repositoryPage = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>GitHub - nadia/kopi-app: Coffee ordering for small cafés</title>
  <meta name="description" content="Coffee ordering for small cafés. Contribute to nadia/kopi-app on GitHub.">
  <meta property="og:image" content="https://opengraph.example.test/nadia/kopi-app">
  <meta property="og:site_name" content="GitHub">
  <meta property="og:type" content="object">
  <meta property="og:title" content="nadia/kopi-app: Coffee ordering for small cafés">
  <meta property="og:url" content="https://github.example.test/nadia/kopi-app">
  <meta property="og:description" content="Coffee ordering for small cafés. Contribute to nadia/kopi-app on GitHub.">
  <script>document.write('<meta property="og:title" content="from a script">')</script>
</head>
<body><svg><title>An icon</title></svg></body>
</html>`;

const caseStudyPage = `<html><head>
<meta content="Rebranding Kopi Senja &amp; friends &#8212; a café identity" property='og:title' />
<meta name=twitter:description content="Logo, packaging &amp; menu for a Bandung café&hellip;">
<meta property="og:image" content="/assets/cover.jpg?w=1400&amp;h=1050">
<!-- <meta property="og:site_name" content="commented out"> -->
<meta property="og:site_name" content="Behance">
</head><body></body></html>`;

describe("parseLinkMeta", () => {
	it("prefers Open Graph over the title and description tags", () => {
		expect(parseLinkMeta(repositoryPage, "https://github.example.test/nadia/kopi-app")).toEqual({
			title: "nadia/kopi-app: Coffee ordering for small cafés",
			description: "Coffee ordering for small cafés. Contribute to nadia/kopi-app on GitHub.",
			siteName: "GitHub",
			image: "https://opengraph.example.test/nadia/kopi-app",
		});
	});

	it("reads any attribute order and quoting, decodes entities and resolves relative pictures", () => {
		expect(parseLinkMeta(caseStudyPage, "https://www.behance.example.test/gallery/123/kopi")).toEqual({
			title: "Rebranding Kopi Senja & friends — a café identity",
			description: "Logo, packaging & menu for a Bandung café…",
			siteName: "Behance",
			image: "https://www.behance.example.test/assets/cover.jpg?w=1400&h=1050",
		});
	});

	it("falls back to the page's own title and description, never a title inside the body", () => {
		const html = `<head><title>
			Studio   Senja | Portfolio
		</title><meta name="description" content="  Photos of food and people.  "></head><body><svg><title>x</title></svg>`;
		expect(parseLinkMeta(html, "https://senja.example.test/")).toEqual({
			title: "Studio Senja | Portfolio",
			description: "Photos of food and people.",
		});
		expect(parseLinkMeta("<body><svg><title>Only icon</title></svg></body>", "https://a.example.test/")).toEqual({});
	});

	it("ignores tags inside scripts, styles and comments", () => {
		const html = `<head><script>var s = '<meta property="og:title" content="Injected">';</script>
			<style>/* <meta name="description" content="styled"> */</style>
			<!-- <title>Hidden</title> --><title>Real</title></head>`;
		expect(parseLinkMeta(html, "https://a.example.test/")).toEqual({ title: "Real" });
	});

	it("uses Twitter cards when Open Graph is missing, and only http(s) pictures", () => {
		const html = `<meta name="twitter:title" content="Card title"><meta name="twitter:image" content="data:image/png;base64,AAAA">
			<meta name="twitter:image:src" content="javascript:alert(1)">`;
		expect(parseLinkMeta(html, "https://a.example.test/")).toEqual({ title: "Card title" });
		const relative = `<meta property="og:image" content="//cdn.example.test/p.png">`;
		expect(parseLinkMeta(relative, "https://a.example.test/x").image).toBe("https://cdn.example.test/p.png");
	});

	it("shortens long text to what a link card holds and drops tags and control characters", () => {
		const long = "Word ".repeat(200);
		const meta = parseLinkMeta(
			`<meta property="og:title" content="${long}"><meta property="og:description" content="${long}"><meta property="og:site_name" content="${long}">`,
			"https://a.example.test/",
		);
		expect(meta.title?.length).toBeLessThanOrEqual(140);
		expect(meta.title?.endsWith("…")).toBe(true);
		expect(meta.description?.length).toBeLessThanOrEqual(300);
		expect(meta.siteName?.length).toBeLessThanOrEqual(60);
		expect(parseLinkMeta("<title>A <b>bold</b>\u0007 title</title>", "https://a.example.test/").title).toBe(
			"A bold title",
		);
	});

	it("returns nothing for a page without any of it", () => {
		expect(parseLinkMeta("<html><body><p>Hello</p></body></html>", "https://a.example.test/")).toEqual({});
		expect(parseLinkMeta("", "https://a.example.test/")).toEqual({});
	});

	it("reads a page cut off in the middle", () => {
		const cut = `${repositoryPage.slice(0, repositoryPage.indexOf("<script>"))}<script>var a = "`;
		expect(parseLinkMeta(cut, "https://github.example.test/").title).toBe(
			"nadia/kopi-app: Coffee ordering for small cafés",
		);
	});
});

describe("decodePage", () => {
	it("uses the charset from the header, then the page, then UTF-8", () => {
		const latin = new Uint8Array([
			...new TextEncoder().encode("<title>Caf"),
			0xe9,
			...new TextEncoder().encode("</title>"),
		]);
		expect(decodePage(latin, "text/html; charset=ISO-8859-1")).toBe("<title>Café</title>");
		const declared = new Uint8Array([...new TextEncoder().encode('<meta charset="windows-1252"><title>Caf'), 0xe9]);
		expect(decodePage(declared, "text/html")).toContain("Café");
		expect(decodePage(new TextEncoder().encode("<title>Kopi ☕</title>"), null)).toBe("<title>Kopi ☕</title>");
		expect(decodePage(new TextEncoder().encode("ok"), "text/html; charset=made-up")).toBe("ok");
	});
});
