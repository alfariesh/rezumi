import { describe, expect, it } from "vite-plus/test";
import { isProposeEdits, skippedCount, toProposals } from "./assistant-proposals";

describe("assistant proposals", () => {
	it("keeps IDs and targets, uses the latest status, and resolves locations against the editor", () => {
		const part = {
			type: "tool-propose_edits",
			state: "output-available",
			output: {
				edits: [
					{
						id: "edit",
						target: { sectionId: "experience", field: "description", itemId: "item", roleId: "role" },
						before: "<p>Before</p>",
						after: "<p>After</p>",
						location: "Old section title",
						status: "pending",
					},
				],
				skipped: [{}],
			},
		};
		expect(isProposeEdits(part)).toBe(true);
		expect(toProposals(part, new Map([["edit", "rejected"]]), (proposal) => proposal.target.field)).toEqual([
			expect.objectContaining({
				id: "edit",
				target: part.output.edits[0]?.target,
				location: "description",
				status: "rejected",
				source: "assistant",
			}),
		]);
		expect(skippedCount(part)).toBe(1);
	});

	it("does not treat a partial or failed tool call as a proposal", () => {
		expect(isProposeEdits({ type: "tool-propose_edits", state: "input-streaming" })).toBe(false);
		expect(isProposeEdits({ type: "tool-propose_edits", state: "output-error" })).toBe(false);
		expect(toProposals({ type: "tool-propose_edits" }, new Map())).toEqual([]);
	});
});
