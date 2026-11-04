import { describe, expect, it } from "vite-plus/test";
import { sampleResumeData } from "@rezumi/schema/resume/sample";
import { HOST } from "../forme/primitives";
import { toHtml } from "./to-html";
import { renderResumeWebPage } from "./web-page";

describe("renderResumeWebPage", () => {
	it("keeps text and style values from escaping into markup or the stylesheet", () => {
		const text = (value: string) => ({ type: "#text" as const, text: value });
		const tree = [
			{
				type: HOST.document,
				props: {},
				children: [
					{
						type: HOST.page,
						props: { style: {} },
						children: [
							{
								type: HOST.view,
								props: { style: { backgroundColor: "rgb(1,2,3);}body{background:red", width: "50%;}a{b:c" } },
								children: [
									{
										type: HOST.text,
										props: { style: { fontFamily: 'Inter"}i{color:red', color: "red;}x{y:z" } },
										children: [text('<img src=x onerror="alert(1)">')],
									},
									{ type: HOST.link, props: { src: "javascript:alert(1)" }, children: [text("link")] },
								],
							},
						],
					},
				],
			},
		];

		const { html, css } = toHtml(tree);

		expect(html).not.toMatch(/<img src=x|javascript:/);
		expect(html).toContain("&lt;img src=x onerror=");
		expect(css).not.toMatch(/\}(?:body|a|i|x)\{/);
	});

	it("puts the main column before the sidebar when the page folds on a phone", async () => {
		const data = structuredClone(sampleResumeData);
		data.metadata.template = "kirana";
		const { html, css } = await renderResumeWebPage({ data });

		expect(html).toMatch(/data-split[\s\S]*data-part="(?:header-sidebar|sidebar)"[\s\S]*data-part="main"/);
		expect(css).toMatch(/@media \(max-width:640px\)\{[\s\S]*\[data-part=main\]\{order:1\}/);
	});

	it("keeps a sidebar's colour behind the header it holds when the page folds on a phone", async () => {
		const data = structuredClone(sampleResumeData);
		data.metadata.template = "purnama";
		const { html, css } = await renderResumeWebPage({ data });

		// Purnama's light name sits in the dark sidebar: folded, the header must keep the band, not land on white.
		expect(html).toMatch(/class="rr-page[^"]*"[^>]* data-band/);
		expect(html).toMatch(/data-part="header-sidebar"[\s\S]*data-region="header"/);
		expect(css).toMatch(
			/\[data-band\] \[data-part=header-sidebar\]>\[data-region=header\]\{[^}]*background-color:var\(--rr-band\)/,
		);
	});

	it("lets a header band reach the screen's edges on a phone", async () => {
		const data = structuredClone(sampleResumeData);
		data.metadata.template = "horizon";
		const { html, css } = await renderResumeWebPage({ data });

		expect(html).toMatch(/data-region="header"[^>]* data-bleed/);
		expect(css).toMatch(/\[data-region=header\]\[data-bleed\]\{margin-top:-24px/);
	});

	it("makes the name the page's heading and section titles its subheadings", async () => {
		const data = structuredClone(sampleResumeData);
		const { html } = await renderResumeWebPage({ data });

		expect(html.match(/<h1[ >]/g)).toHaveLength(1);
		expect(html).toMatch(new RegExp(`<h1[^>]*>${data.basics.name}</h1>`));
		expect(html).toMatch(/<h2[ >]|role="heading" aria-level="2"/);
	});
});
