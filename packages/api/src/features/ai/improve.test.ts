import { describe, expect, it } from "vite-plus/test";
import { improveSystemPrompt } from "@rezumi/ai/prompts";
import { improveOutputSchema } from "./improve";

describe("improve", () => {
	it("flattens the line and treats an unclear addsFacts as needing a check", () => {
		expect(improveOutputSchema.parse({ text: " Launched\nthe app ", why: "Ownership.", addsFacts: "maybe" })).toEqual({
			text: "Launched the app",
			why: "Ownership.",
			addsFacts: true,
		});
		expect(() => improveOutputSchema.parse({ text: "  " })).toThrow();
	});
});

describe("improveSystemPrompt", () => {
	it("explains the change in the line's language", () => {
		expect(improveSystemPrompt).toContain("Write `why` in that language too.");
	});
});
