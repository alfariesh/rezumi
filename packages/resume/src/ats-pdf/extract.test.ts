import { describe, expect, it } from "vite-plus/test";
import fc from "fast-check";
import { buildExtractedDocument } from "./extract";
import { healthyResume, healthyResumeLines, makeRawExtraction } from "./test-fixtures";

describe("buildExtractedDocument", () => {
	it.each([1e12, Number.POSITIVE_INFINITY, Number.NaN])(
		"does not allocate a width-sized histogram for invalid geometry %s",
		(width) => {
			const raw = healthyResume({ pages: { 1: { width } } });
			expect(() => buildExtractedDocument(raw)).not.toThrow();
		},
	);

	it("clusters spans on the same baseline into one line, in left-to-right order", () => {
		const raw = makeRawExtraction({
			lines: [
				{ text: "Principal Engineer", x: 56, y: 60 },
				{ text: "Jan 2020 - Present", x: 400, y: 60 },
			],
		});

		const [line] = buildExtractedDocument(raw).lines;

		expect(line?.text).toBe("Principal Engineer Jan 2020 - Present");
		expect(line?.spans).toHaveLength(2);
	});

	/**
	 * A bold lead-in followed by regular text comes out as two runs with the reader's space item between them. That
	 * space is narrower than the gap that alone reads as a word break (here 0.23 em), so dropping it with the other
	 * blank items ran the two words together ("experiencecreating").
	 */
	it("keeps the space the reader emitted between two runs", () => {
		const bold = { text: "with professional experience", x: 56, y: 60, fontRef: "g_d0_f2" };
		const raw = makeRawExtraction({
			// 28 characters at 5 pt each end the bold run at 196; the space item fills 196–198.3.
			lines: [bold, { text: "creating engaging games", x: 198.3, y: 60 }],
			fonts: [{}, { name: "AAAAAA+Inter-Bold" }],
		});
		const page = raw.pages[0];
		const [first, second] = page?.items ?? [];
		if (!page || !first || !second) throw new Error("fixture");
		const space = { ...second, str: " ", width: 2.3, transform: [10, 0, 0, 10, 196, second.transform[5]] as const };
		const withSpace = { ...raw, pages: [{ ...page, items: [first, space, second] }] };

		expect(buildExtractedDocument(raw).lines[0]?.text).toBe("with professional experiencecreating engaging games");
		expect(buildExtractedDocument(withSpace).lines[0]?.text).toBe(
			"with professional experience creating engaging games",
		);
	});

	it("does not split runs that touch, even after a space item", () => {
		const raw = makeRawExtraction({
			lines: [
				{ text: "Kowal", x: 56, y: 60 },
				{ text: "ski", x: 81, y: 60 },
			],
		});
		const page = raw.pages[0];
		const [first, second] = page?.items ?? [];
		if (!page || !first || !second) throw new Error("fixture");
		const space = { ...second, str: " ", width: 0 };

		expect(buildExtractedDocument({ ...raw, pages: [{ ...page, items: [first, space, second] }] }).lines[0]?.text).toBe(
			"Kowalski",
		);
	});

	/**
	 * Geometry must not depend on the order the reader happened to emit items in. Stream order is
	 * measured separately, as inversion; everything else has to be a pure function of the page.
	 */
	it("derives the same lines however the content stream was ordered", () => {
		const baseline = buildExtractedDocument(healthyResume());
		const indices = [...healthyResumeLines.keys()];

		fc.assert(
			fc.property(fc.shuffledSubarray(indices, { minLength: indices.length }), (permutation) => {
				const shuffled = healthyResume({
					streamOrder: (lines) => permutation.map((index) => lines[index]).filter((line) => line !== undefined),
				});

				const document = buildExtractedDocument(shuffled);

				expect(document.fullText).toBe(baseline.fullText);
				expect(document.lines.map((line) => [line.x, line.y, line.width, line.height])).toEqual(
					baseline.lines.map((line) => [line.x, line.y, line.width, line.height]),
				);
			}),
			{ numRuns: 25 },
		);
	});
});
