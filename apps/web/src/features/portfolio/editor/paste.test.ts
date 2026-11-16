import { describe, expect, it } from "vite-plus/test";
import { pasteIntent } from "./paste";

const picture = new File(["x"], "shot.png", { type: "image/png" });

describe("pasteIntent", () => {
	it("takes files pasted on their own", () => {
		expect(pasteIntent({ files: [picture], text: "", emptyLine: false })).toEqual({ kind: "files", files: [picture] });
	});

	it("keeps text that came with a picture of it, as Word and Excel paste", () => {
		expect(pasteIntent({ files: [picture], text: "Q3 results", emptyLine: true })).toEqual({ kind: "text" });
	});

	it("takes a lone address only on an empty line", () => {
		const url = "https://www.youtube.com/watch?v=abc";
		expect(pasteIntent({ files: [], text: `  ${url}\n`, emptyLine: true })).toEqual({ kind: "url", url });
		expect(pasteIntent({ files: [], text: url, emptyLine: false })).toEqual({ kind: "text" });
	});

	it("leaves sentences and other text alone", () => {
		expect(pasteIntent({ files: [], text: "see https://example.com", emptyLine: true })).toEqual({ kind: "text" });
		expect(pasteIntent({ files: [], text: "example.com", emptyLine: true })).toEqual({ kind: "text" });
		expect(pasteIntent({ files: [], text: "", emptyLine: true })).toEqual({ kind: "text" });
	});
});
