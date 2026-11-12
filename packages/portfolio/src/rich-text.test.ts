import { describe, expect, it } from "vite-plus/test";
import { parseWritablePortfolioData } from "@rezumi/schema/portfolio/data";
import { richTextLength } from "@rezumi/schema/portfolio/limits";
import { renderPortfolioHtml, sanitizePortfolioData, sanitizePortfolioHtml } from "./rich-text";

describe("sanitizePortfolioHtml", () => {
	it("keeps the formats the editor offers", () => {
		const html =
			'<h2>Problem</h2><p><strong>Bold</strong>, <em>italic</em>, <u>under</u>, <s>gone</s> and <a href="https://example.com">a link</a>.</p><ul><li>One</li></ul><ol start="3"><li>Three</li></ol><blockquote><p>Quote</p></blockquote><h3>Small</h3>';
		expect(sanitizePortfolioHtml(html)).toBe(html);
	});

	it("removes scripts, event handlers and javascript: links", () => {
		expect(sanitizePortfolioHtml('<p>Hi<script>alert("x")</script></p>')).toBe("<p>Hi</p>");
		expect(sanitizePortfolioHtml('<p onclick="steal()">Hi</p><img src="x" onerror="alert(1)">')).toBe("<p>Hi</p>");
		expect(sanitizePortfolioHtml('<a href="javascript:alert(1)">click</a>')).toBe("<a>click</a>");
		expect(sanitizePortfolioHtml('<a href="JaVaScRiPt:alert(1)">x</a>')).toBe("<a>x</a>");
		expect(sanitizePortfolioHtml('<a href="data:text/html,hi">x</a>')).toBe("<a>x</a>");
		expect(sanitizePortfolioHtml('<a href="//evil.example">x</a>')).toBe("<a>x</a>");
		expect(sanitizePortfolioHtml('<iframe src="https://evil.example"></iframe><p>ok</p>')).toBe("<p>ok</p>");
		expect(sanitizePortfolioHtml("<svg><script>alert(1)</script></svg><style>p{}</style>")).toBe("");
	});

	it("drops styles, classes and unsupported tags but keeps their text", () => {
		expect(
			sanitizePortfolioHtml(
				'<p style="color:red" class="x"><span style="background:url(evil)">Kept</span> <mark>text</mark></p><table><tr><td>cell</td></tr></table>',
			),
		).toBe("<p>Kept text</p>cell");
	});

	it("maps other spellings of the same formats", () => {
		expect(sanitizePortfolioHtml("<b>B</b><i>I</i><strike>S</strike><h1>Big</h1><h5>Tiny</h5><div>Block</div>")).toBe(
			"<strong>B</strong><em>I</em><s>S</s><h2>Big</h2><h3>Tiny</h3><p>Block</p>",
		);
	});

	it("keeps text that only looks like a tag, which the length limit counts as text too", () => {
		for (const html of ["<p><1 abc> x</p>", "<p>< p>x</p>", "<p>a <= b</p>", "<p><Ä>x <_y> z<</p>"]) {
			const clean = sanitizePortfolioHtml(html);
			expect(clean).toContain("&lt;");
			expect(richTextLength(html)).toBe(richTextLength(clean));
		}
	});

	it("drops what the parser reads as raw text, so markup there can't turn into text", () => {
		expect(sanitizePortfolioHtml("<title><b>x</b></title><p>a</p><xmp><b>y</b></xmp><p>b</p>")).toBe(
			"<p>a</p><p>b</p>",
		);
		expect(sanitizePortfolioHtml("<noembed><b>x</b></noembed><noframes>y</noframes><p>a</p>")).toBe("<p>a</p>");
		expect(sanitizePortfolioHtml("<p>a</p><plaintext><b>x</b><p>b</p>")).toBe("<p>a</p>");
	});

	it("never shows more text than the length limit counted", () => {
		for (const html of [
			`<p>${"<1 a>".repeat(20)}</p>`,
			`<title>${"<b>x</b>".repeat(20)}</title>`,
			`<p>${"&zz;".repeat(20)} &AMP; &NBSP; &#233; &#x1F600;</p>`,
			'<p><a href="https://example.com/?a>b">link</a></p>',
		])
			expect(richTextLength(html)).toBeGreaterThanOrEqual(richTextLength(sanitizePortfolioHtml(html)));
	});
});

describe("renderPortfolioHtml", () => {
	it("opens outside links in a new tab as user content, and keeps mail and in-page links where they are", () => {
		expect(renderPortfolioHtml('<p><a href="https://example.com">x</a></p>')).toBe(
			'<p><a href="https://example.com" rel="ugc nofollow noopener noreferrer" target="_blank">x</a></p>',
		);
		expect(renderPortfolioHtml('<a href="MAILTO:me@example.com">m</a>')).toBe('<a href="MAILTO:me@example.com">m</a>');
		expect(renderPortfolioHtml('<a href="#contact">c</a>')).toBe('<a href="#contact">c</a>');
	});

	it("never turns a link without a safe address into a link to the page itself", () => {
		expect(renderPortfolioHtml("<a>x</a>")).toBe("<a>x</a>");
		expect(renderPortfolioHtml('<a href="  ">x</a>')).toBe("<a>x</a>");
		expect(renderPortfolioHtml('<a href="javascript:alert(1)" target="_self" rel="opener">x</a>')).toBe(
			'<a rel="ugc nofollow noopener noreferrer" target="_blank">x</a>',
		);
		expect(renderPortfolioHtml('<a href="https://example.com" onclick="x()" style="color:red">x</a>')).not.toMatch(
			/onclick|style/,
		);
	});
});

describe("sanitizePortfolioData", () => {
	it("cleans every rich-text field and leaves the input alone", () => {
		const dirty = '<p>Ok<script>x()</script></p><img src=x onerror="alert(1)">';
		const data = parseWritablePortfolioData({
			about: { content: dirty },
			works: { items: [{ id: "w", slug: "w", blocks: [{ id: "t", type: "text", html: dirty }] }] },
			custom: [{ id: "c", title: "Principles", content: dirty }],
		});
		const clean = sanitizePortfolioData(data);
		expect(clean.about.content).toBe("<p>Ok</p>");
		expect(clean.works.items[0]?.blocks[0]).toMatchObject({ html: "<p>Ok</p>" });
		expect(clean.custom[0]?.content).toBe("<p>Ok</p>");
		expect(data.about.content).toBe(dirty);
	});
});
