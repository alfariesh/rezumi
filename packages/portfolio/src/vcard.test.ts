import type { PortfolioDataInput } from "@rezumi/schema/portfolio/data";
import { describe, expect, it } from "vite-plus/test";
import { fullPortfolioData, renderTestPage, testResume } from "./fixtures.test-helpers";
import { buildPortfolioVcard } from "./vcard";

const URL = "https://rezumi.example/nadia";

function card(data: PortfolioDataInput = fullPortfolioData, resume = testResume()) {
	const { view } = renderTestPage(data, { resume });
	return buildPortfolioVcard(view, { url: URL });
}

/** The card's lines with folding undone, as a reader joins them. */
const unfold = (text: string) => text.replace(/\r\n /g, "").split("\r\n");

describe("buildPortfolioVcard", () => {
	it("holds what the page shows: name, headline, the contact details, addresses once, and the place", () => {
		const text = card();
		expect(text.endsWith("\r\n")).toBe(true);
		expect(text).not.toMatch(/[^\r]\n/);
		expect(unfold(text)).toEqual([
			"BEGIN:VCARD",
			"VERSION:3.0",
			"N:;Nadia Rahmawati;;;",
			"FN:Nadia Rahmawati",
			"TITLE:Product Designer",
			"EMAIL;TYPE=INTERNET:nadia@example.test",
			"TEL;TYPE=CELL:+6281255501824",
			`URL:${URL}`,
			"URL:https://nadia.example.test",
			"URL:https://linkedin.example.test/in/nadia",
			"ADR;TYPE=WORK:;;;Jakarta\\, Indonesia;;;",
			"END:VCARD",
			"",
		]);
	});

	it("escapes backslashes, commas, semicolons and line breaks, and folds at 75 octets without splitting a character", () => {
		const resume = testResume();
		resume.basics.headline = `Writer; editor, \\ "teacher"\nand ${"مصممة ".repeat(12)}👩‍💻${"é".repeat(40)}`;
		const text = card(fullPortfolioData, resume);
		const title = unfold(text).find((line) => line.startsWith("TITLE:")) ?? "";
		expect(title.startsWith('TITLE:Writer\\; editor\\, \\\\ "teacher"\\nand مصممة')).toBe(true);
		const encoder = new TextEncoder();
		for (const line of text.split("\r\n")) {
			expect(encoder.encode(line).length, line).toBeLessThanOrEqual(75);
			// Every piece is whole text: no lone surrogate, no broken UTF-8 sequence.
			expect(new TextDecoder("utf-8", { fatal: true }).decode(encoder.encode(line))).toBe(line);
			expect(line).not.toMatch(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/);
		}
	});

	it("leaves out what the page hides: Contact, its email and phone, and the place", () => {
		const hidden = card({ ...fullPortfolioData, sections: { hidden: ["contact"] } });
		expect(hidden).not.toMatch(/EMAIL|TEL|URL:https:\/\/nadia/);
		expect(hidden).toContain(`URL:${URL}`);
		const noEmail = card({ ...fullPortfolioData, contact: { ...fullPortfolioData.contact, email: false } });
		expect(noEmail).not.toContain("EMAIL");
		const resume = testResume();
		resume.basics.location = "";
		const placeless = card(
			{ ...fullPortfolioData, hero: { ...fullPortfolioData.hero, showLocation: false }, location: { label: "" } },
			resume,
		);
		expect(placeless).not.toContain("ADR");
	});

	it("names the portfolio's address once, even when Contact links to it too", () => {
		const resume = testResume();
		resume.basics.website = { url: URL, label: "Portfolio" };
		expect(card(fullPortfolioData, resume).match(/URL:https:\/\/rezumi\.example\/nadia\r\n/g)).toHaveLength(1);
	});
});
