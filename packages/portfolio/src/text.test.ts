import { describe, expect, it } from "vite-plus/test";
import { cutText, htmlToText, truncateText } from "./text";

describe("htmlToText", () => {
	it("reads blocks as spaces and decodes entities", () => {
		expect(htmlToText("<h2>Kopi</h2><p>Fast &amp; calm&nbsp;ordering &#8212; &#x1F600;</p>")).toBe(
			"Kopi Fast & calm ordering — 😀",
		);
	});

	it("never makes half a character or reads a name it doesn't know", () => {
		const replacement = String.fromCodePoint(0xff_fd);
		expect(htmlToText("<p>&#55357; &#xDE00;</p>")).toBe(`${replacement} ${replacement}`);
		expect(htmlToText("<p>&constructor; &toString;</p>")).toBe("&constructor; &toString;");
	});
});

describe("cutText", () => {
	it("keeps the first characters up to the limit", () => {
		expect(cutText("Portfolio", 4)).toBe("Port");
		expect(cutText("Port", 10)).toBe("Port");
		expect(cutText("Port", 0)).toBe("");
	});

	it("never splits a character made of two UTF-16 units", () => {
		expect(cutText("ab😀", 3)).toBe("ab");
		expect(cutText("ab😀", 4)).toBe("ab😀");
		expect(cutText("😀".repeat(30), 41).isWellFormed()).toBe(true);
	});
});

describe("truncateText", () => {
	it("cuts at a word boundary when one is near and ends with an ellipsis", () => {
		expect(truncateText("Redesigned ordering for a coffee chain", 24)).toBe("Redesigned ordering…");
		expect(truncateText("Short", 24)).toBe("Short");
	});

	it("never splits a character made of two UTF-16 units", () => {
		// Titles without spaces (Japanese, Chinese) are cut exactly at the limit.
		const cut = truncateText(`${"日".repeat(98)}😀😀`, 100);
		expect(cut).toBe(`${"日".repeat(98)}…`);
		expect(cut.isWellFormed()).toBe(true);
	});
});
