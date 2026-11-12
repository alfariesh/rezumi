import { describe, expect, it } from "vite-plus/test";
import { typewriterPhrases } from "./editor";

describe("typewriterPhrases", () => {
	it("types the headline first, then at most two roles, trimmed, without blanks or repeats", () => {
		expect(typewriterPhrases(" Designer ", ["Designer", " ", "Mentor", "Mentor", "Writer", "Speaker"])).toEqual([
			"Designer",
			"Mentor",
			"Writer",
		]);
	});

	it("still caps the roles without a headline, so the page and the editor agree on what plays", () => {
		expect(typewriterPhrases("", ["A", "B", "C"])).toEqual(["A", "B"]);
		expect(typewriterPhrases("Designer", [])).toEqual(["Designer"]);
	});
});
