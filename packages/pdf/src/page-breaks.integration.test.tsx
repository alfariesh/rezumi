import type { ElementInfo } from "@formepdf/core";
import type { ResumeData } from "@rezumi/schema/resume/data";
import type { Template } from "@rezumi/schema/templates";
import { describe, expect, it } from "vite-plus/test";
import * as forme from "@formepdf/core";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { sampleResumeData } from "@rezumi/schema/resume/sample";
import { renderResume } from "./forme/render";
import { NODE_CONTENT_PREFIX, NODE_SOURCE_PREFIX } from "./page-map";
import "./forme/testing";

type Layout = Awaited<ReturnType<typeof renderResume>>["layout"];

/** The sample resume with its Experience repeated `times` over, so its sections end at a different place each time. */
const lengthened = (template: Template, times: number): ResumeData => {
	const data = structuredClone(sampleResumeData);
	data.metadata.template = template;
	data.picture.hidden = true;
	const { items } = data.sections.experience;
	data.sections.experience.items = Array.from({ length: times }, (_, round) =>
		items.map((item) => ({ ...item, id: `${item.id}-${round}` })),
	).flat();
	return data;
};

/** Every page each tagged key reaches, read from Forme's layout. */
const pagesByKey = (layout: Layout) => {
	const pages = new Map<string, Set<number>>();
	layout.pages.forEach((page, index) => {
		const visit = (element: ElementInfo) => {
			const file = element.sourceLocation?.file ?? "";
			const tagged = file.startsWith(NODE_SOURCE_PREFIX) || file.startsWith(NODE_CONTENT_PREFIX);
			if (tagged && Math.abs(element.y) < 1e6 && element.height > 0.5) {
				const key = file.slice(file.indexOf(":") + 1);
				pages.set(key, (pages.get(key) ?? new Set()).add(index));
			}
			element.children.forEach(visit);
		};
		page.elements.forEach(visit);
	});
	return pages;
};

// Meridian is one column, Kirana puts a sidebar beside the main column.
const cases = (["meridian", "kirana"] as const).flatMap((template) =>
	Array.from({ length: 8 }, (_, index) => [template, index + 2] as const),
);

describe("page breaks", () => {
	it.each(cases)(
		"keeps %s's headers whole and titles with their first item (Experience ×%i)",
		{ timeout: 60_000 },
		async (template, times) => {
			const { layout } = await renderResume(forme, { data: lengthened(template, times) });
			const pages = pagesByKey(layout);

			for (const [key, on] of pages) {
				// An entry's header rows end up on one page.
				if (key.endsWith("/item-header")) expect([...on], key).toHaveLength(1);
			}

			// A section's first page holds its first item: a title is never left alone at the bottom of a page.
			const sections = [...pages.keys()].filter(
				(key) => /\/section-[^/]+$/.test(key) && !key.endsWith("/section-items"),
			);
			for (const section of sections) {
				const first = Math.min(...(pages.get(section) ?? []));
				const itemPages = [...pages]
					.filter(([key]) => key.startsWith(`${section}/section-items/item-`))
					.flatMap(([, on]) => [...on]);
				if (itemPages.length === 0) continue;
				expect(Math.min(...itemPages), `${section} starts on page ${first}`).toBe(first);
			}
		},
	);

	it("prints a phone number and a handle as typed on a right-to-left page", { timeout: 60_000 }, async () => {
		const data = structuredClone(sampleResumeData);
		data.metadata.page.locale = "ar-SA";
		data.basics.phone = "+62 812 5550 1824";
		data.basics.customFields = [{ id: "handle", icon: "instagram", text: "@rezumi.studio", link: "" }];
		const { pdf } = await renderResume(forme, { data });
		const document = await getDocument({ data: pdf }).promise;
		const { items } = await (await document.getPage(1)).getTextContent();
		const text = items.map((item) => ("str" in item ? item.str : "")).join("\n");

		// The page's direction used to turn them around: "1824 5550 812 62+", "rezumi.studio@".
		expect(text).toContain("+62 812 5550 1824");
		expect(text).toContain("@rezumi.studio");
	});

	it(
		"shrinks a name in Purnama's sidebar until its longest word fits, so no word breaks",
		{ timeout: 60_000 },
		async () => {
			const data = structuredClone(sampleResumeData);
			data.metadata.template = "purnama";
			data.basics.name = "Kanjeng Raden Ayu Maharani Kusumawardhani Prameswari Hadiningrat";
			const { pdf } = await renderResume(forme, { data });
			const document = await getDocument({ data: pdf }).promise;
			const { items } = await (await document.getPage(1)).getTextContent();
			const words = items.flatMap((item) => ("str" in item ? item.str.split(/\s+/) : []));

			expect(words).toContain("Kusumawardhani");
			expect(words).toContain("Hadiningrat");
		},
	);
});
