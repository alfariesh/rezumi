import type { MessageDescriptor } from "@lingui/core";
import type { PortfolioWork } from "@rezumi/schema/portfolio/data";
import { describe, expect, it } from "vite-plus/test";
import { produce } from "immer";
import { parseWritablePortfolioData } from "@rezumi/schema/portfolio/data";
import { PORTFOLIO_LIMITS } from "@rezumi/schema/portfolio/limits";
import { newTextBlock } from "./blocks";
import {
	addStoryTemplate,
	STORY_TEMPLATE_IDS,
	STORY_TEMPLATES,
	storyTemplateBlocks,
	suggestStoryTemplate,
} from "./story-templates";

// The source text, as the editor's `i18n._` gives it in English.
const english = (descriptor: MessageDescriptor) => descriptor.message ?? descriptor.id;

const work = (blocks: PortfolioWork["blocks"] = []): PortfolioWork => ({
	id: "w1",
	slug: "w1",
	previousSlugs: [],
	title: "Work",
	summary: "",
	role: "",
	date: "",
	tags: [],
	blocks,
	featured: false,
	hidden: false,
});

const headings = (blocks: PortfolioWork["blocks"]) =>
	blocks.map((block) => (block.type === "text" ? /<h2>(.*)<\/h2>/.exec(block.html)?.[1] : block.type));

describe("story templates", () => {
	it("has every template, each a handful of headed blocks that fit an empty work", () => {
		expect(Object.keys(STORY_TEMPLATES).sort()).toEqual([...STORY_TEMPLATE_IDS].sort());
		for (const id of STORY_TEMPLATE_IDS) {
			const template = STORY_TEMPLATES[id];
			expect(template.id).toBe(id);
			expect(english(template.name)).not.toBe("");
			expect(english(template.description)).not.toBe("");
			expect(template.parts.length).toBeGreaterThanOrEqual(4);
			expect(template.parts.length).toBeLessThanOrEqual(PORTFOLIO_LIMITS.blocksPerWork);
			// It starts with words to write under, so the caret has somewhere to go.
			expect(template.parts[0]).not.toBe("metrics");
			for (const part of template.parts) if (part !== "metrics") expect(english(part.heading).trim()).not.toBe("");
		}
	});

	it("keeps the generic case study's outline", () => {
		expect(headings(storyTemplateBlocks("case-study", english))).toEqual([
			"The problem",
			"My role",
			"The process",
			"The result",
			"metrics",
		]);
	});

	it("leaves the visual outline light on words and pictures to the person (a Pictures block can't be empty)", () => {
		const blocks = storyTemplateBlocks("visual", english);
		expect(blocks.every((block) => block.type === "text")).toBe(true);
		expect(headings(blocks)).toContain("The final pieces");
	});

	it("makes blocks with new ids, escaped headings and an empty paragraph, valid to save", () => {
		for (const id of STORY_TEMPLATE_IDS) {
			const blocks = storyTemplateBlocks(id, (descriptor) => `${english(descriptor)} <&>`);
			expect(new Set(blocks.map((block) => block.id)).size).toBe(blocks.length);
			const first = blocks[0];
			expect(first?.type === "text" && first.html).toMatch(/^<h2>.+ &lt;&amp;&gt;<\/h2><p><\/p>$/);
			const filled = produce(work(), (draft) => void addStoryTemplate(draft as PortfolioWork, id, english));
			expect(() => parseWritablePortfolioData({ works: { items: [filled] } })).not.toThrow();
		}
	});

	it("adds the outline after the work's blocks and returns what went in", () => {
		const intro = newTextBlock("<p>intro</p>");
		let added: PortfolioWork["blocks"] = [];
		const after = produce(work([intro]), (draft) => {
			added = addStoryTemplate(draft as PortfolioWork, "marketing", english);
		});
		expect(added).toHaveLength(STORY_TEMPLATES.marketing.parts.length);
		expect(after.blocks[0]?.id).toBe(intro.id);
		expect(after.blocks[1]?.id).toBe(added[0]?.id);
		expect(headings(after.blocks.slice(1, 2))).toEqual(["The goal"]);
	});

	it("adds only as many blocks as the work has room for", () => {
		const nearlyFull = work(Array.from({ length: PORTFOLIO_LIMITS.blocksPerWork - 2 }, () => newTextBlock()));
		let added: PortfolioWork["blocks"] = [];
		const after = produce(nearlyFull, (draft) => {
			added = addStoryTemplate(draft as PortfolioWork, "design", english);
		});
		expect(added).toHaveLength(2);
		expect(after.blocks).toHaveLength(PORTFOLIO_LIMITS.blocksPerWork);
		expect(headings(added)).toEqual(["The problem", "My role"]);

		const full = work(Array.from({ length: PORTFOLIO_LIMITS.blocksPerWork }, () => newTextBlock()));
		produce(full, (draft) => {
			expect(addStoryTemplate(draft as PortfolioWork, "writing", english)).toEqual([]);
		});
	});
});

describe("suggesting a template", () => {
	it.each([
		["Product Designer", "design"],
		["UI/UX Designer at Lugas", "design"],
		["Desainer Produk", "design"],
		["Graphic designer", "visual"],
		["Fotografer pernikahan", "visual"],
		["Freelance illustrator", "visual"],
		["Video editor", "visual"],
		["Frontend developer", "engineering"],
		["Senior Software Engineer", "engineering"],
		["Pengembang aplikasi", "engineering"],
		["Digital marketer", "marketing"],
		["Content marketing lead", "marketing"],
		["Growth lead", "marketing"],
		["Copywriter", "writing"],
		["UX writer", "writing"],
		["Jurnalis lepas", "writing"],
		["Product manager", "case-study"],
		["Promotion coordinator", "marketing"],
	] as const)("reads %s as %s", (text, id) => {
		expect(suggestStoryTemplate(text)).toBe(id);
	});

	it("prefers the role on the work, then the headline, then the generic case study", () => {
		expect(suggestStoryTemplate("Lead photographer", "Software engineer")).toBe("visual");
		expect(suggestStoryTemplate("", undefined, "Software engineer")).toBe("engineering");
		expect(suggestStoryTemplate("Project lead", "Founder")).toBe("case-study");
		expect(suggestStoryTemplate()).toBe("case-study");
	});
});
