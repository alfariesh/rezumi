import { describe, expect, it } from "vite-plus/test";
import { anchorHeadings, blockText, plainText, readingMinutes, slugifyHeading } from "./portable-text";

const block = (text: string, style = "normal") => ({
	_type: "block",
	_key: text,
	style,
	children: [{ _type: "span", text }],
});

describe("plain text", () => {
	it("joins a block's spans and skips non-text blocks", () => {
		const body = [
			{
				_type: "block",
				style: "normal",
				children: [
					{ _type: "span", text: "Hello " },
					{ _type: "span", text: "there" },
				],
			},
			{ _type: "image", asset: { _ref: "x" } },
			block("Second"),
		];
		expect(blockText(body[0])).toBe("Hello there");
		expect(plainText(body)).toBe("Hello there\nSecond");
		expect(plainText(undefined)).toBe("");
	});

	it("estimates reading time, never below a minute", () => {
		expect(readingMinutes([])).toBe(1);
		expect(readingMinutes([block(Array.from({ length: 660 }, () => "word").join(" "))])).toBe(3);
	});
});

describe("heading anchors", () => {
	it("slugifies text to ASCII words", () => {
		expect(slugifyHeading("What a useful check measures")).toBe("what-a-useful-check-measures");
		expect(slugifyHeading("Café & CV: résumé!")).toBe("cafe-cv-resume");
	});

	it("anchors h2 and h3 blocks with unique ids and leaves the rest untouched", () => {
		const body = [
			block("Intro"),
			block("Skills", "h2"),
			block("Skills", "h2"),
			block("Skills 2", "h3"),
			block("", "h2"),
		];
		const { headings, blocks } = anchorHeadings(body);
		expect(headings).toEqual([
			{ id: "skills", text: "Skills", level: 2 },
			{ id: "skills-2", text: "Skills", level: 2 },
			{ id: "skills-2-2", text: "Skills 2", level: 3 },
			{ id: "section", text: "", level: 2 },
		]);
		expect(blocks[0]).toBe(body[0]);
		expect(blocks[1]).toMatchObject({ anchor: "skills", style: "h2" });
		expect(body[1]).not.toHaveProperty("anchor");
	});
});
