import type { Proposal } from "@rezumi/resume/proposals";
import { describe, expect, it } from "vite-plus/test";
import { coverLetterTextToHtml } from "@rezumi/resume/cover-letter";
import { applyTo, collectLetterPassages, getStateIn, replaceBlockText } from "@rezumi/resume/proposals";
import { sanitizeCoverLetterHtml } from "./html";

describe("saved cover-letter HTML", () => {
	it("removes executable markup, event handlers and unsafe links", () => {
		const result = sanitizeCoverLetterHtml(
			'<script>alert(1)</script><p onclick="alert(2)">Hello <a href="javascript:alert(3)">team</a><img src=x onerror="alert(4)"></p>',
		);
		expect(result).toBe("<p>Hello <a>team</a></p>");
	});
	it("preserves rich editor formatting and safe links while removing CSS URL payloads", () => {
		const result = sanitizeCoverLetterHtml(
			'<p style="text-align:center;background-image:url(https://evil.test);color:#aabbcc"><strong>Dear</strong> <em>team</em><br><a href="https://example.com">Portfolio</a></p>',
		);
		expect(result).toContain('style="text-align:center;color:#aabbcc"');
		expect(result).toContain("<strong>Dear</strong> <em>team</em><br />");
		expect(result).toContain('href="https://example.com"');
		expect(result).not.toContain("evil.test");
	});

	it("stores a kept draft in a spelling the assistant's proposals still match in the editor", () => {
		// "Keep" puts the draft in the editor as `coverLetterTextToHtml` spells it; the server stores it sanitized.
		const kept = coverLetterTextToHtml(
			[
				"Dear Ms. Reyes,\nI'm applying for the Product Designer role at Kettle\u00a0Labs.",
				'At Lumen Health I led the "Care Plans" redesign; it’s now used by 40,000 patients.',
				"I built the design system and ran weekly usability sessions.",
				"I mentor two junior designers & run our critique.",
				"I'd welcome a chat about the team's plans.\nKind regards,\nDana Reyes",
			].join("\n\n"),
		);
		const stored = sanitizeCoverLetterHtml(kept);
		expect(stored).not.toBe(kept);

		const proposals = collectLetterPassages(stored, {
			body: "Letter",
			bullet: (n) => `bullet ${n}`,
			paragraph: (n) => `paragraph ${n}`,
		}).map((passage, index): Proposal => ({
			id: passage.id,
			target: passage.target,
			location: passage.location,
			before: passage.html,
			after: replaceBlockText(passage.html, `Paragraf ${index + 1} dalam bahasa Indonesia.`),
			why: "Translate to Indonesian.",
			status: "pending",
			source: "assistant",
		}));
		expect(proposals).toHaveLength(5);
		expect(proposals.map((proposal) => getStateIn(kept, proposal))).toEqual(Array(5).fill("pending"));
		expect(proposals.reduce((value, proposal) => applyTo(value, proposal) ?? value, kept)).toBe(
			proposals.map((proposal) => proposal.after).join(""),
		);
	});
});
