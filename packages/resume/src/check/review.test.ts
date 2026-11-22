import type { Passage } from "../proposals";
import { describe, expect, it } from "vite-plus/test";
import { mapWritingReview } from "./review";

const passage: Passage = {
	id: "p1",
	target: { sectionId: "experience", itemId: "kettle", field: "description" },
	location: "Experience · Studio Kettle · bullet 1",
	html: "<li>Made logos.</li>",
	text: "Made logos.",
} as Passage;

describe("mapWritingReview", () => {
	it("turns a rewrite of a sent passage into a proposal and keeps the rest as notes", () => {
		const { proposals, notes } = mapWritingReview(
			[
				{
					section: null,
					passageId: "p1",
					issue: "Say the result.",
					rewrite: "Designed 40 identities.",
					impact: "high",
				},
				{ section: "Summary", passageId: null, issue: "Too long.", rewrite: null, impact: "low" },
				{ section: null, passageId: "p1", issue: "Same text.", rewrite: "Made logos.", impact: "medium" },
			],
			[passage],
		);
		expect(proposals).toEqual([
			expect.objectContaining({ id: "w1", before: "<li>Made logos.</li>", after: "<li>Designed 40 identities.</li>" }),
		]);
		expect(notes).toEqual([
			{ location: "Summary", impact: "low", quote: "", note: "Too long.", target: null },
			{
				location: passage.location,
				impact: "medium",
				quote: "Made logos.",
				note: "Same text.",
				target: { kind: "item", sectionId: "experience", itemId: "kettle" },
			},
		]);
	});
});
