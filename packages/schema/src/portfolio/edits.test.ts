import { describe, expect, it } from "vite-plus/test";
import {
	isPortfolioSettablePath,
	PORTFOLIO_EDITS_MAX,
	PORTFOLIO_SETTABLE_PATHS,
	portfolioEditSchema,
	portfolioEditsInputSchema,
} from "./edits";

const issues = (edit: unknown) => {
	const result = portfolioEditSchema.safeParse(edit);
	return result.success ? [] : result.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`);
};

describe("isPortfolioSettablePath", () => {
	it("takes the listed paths and one key of the keyed maps", () => {
		for (const path of PORTFOLIO_SETTABLE_PATHS) expect(isPortfolioSettablePath(path)).toBe(true);
		expect(isPortfolioSettablePath("design.variants.work")).toBe(true);
		expect(isPortfolioSettablePath("sections.titles.experience")).toBe(true);
		expect(isPortfolioSettablePath("sections.titles.custom:abc-1")).toBe(true);
		// A resume section's id can be any text, dots and spaces included.
		expect(isPortfolioSettablePath("sections.hiddenItems.resume:Bahasa daerah #1.x")).toBe(true);
	});

	it("refuses lists with ids, unknown fields and keys that aren't sections or layouts", () => {
		for (const path of [
			"works",
			"works.items",
			"hero.highlights",
			"basics",
			"design.variants.footer",
			"sections.titles.",
			"sections.titles.nope",
			"credit",
			"version",
		])
			expect(isPortfolioSettablePath(path)).toBe(false);
	});
});

describe("portfolioEditSchema", () => {
	it("parses each op", () => {
		const edits = [
			{ op: "set", path: "theme", value: "prima" },
			{ op: "set", path: "basics.name", value: null },
			{ op: "add", list: "works", item: { title: "Lumen" }, ref: "lumen", at: "first" },
			{ op: "add", list: "blocks", workId: "lumen", item: { type: "text", html: "Hi" }, at: { after: "b1" } },
			{ op: "update", list: "metrics", workId: "w1", blockId: "b3", id: "m1", fields: { label: "Conversion" } },
			{ op: "remove", list: "custom", id: "x1" },
			{ op: "move", list: "services", id: "s1", to: { before: "s2" } },
		];
		for (const edit of edits) expect(issues(edit), JSON.stringify(edit)).toEqual([]);
	});

	it("names what's missing or misplaced", () => {
		expect(issues({ op: "set", path: "works", value: [] })).toEqual([
			"path: This field can't be set. Lists with ids change with add, update, remove or move.",
		]);
		expect(issues({ op: "add", list: "blocks", item: {} })).toEqual(["workId: Name the work."]);
		expect(issues({ op: "add", list: "works", workId: "w1", item: {} })).toEqual([
			"workId: Only blocks and metrics take a work.",
		]);
		expect(issues({ op: "remove", list: "metrics", workId: "w1", id: "m1" })).toEqual([
			"blockId: Name the Metrics block.",
		]);
		expect(issues({ op: "remove", list: "blocks", workId: "w1", blockId: "b1", id: "b2" })).toEqual([
			"blockId: Only metrics take a block.",
		]);
		expect(issues({ op: "remove", list: "works", id: "has space" })[0]).toContain(
			"Use an id from the portfolio as you last read it, or a ref from an earlier add in this call.",
		);
		expect(issues({ op: "move", list: "works", id: "w1", to: "middle" })).not.toEqual([]);
		expect(issues({ op: "remove", list: "works", id: "w1", extra: true })).not.toEqual([]);
		expect(issues({ op: "rename", list: "works", id: "w1" })).not.toEqual([]);
	});
});

describe("portfolioEditsInputSchema", () => {
	it("takes a title and 1 to the most edits", () => {
		const edit = { op: "remove", list: "works", id: "w1" };
		expect(portfolioEditsInputSchema.safeParse({ title: "Remove a work", edits: [edit] }).success).toBe(true);
		expect(portfolioEditsInputSchema.safeParse({ title: " ", edits: [edit] }).success).toBe(false);
		expect(portfolioEditsInputSchema.safeParse({ title: "None", edits: [] }).success).toBe(false);
		expect(
			portfolioEditsInputSchema.safeParse({
				title: "Many",
				edits: Array.from({ length: PORTFOLIO_EDITS_MAX + 1 }, () => edit),
			}).success,
		).toBe(false);
	});
});
