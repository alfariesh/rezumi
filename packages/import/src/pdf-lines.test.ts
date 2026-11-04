import type { RawExtraction, RawTextItem } from "@rezumi/resume/ats-pdf";
import { describe, expect, it } from "vite-plus/test";
import { buildExtractedDocument } from "@rezumi/resume/ats-pdf";
import { documentToLines } from "./pdf-lines";

const PAGE_HEIGHT = 842;
const BASELINE = PAGE_HEIGHT - 70;

/** A text item at `x` on one baseline, 10 pt, 5 pt per character. */
const item = (str: string, x: number, fontRef = "f1"): RawTextItem => ({
	str,
	transform: [10, 0, 0, 10, x, BASELINE],
	width: str.trim() ? str.length * 5 : 2.3,
	height: 10,
	fontRef,
	hasEol: false,
});

const page = (items: RawTextItem[]): RawExtraction => ({
	version: 1,
	file: { name: "resume.pdf", sizeBytes: 1000, magicBytesOk: true },
	pageCount: 1,
	truncated: false,
	pages: [{ pageNumber: 1, width: 595, height: PAGE_HEIGHT, rotation: 0, items, operators: null }],
	fonts: [],
	links: [],
	metadata: {
		producer: null,
		creator: null,
		title: null,
		author: null,
		language: null,
		pdfVersion: null,
		isEncrypted: false,
		isXfa: false,
		isCollection: false,
		isTagged: false,
		hasAcroForm: false,
	},
	operatorsAvailable: false,
});

describe("documentToLines", () => {
	// A bold lead-in ends at 196; the regular text starts 2.3 pt later, after the reader's space item.
	const bold = item("with professional experience", 56, "bold");
	const regular = item("creating games", 198.3);

	it("keeps the space between a bold lead-in and the regular text", () => {
		const lines = documentToLines(buildExtractedDocument(page([bold, item(" ", 196), regular])));
		expect(lines).toEqual(["with professional experience creating games"]);
	});

	it("reads the same narrow gap without a space item as no word break", () => {
		const lines = documentToLines(buildExtractedDocument(page([bold, regular])));
		expect(lines).toEqual(["with professional experiencecreating games"]);
	});
});
