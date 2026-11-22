import { describe, expect, it } from "vite-plus/test";
import { matchJobDescription, surfaceFormsOf } from "../ats-pdf";
import { matchPosting, newSkill, termAsWritten } from "./job-match";

describe("matchPosting", () => {
	const posting = "We want a designer fluent in Figma and TypeScript. Figma every day.";

	it("sorts terms into found and missing, as the posting writes them", () => {
		const result = matchPosting(
			{ matchJobDescription, surfaceFormsOf },
			{ posting, resumeText: "Designer working in Figma." },
		);
		expect(result.total).toBe(result.found.length + result.missing.length);
		expect(result.found.map((term) => term.label)).toContain("Figma");
		expect(result.missing.map((term) => term.term)).toContain("typescript");
	});

	it("leaves out hidden terms", () => {
		const result = matchPosting(
			{ matchJobDescription, surfaceFormsOf },
			{ posting, resumeText: "Designer working in Figma.", hiddenTerms: ["typescript"] },
		);
		expect(result.missing.map((term) => term.term)).not.toContain("typescript");
	});

	it("finds the spelling the posting uses", () => {
		expect(termAsWritten(["c#", "csharp"], "Strong C# skills")).toBe("C#");
		expect(termAsWritten(["rust"], "Go and Python")).toBeUndefined();
	});

	it("makes a visible skill with the given name", () => {
		expect(newSkill("Figma")).toMatchObject({ name: "Figma", hidden: false, keywords: [] });
	});
});
