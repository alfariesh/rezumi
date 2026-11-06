import { describe, expect, it } from "vite-plus/test";
import { escapeXml, renderRss } from "./rss";

describe("renderRss", () => {
	const channel = {
		title: "Rezumi Blog",
		description: "Advice & guides",
		link: "https://blog.rezumi.app/",
		self: "https://blog.rezumi.app/rss.xml",
		language: "en",
	};

	it("escapes text and dates the feed by its newest item", () => {
		const xml = renderRss({
			...channel,
			items: [
				{
					title: "Résumé <tips> & “quotes”",
					url: "https://blog.rezumi.app/a?b=1&c=2",
					description: "Don't",
					publishedAt: new Date("2026-11-01T00:00:00Z"),
					categories: ["Resume tips"],
				},
				{
					title: "Newer",
					url: "https://blog.rezumi.app/newer",
					description: "",
					publishedAt: new Date("2026-11-04T00:00:00Z"),
				},
			],
		});
		expect(xml).toContain("<title>Résumé &lt;tips&gt; &amp; “quotes”</title>");
		expect(xml).toContain("<link>https://blog.rezumi.app/a?b=1&amp;c=2</link>");
		expect(xml).toContain("<description>Don&apos;t</description>");
		expect(xml).toContain("<category>Resume tips</category>");
		expect(xml).toContain("<lastBuildDate>Wed, 04 Nov 2026 00:00:00 GMT</lastBuildDate>");
		expect(xml).toContain('<atom:link href="https://blog.rezumi.app/rss.xml" rel="self"');
	});

	it("omits lastBuildDate without items", () => {
		expect(renderRss({ ...channel, items: [] })).not.toContain("lastBuildDate");
	});

	it("escapes every XML special character", () => {
		expect(escapeXml(`<a href="x">'&'</a>`)).toBe("&lt;a href=&quot;x&quot;&gt;&apos;&amp;&apos;&lt;/a&gt;");
	});
});
