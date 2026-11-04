import type { ElementInfo } from "@formepdf/core";
import type { ResumeData } from "@rezumi/schema/resume/data";
import { describe, expect, it } from "vite-plus/test";
import * as forme from "@formepdf/core";
import { defaultResumeData } from "@rezumi/schema/resume/default";
import { renderResume } from "../../forme/render";

/**
 * Jejak's trail line is an absolute rule from the first dot to the end of the list. The PDF draws it as the border of
 * a box around the entries (`barAsBorder` in `to-forme.tsx`), so it runs beneath the dots and on every page the list
 * reaches; the published Forme 0.29.0 gave the rule itself no height, so it was never drawn.
 */

const buildData = (jobs: number, bullets = 1): ResumeData => {
	const data = structuredClone(defaultResumeData);
	data.picture.hidden = true;
	data.sections.experience.items = Array.from({ length: jobs }, (_, index) => ({
		id: `experience/${index}`,
		hidden: false,
		company: `Company ${index + 1}`,
		position: "Engineer",
		location: "Jakarta",
		period: "2020 - 2024",
		website: { url: "", label: "", inlineLink: false },
		description: `<ul>${"<li>Built and shipped the product with a team of engineers and designers.</li>".repeat(bullets)}</ul>`,
		roles: [],
	}));
	data.metadata.layout.pages = [{ fullWidth: false, main: ["experience"], sidebar: [] }];
	return data;
};

/** Per page: the boxes the line is the left border of. */
const linesPerPage = async (data: ResumeData) => {
	const { layout } = await renderResume(forme, { data, template: "jejak" });
	return layout.pages.map((page) => {
		const found: ElementInfo[] = [];
		const walk = (node: ElementInfo) => {
			if (Math.abs(node.style.borderWidth.left - 0.8) < 0.05 && node.height > 0) found.push(node);
			node.children.forEach(walk);
		};
		page.elements.forEach(walk);
		return found;
	});
};

describe("Jejak's trail line", () => {
	it("joins two entries, as the border of the box that holds them", async () => {
		const [page = []] = await linesPerPage(buildData(2));

		expect(page).toHaveLength(1);
		// From the first dot down past the second entry.
		expect(page[0]?.height).toBeGreaterThan(40);
	});

	it("continues on every page a long list reaches", async () => {
		const pages = await linesPerPage(buildData(9, 5));

		expect(pages.length).toBeGreaterThan(1);
		for (const page of pages) expect(page).toHaveLength(1);
	});

	it("leaves a single entry without a line", async () => {
		expect((await linesPerPage(buildData(1))).flat()).toEqual([]);
	});
});
