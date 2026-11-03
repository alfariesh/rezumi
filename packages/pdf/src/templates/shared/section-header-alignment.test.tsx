import type { ResumeData } from "@rezumi/schema/resume/data";
import type { TextItem } from "pdfjs-dist/types/src/display/api";
import { describe, expect, it } from "vite-plus/test";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { act, createElement } from "react";
import { defaultIconDesign } from "@rezumi/schema/resume/data";
import { defaultResumeData } from "@rezumi/schema/resume/default";
import { ResumeDocument } from "../../document";
import { renderToBuffer } from "../../forme/testing";

const fixture = (): ResumeData => {
	const data = structuredClone(defaultResumeData);
	// Margins and type are fixed here so the positions below only move with the template.
	data.metadata.template = "meridian";
	data.metadata.page = { ...data.metadata.page, marginX: 30, marginY: 12 };
	data.metadata.typography.body = {
		fontFamily: "Helvetica",
		fontWeights: ["400", "500"],
		fontSize: 10,
		lineHeight: 1.5,
	};
	data.metadata.typography.heading = { fontFamily: "Helvetica", fontWeights: ["600"], fontSize: 14, lineHeight: 1.5 };
	data.picture.hidden = true;
	data.metadata.layout.pages = [{ fullWidth: true, main: ["experience", "education"], sidebar: [] }];
	data.sections.experience.items = ["Engineer", "", "  "].map((position, index) => ({
		id: `experience-${index}`,
		hidden: false,
		company: `Company ${index}`,
		position,
		location: "London",
		period: `201${index}`,
		website: { url: "", label: "", inlineLink: false },
		description: "",
		roles: [],
	}));
	data.sections.education.items = ["Computing", "", "  ", ""].map((area, index) => ({
		id: `education-${index}`,
		hidden: false,
		school: `School ${index}`,
		degree: index === 3 ? "" : "Degree",
		area,
		grade: "",
		location: "Paris",
		period: `202${index}`,
		website: { url: "", label: "", inlineLink: false },
		description: "",
	}));
	return data;
};

const renderText = async (data: ResumeData) => {
	const element = createElement(ResumeDocument, { data, template: data.metadata.template }) as unknown as Parameters<
		typeof renderToBuffer
	>[0];
	let bytes: Uint8Array = new Uint8Array();
	await act(async () => {
		bytes = new Uint8Array(await renderToBuffer(element));
	});
	const loadingTask = getDocument({ data: bytes, useSystemFonts: true });
	try {
		const document = await loadingTask.promise;
		const page = await document.getPage(1);
		const content = await page.getTextContent();
		return content.items.filter((item): item is TextItem => "str" in item);
	} finally {
		await loadingTask.destroy();
	}
};

const findText = (items: TextItem[], text: string) => {
	const item = items.find((item) => item.str === text);
	if (!item) throw new Error(`Missing PDF text: ${text}`);
	return item;
};

/**
 * A section heading as its line of text. Tracked capitals reach the PDF a letter at a time ("E X P E R I E N C E"),
 * so the line is read back without spaces or case.
 */
const findHeading = (items: TextItem[], title: string) => {
	const letters = (text: string) => text.replaceAll(/\s/g, "").toLowerCase();
	const lines = Map.groupBy(
		items.filter((item) => item.str.trim()),
		(item) => item.transform[5].toFixed(1),
	);
	for (const line of lines.values()) {
		if (letters(line.map((item) => item.str).join("")) !== letters(title)) continue;
		return {
			left: Math.min(...line.map((item) => item.transform[4])),
			right: Math.max(...line.map((item) => item.transform[4] + item.width)),
		};
	}
	throw new Error(`Missing PDF heading: ${title}`);
};

/** Dates end flush with the content box's right edge. */
const expectTrailingAlignment = (items: TextItem[]) => {
	// Meridian draws "Paris • 2020" as separate runs, so the year is the item that has to reach the edge.
	const expectedText = ["2010", "2011", "2012", "2020", "2021", "2022", "2023"];
	for (const text of expectedText) {
		const item = findText(items, text);
		expect(item.transform[4] + item.width, text).toBeCloseTo(565.28, 1);
	}
};

describe("optional experience and education header fields (#3338)", () => {
	it("keeps dates at the trailing edge with empty leading fields", async () => {
		const data = fixture();
		data.metadata.stylesheet = { mode: "semantic", source: { languageVersion: 1, text: "@version 1;" } };
		const items = await renderText(data);
		expectTrailingAlignment(items);
	});
});

describe.each(["sterling", "meridian", "summit"] as const)("%s section heading direction", (template) => {
	it.each(["en-US", "ar-SA"])("keeps headings at the reading edge with and without icons in %s", async (locale) => {
		for (const hideSectionIcons of [false, true]) {
			const data = fixture();
			data.metadata.template = template;
			data.metadata.page.locale = locale;
			data.metadata.design.icons = { ...defaultIconDesign, sections: !hideSectionIcons };
			data.sections.experience.title = "Experience";
			data.sections.education.title = "Education";
			const items = await renderText(data);
			for (const title of ["Experience", "Education"]) {
				const heading = findHeading(items, title);
				if (locale === "ar-SA") {
					expect(heading.right, `${title}, icons hidden: ${hideSectionIcons}`).toBeGreaterThan(530);
				} else {
					expect(heading.left, `${title}, icons hidden: ${hideSectionIcons}`).toBeLessThan(60);
				}
			}
		}
	});
});
