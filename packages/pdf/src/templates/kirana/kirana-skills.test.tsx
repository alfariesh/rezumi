import type { TemplateSemanticManifest } from "../../semantic/template-manifest";
import type { SemanticNode } from "@rezumi/resume/stylesheet";
import type { ResumeData } from "@rezumi/schema/resume/data";
import type { Template } from "@rezumi/schema/templates";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { act } from "react";
import { defaultIconDesign } from "@rezumi/schema/resume/data";
import { defaultResumeData } from "@rezumi/schema/resume/default";
import { ResumeDocument } from "../../document";
import { renderToBuffer } from "../../forme/testing";
import { resolveResumeRuntime } from "../../semantic/resolve";
import { getTemplateSemanticManifest } from "../../semantic/template-manifest";
import { rasterizePdf } from "../../semantic/test/rasterize-pdf";

// No template puts a skill's rating right after its name any more, but the tree still orders it that way when a
// manifest asks (`skillLevelAfterName`). This stand-in manifest asks for one lineup ID.
let manifestStandIn: TemplateSemanticManifest | undefined;

vi.mock("../../semantic/template-manifest", async (importOriginal) => {
	const original = await importOriginal<typeof import("../../semantic/template-manifest")>();
	return {
		...original,
		getTemplateSemanticManifest: (template: Template) =>
			manifestStandIn?.template === template ? manifestStandIn : original.getTemplateSemanticManifest(template),
	};
});

afterEach(() => {
	manifestStandIn = undefined;
});

type SkillLayout = "default" | "inline";
type Placement = "main" | "sidebar";
type LevelDesign = "circle" | "rectangle" | "rectangle-full";

type SkillsFixtureOptions = {
	keywordLayout?: "inline" | "list";
	layout?: SkillLayout;
	placement?: Placement;
	columns?: number;
	design?: LevelDesign;
	level?: number;
	custom?: boolean;
};

const required = <T,>(value: T | undefined): T => {
	if (value === undefined) throw new Error("Missing fixture value");
	return value;
};

const skillsFixture = ({
	keywordLayout = "inline",
	layout = "default",
	placement = "main",
	columns = 1,
	design = "rectangle",
	level = 3,
	custom = false,
}: SkillsFixtureOptions = {}): ResumeData => {
	const data = structuredClone(defaultResumeData);
	// The margins are fixed here so the geometry below only moves with the template (Kirana).
	data.metadata.page = { ...data.metadata.page, marginX: 14, marginY: 12 };
	const sectionId = custom ? "custom-skills" : "skills";
	const section = {
		...data.sections.skills,
		title: "Skills",
		icon: "",
		hidden: false,
		columns,
		keywordLayout,
		layout,
		items: [
			{
				id: "skill-0",
				hidden: false,
				icon: "",
				iconColor: "",
				name: "Engineering",
				proficiency: "Experienced",
				level,
				keywords: ["Alpha", "Beta"],
			},
		],
	};

	data.metadata.template = "kirana";
	data.metadata.typography.body.fontFamily = "Helvetica";
	data.metadata.typography.heading.fontFamily = "Helvetica";
	data.metadata.design.icons = { ...defaultIconDesign, contact: false, items: false };
	data.metadata.design.colors.primary = "rgba(255, 0, 0, 1)";
	data.metadata.design.level = { type: design, icon: "star" };
	data.metadata.layout.pages = [
		{
			fullWidth: placement === "main",
			main: placement === "main" ? [sectionId] : [],
			sidebar: placement === "sidebar" ? [sectionId] : [],
		},
	];
	if (custom) data.customSections = [{ ...section, id: sectionId, type: "skills" }];
	else data.sections.skills = section;
	return data;
};

const flatten = (node: SemanticNode): SemanticNode[] => [node, ...node.children.flatMap(flatten)];

const getSkillItem = (runtime: ReturnType<typeof resolveResumeRuntime>, id = "skill-0") =>
	flatten(runtime.sourceTree).find((node) => node.kind === "item" && node.id === id);

const renderKirana = async (data: ResumeData, template: Template = "kirana") => {
	const bytes = new Uint8Array(await act(() => renderToBuffer(<ResumeDocument data={data} template={template} />)));
	const loading = getDocument({ data: bytes.slice(), useSystemFonts: true });
	try {
		const pdf = await loading.promise;
		const pages = [];
		for (let index = 1; index <= pdf.numPages; index++) {
			const page = await pdf.getPage(index);
			pages.push((await page.getTextContent()).items.flatMap((item) => ("str" in item ? [item] : [])));
		}
		return { bytes, pages };
	} finally {
		await loading.destroy();
	}
};

describe("Kirana skill rating placement (#2611)", () => {
	it.each([
		{ layout: "default" as const, placement: "main" as const, columns: 1, design: "rectangle" as const, level: 5 },
	])(
		"orders name, rating, proficiency, keywords when a manifest asks for it in $layout/$placement/$design",
		(options) => {
			manifestStandIn = { ...getTemplateSemanticManifest("kirana"), skillLevelAfterName: true };
			const data = skillsFixture(options);
			const runtime = resolveResumeRuntime({ data, template: "kirana" });
			const item = required(getSkillItem(runtime));
			const level = required(item.children.find((node) => node.kind === "level"));
			const header = required(item.children.find((node) => node.kind === "item-header"));

			expect(header.children.map((node) => node.attributes.name)).toEqual(["name"]);
			expect(item.children.map((node) => node.kind)).toEqual(["item-header", "level", "field", "field"]);
			expect(item.children.slice(2).map((node) => node.attributes.name)).toEqual(["proficiency", "keywords"]);
			expect(level.children).toHaveLength(5);
			expect(level.children.every((node) => node.attributes.type === options.design)).toBe(true);
		},
	);

	it("preserves Plan 22 list keywords with custom Skills", async () => {
		const data = skillsFixture({ keywordLayout: "list", custom: true, layout: "inline", columns: 2 });
		const result = await renderKirana(data);
		const text = result.pages
			.flat()
			.map((item) => item.str)
			.join(" ");
		expect(text.match(/•/g)).toHaveLength(2);
		expect(text).not.toContain("Alpha, Beta");
		expect(text).toContain("Engineering");
	});

	it.each(["kirana", "meridian"] as const)("keeps name, proficiency, keywords, then rating in %s", (template) => {
		const data = skillsFixture();
		const runtime = resolveResumeRuntime({ data, template });
		const item = required(getSkillItem(runtime));
		expect(item.children.map((node) => node.kind)).toEqual(["item-header", "field", "field", "level"]);
	});

	it("renders the rating band after the keywords in the actual Kirana tree", async () => {
		const data = skillsFixture({ design: "rectangle" });
		const result = await renderKirana(data);
		const text = result.pages.flat().map((item) => item.str);
		const rasters = await rasterizePdf(result.bytes.slice());
		const raster = required(rasters[0]);
		const rows = Array.from({ length: raster.height }, (_, y) => {
			let pixels = 0;
			for (let x = 0; x < raster.width; x++) {
				const offset = (y * raster.width + x) * 4;
				if ((raster.data[offset] ?? 0) > 200 && (raster.data[offset + 1] ?? 255) < 100) pixels++;
			}
			return pixels;
		});
		// The red section title is under 40 pixels wide on any row; the rating rectangles are far wider.
		const ratingBand = rows.findIndex((pixels) => pixels > 40);
		const pageText = required(result.pages[0]);
		const nameY = required(pageText.find((item) => item.str === "Engineering")).transform[5];
		const keywordsY = required(pageText.find((item) => item.str === "Alpha, Beta")).transform[5];
		const ratingY = (raster.height - ratingBand) / 1.5;
		expect(ratingBand).toBeGreaterThan(0);
		expect(ratingY).toBeLessThan(keywordsY);
		expect(keywordsY).toBeLessThan(nameY);
		expect(text.join(" ")).toContain("Engineering");
		expect(rasters).toHaveLength(1);
	});
});
