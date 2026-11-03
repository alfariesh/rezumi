import { describe, expect, it } from "vite-plus/test";
import { atsReviewSystemPrompt } from "@rezumi/ai/prompts";
import { atsReviewOutputSchema } from "./ats-review";

describe("atsReviewOutputSchema", () => {
	it("keeps the good entries when one is malformed", () => {
		const parsed = atsReviewOutputSchema.parse({
			summary: "Reads clearly.",
			suggestions: [
				{ section: null, issue: "Vague bullet.", rewrite: null, impact: "shouty" },
				{ section: null, issue: "", rewrite: null, impact: "low" },
			],
			strengths: ["Good", ""],
			jdAlignment: { verdict: "Close fit.", missingConcepts: ["kubernetes"], strengths: [] },
		});

		expect(parsed.suggestions).toHaveLength(1);
		expect(parsed.suggestions[0]?.impact).toBe("medium");
		expect(parsed.strengths).toEqual(["Good"]);
		expect(parsed.jdAlignment?.missingConcepts).toEqual(["kubernetes"]);
	});
});

describe("atsReviewSystemPrompt", () => {
	// Without it, reviews of Indonesian resumes came back in English (Rezumi AI benchmark, 2026-11-03).
	it("asks for the whole review in the resume's language", () => {
		expect(atsReviewSystemPrompt).toContain("Write in the resume's language.");
	});
});
