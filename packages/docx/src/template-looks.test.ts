// @vitest-environment happy-dom

import type { Template } from "@rezumi/schema/templates";
import { describe, expect, it } from "vite-plus/test";
import { createSampleResumeData } from "@rezumi/schema/resume/sample";
import { templateLineup } from "@rezumi/schema/templates";
import { buildDocument } from "./builder";

/** The document body's XML (section properties included) as JSON, for `template` with the sample resume. */
function documentXml(template: Template, change?: (data: ReturnType<typeof createSampleResumeData>) => void) {
	const data = structuredClone(createSampleResumeData());
	data.metadata.template = template;
	change?.(data);
	const file = buildDocument(data);
	return JSON.stringify(file.Document.View.prepForXml({ file, viewWrapper: file.Document, stack: [] }));
}

const count = (xml: string, text: string) => xml.split(text).length - 1;

describe("DOCX template looks", () => {
	it.each(templateLineup)("prints the %s header once, however many layout pages there are", (template) => {
		const xml = documentXml(template);
		expect(count(xml, '"David Kowalski"')).toBe(1);
	});

	it("titles sections the way the template does", () => {
		// Meridian: small tracked capitals over a hairline; the text stays as typed for ATS.
		const meridian = documentXml("meridian");
		expect(meridian).toContain('"w:caps"');
		expect(meridian).not.toContain('"EXPERIENCE"');
		// Aksara: regular-weight serif titles under a rule over the section; only the kicker is in capitals.
		const aksara = documentXml("aksara");
		expect(count(aksara, '"w:caps"')).toBe(1);
		expect(aksara).toMatch(/"w:top":\{"_attr":\{"w:val":"single"/);
		// Tunas: an accent bar before the title.
		expect(documentXml("tunas")).toMatch(/"w:left":\{"_attr":\{"w:val":"single"/);
	});

	it("centres Sterling's header and spaces its capital name", () => {
		const xml = documentXml("sterling");
		expect(xml).toContain('"w:jc":{"_attr":{"w:val":"center"}}');
		expect(xml).toMatch(/"w:spacing":\{"_attr":\{"w:val":\d+/);
	});

	it("fills Purnama's sidebar with the accent and Kirana's with a faint wash of it", () => {
		const accent = "rgba(22, 30, 52, 1)";
		const purnama = documentXml("purnama", (data) => (data.metadata.design.colors.primary = accent));
		expect(purnama).toContain('"w:fill":"161e34"');
		const kirana = documentXml("kirana", (data) => (data.metadata.design.colors.primary = accent));
		expect(kirana).not.toContain('"w:fill":"161e34"');
		// 8% of the accent over white, the PDF's `accentSoft`.
		expect(kirana).toContain('"w:fill":"ecedef"');
	});

	it("sets Aksara's summary as a standfirst, larger than the body", () => {
		const summarySize = (template: Template) => {
			const xml = documentXml(template, (data) => {
				data.metadata.layout.pages = [{ fullWidth: true, main: ["summary"], sidebar: [] }];
				data.summary.content = "<p>Standfirst</p>";
			});
			const before = xml.slice(0, xml.indexOf('"Standfirst"'));
			return Number(before.slice(before.lastIndexOf('"w:sz"')).match(/"w:val":(\d+)/)?.[1]);
		};
		expect(summarySize("aksara")).toBeGreaterThan(summarySize("meridian"));
	});

	it("numbers Cendekia's publications", () => {
		const titles = (template: Template) =>
			documentXml(template, (data) => {
				data.metadata.layout.pages = [{ fullWidth: true, main: ["publications"], sidebar: [] }];
				data.sections.publications.hidden = false;
				data.sections.publications.items = ["First paper", "Second paper"].map((title, index) => ({
					id: `p${index}`,
					hidden: false,
					title,
					publisher: "Journal",
					date: "2024",
					website: { url: "", label: "", inlineLink: false },
					description: "",
				}));
			});
		expect(titles("cendekia")).toContain('"1. First paper"');
		expect(titles("cendekia")).toContain('"2. Second paper"');
		expect(titles("meridian")).toContain('"First paper"');
	});

	it("rules the top edge of every Summit page", () => {
		expect(documentXml("summit")).toContain('"w:display":"allPages"');
		expect(documentXml("meridian")).not.toContain("w:pgBorders");
	});
});
