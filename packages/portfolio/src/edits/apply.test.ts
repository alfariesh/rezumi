import type { PortfolioEditContext, PortfolioEditPlan } from "./types";
import type { PortfolioData } from "@rezumi/schema/portfolio/data";
import type { PortfolioEdit } from "@rezumi/schema/portfolio/edits";
import { describe, expect, it } from "vite-plus/test";
import { parseWritablePortfolioData } from "@rezumi/schema/portfolio/data";
import { createDefaultPortfolioData } from "@rezumi/schema/portfolio/default";
import { RICH_TEXT_MARKUP_FACTOR } from "@rezumi/schema/portfolio/limits";
import { fullPortfolioData, testImage } from "../fixtures.test-helpers";
import { sanitizePortfolioData } from "../rich-text";
import { applyPortfolioEdits } from "./apply";
import { portfolioEditItemName } from "./lists";

/** The test fixture as stored: every section and block type, rich text cleaned. */
const stored = (): PortfolioData => sanitizePortfolioData(parseWritablePortfolioData(fullPortfolioData));

/** Ids in order, so results are predictable. */
function counter() {
	let next = 0;
	return () => `id-${++next}`;
}

const upload = testImage("upload-1", 1200, 900);

function strict(data: PortfolioData, edits: readonly unknown[], context: Partial<PortfolioEditContext> = {}) {
	return applyPortfolioEdits(data, edits as PortfolioEdit[], {
		mode: "strict",
		newId: counter(),
		images: [upload],
		...context,
	});
}

const work = (data: PortfolioData, id: string) => data.works.items.find((item) => item.id === id);

describe("set", () => {
	it("writes design values, with shorthands for accent and fonts", () => {
		const result = strict(stored(), [
			{ op: "set", path: "design.accent", value: "toska" },
			{ op: "set", path: "design.fonts", value: "manrope" },
			{ op: "set", path: "design.scheme", value: "dark" },
			{ op: "set", path: "design.variants.work", value: "grid-2" },
		]);
		expect(result.failed).toEqual([]);
		expect(result.data.design).toEqual({
			scheme: "dark",
			accent: { source: "preset", id: "toska" },
			fonts: { source: "pair", id: "manrope" },
			variants: { work: "grid-2" },
		});
		expect(result.applied[0]?.edit).toEqual({
			op: "set",
			path: "design.accent",
			value: { source: "preset", id: "toska" },
		});
		expect(result.applied[0]?.summary).toBe('Set design.accent to {"source":"preset","id":"toska"}');

		const custom = strict(stored(), [
			{ op: "set", path: "design.accent", value: "#0f766e" },
			{ op: "set", path: "design.accent", value: "resume" },
		]);
		expect(custom.applied.map((entry) => entry.edit)).toEqual([
			{ op: "set", path: "design.accent", value: { source: "custom", color: "#0f766e" } },
			{ op: "set", path: "design.accent", value: { source: "resume" } },
		]);
	});

	it("refuses fonts, layouts and effects the theme doesn't offer, naming what it does", () => {
		const result = strict(stored(), [
			{ op: "set", path: "design.fonts", value: "archivo" },
			{ op: "set", path: "design.variants.hero", value: "bento" },
			{ op: "set", path: "hero.effect", value: "glitter" },
			{ op: "set", path: "theme", value: "mozaik" },
			{ op: "set", path: "design.variants.hero", value: "bento" },
		]);
		expect(result.failed.map((entry) => entry.index)).toEqual([0, 1, 2]);
		expect(result.failed[0]?.error).toContain("design.fonts: the Lugas theme offers these font pairs: jakarta");
		expect(result.failed[1]?.error).toContain("offers photo-top, photo-left");
		expect(result.failed[2]?.error).toContain("offers these effects");
		expect(result.data.design.variants.hero).toBe("bento");
	});

	it("takes an effect id alone, keeping the effect's target and phrases", () => {
		const data = stored();
		data.hero.effect = { target: "headline", phrases: ["Designer"] };
		const result = strict(data, [{ op: "set", path: "hero.effect", value: "typewriter" }]);
		expect(result.data.hero.effect).toEqual({ id: "typewriter", target: "headline", phrases: ["Designer"] });
	});

	it("overrides basics and lets null or empty text follow the resume again", () => {
		const result = strict(stored(), [
			{ op: "set", path: "basics.name", value: "  Nadia R.  " },
			{ op: "set", path: "basics.headline", value: "Designer" },
			{ op: "set", path: "basics.headline", value: null },
			{ op: "set", path: "basics.location", value: "" },
		]);
		expect(result.failed).toEqual([]);
		expect(result.data.basics).toEqual({ name: "Nadia R." });
		expect(result.applied[2]?.edit).toEqual({ op: "set", path: "basics.headline", value: null });
		expect(result.applied[2]?.summary).toBe("Removed basics.headline: the page follows the resume again");
		expect(result.applied[2]?.inverse).toEqual([{ op: "set", path: "basics.headline", value: "Designer" }]);
	});

	it("sets the photo to an upload, to none, or back to the resume's", () => {
		const data = stored();
		const photo = strict(data, [{ op: "set", path: "basics.picture", value: { key: upload.key, alt: "Me" } }]);
		expect(photo.data.basics.picture).toEqual({ ...upload, alt: "Me" });
		expect(photo.applied[0]?.inverse).toEqual([{ op: "set", path: "basics.picture", value: "resume" }]);

		const none = strict(photo.data, [{ op: "set", path: "basics.picture", value: null }]);
		expect(none.data.basics.picture).toBeNull();
		expect(none.applied[0]?.edit).toEqual({ op: "set", path: "basics.picture", value: null });

		const back = strict(none.data, [{ op: "set", path: "basics.picture", value: "resume" }]);
		expect("picture" in back.data.basics).toBe(false);
		expect(back.applied[0]?.edit.op === "set" && back.applied[0].edit.value).toBe("resume");
	});

	it("writes keyed paths, including a resume section key with dots", () => {
		const result = strict(stored(), [
			{ op: "set", path: "sections.titles.experience", value: " Where I've worked " },
			{ op: "set", path: "sections.hiddenItems.experience", value: ["e3"] },
			{ op: "set", path: "sections.titles.resume:a.b", value: "Tools" },
			{ op: "set", path: "sections.titles.experience", value: "" },
		]);
		expect(result.failed).toEqual([]);
		expect(result.data.sections.titles).toEqual({ "resume:a.b": "Tools" });
		expect(result.data.sections.hiddenItems).toEqual({ experience: ["e3"] });
		expect(result.applied[3]?.inverse).toEqual([
			{ op: "set", path: "sections.titles.experience", value: "Where I've worked" },
		]);
	});

	it("resets a defaulted field with null, and cleans a WhatsApp number", () => {
		const result = strict(stored(), [
			{ op: "set", path: "hero.greeting", value: null },
			{ op: "set", path: "contact.whatsapp", value: { show: true, number: "+62 812-5550-1824" } },
		]);
		expect(result.failed).toEqual([]);
		expect(result.data.hero.greeting).toBe("");
		expect(result.data.contact.whatsapp).toEqual({ show: true, number: "6281255501824" });
	});

	it("refuses paths it can't set and values the write schema refuses, naming the field", () => {
		const result = strict(stored(), [
			{ op: "set", path: "works", value: [] },
			{ op: "set", path: "theme", value: "glossy" },
			{ op: "set", path: "seo.title", value: "x".repeat(71) },
			{ op: "set", path: "hero.buttons", value: [{ kind: "link" }] },
		]);
		expect(result.applied).toEqual([]);
		expect(result.failed[0]?.error).toContain("This field can't be set");
		expect(result.failed[1]?.error).toContain('theme: use one of: "lugas"');
		expect(result.failed[2]?.error).toBe("seo › title: at most 70 characters");
		expect(result.failed[3]?.error).toContain('a link button needs "url"');
	});
});

describe("rich text", () => {
	it("cleans HTML and turns plain text into paragraphs", () => {
		const result = strict(stored(), [
			{ op: "set", path: "about.content", value: '<p onclick="x()">Hi <script>alert(1)</script><b>there</b></p>' },
			{
				op: "add",
				list: "blocks",
				workId: "w2",
				item: { type: "text", html: "First line\nsecond line\n\nNew <paragraph> & more" },
			},
		]);
		expect(result.failed).toEqual([]);
		expect(result.data.about.content).toBe("<p>Hi <strong>there</strong></p>");
		expect(work(result.data, "w2")?.blocks[0]).toEqual({
			id: "id-1",
			type: "text",
			html: "<p>First line<br />second line</p><p>New &lt;paragraph&gt; &amp; more</p>",
		});
	});

	it("refuses text past a field's limit, saying how long it is", () => {
		const result = strict(stored(), [
			{ op: "set", path: "about.content", value: "a".repeat(5001) },
			{ op: "add", list: "custom", item: { title: "Notes", content: `<p>${"b".repeat(5001)}</p>` } },
		]);
		expect(result.failed[0]?.error).toBe("about.content: at most 5000 characters of text (this has 5001). Shorten it.");
		expect(result.failed[1]?.error).toContain("at most 5000 characters of text (this has 5001)");
	});

	it("refuses rich text far over any field's markup before cleaning it", () => {
		const huge = `<p>${"<b>x</b>".repeat(500_000)}</p>`;
		const started = performance.now();
		const result = strict(stored(), [
			{ op: "set", path: "about.content", value: huge },
			{ op: "set", path: "about.content", value: "c".repeat(5000 * RICH_TEXT_MARKUP_FACTOR + 1) },
		]);
		expect(result.applied).toEqual([]);
		expect(result.failed.map((failure) => failure.error)).toEqual([
			`about.content: far too long (${huge.length} characters with markup). At most 5000 characters of text.`,
			`about.content: far too long (${5000 * RICH_TEXT_MARKUP_FACTOR + 1} characters with markup). At most 5000 characters of text.`,
		]);
		// Four megabytes of markup would take seconds to clean; refused unread, it takes next to nothing.
		expect(performance.now() - started).toBeLessThan(500);
		// Input within the bound is read: judged by its text, then by its markup once cleaned (<b> becomes <strong>).
		const marked = strict(stored(), [
			{ op: "set", path: "about.content", value: `<p>${"<strong>x</strong> ".repeat(2000)}</p>` },
			{ op: "set", path: "about.content", value: `<p>${"<b>x</b>".repeat(4000)}</p>` },
		]);
		expect(marked.applied.map((edit) => edit.index)).toEqual([0]);
		expect(marked.failed[0]?.error).toBe(
			"about.content: too much markup for its text (72007 characters with tags, at most 40000). Use fewer tags.",
		);
	});
});

const LIST_CASES = [
	{
		list: "works",
		target: {},
		item: { title: "Lumen redesign" },
		fields: { summary: "Calmer checkout." },
		label: 'work "Lumen redesign"',
	},
	{
		list: "services",
		target: {},
		item: { title: "Design sprint" },
		fields: { price: "From Rp10m" },
		label: 'service "Design sprint"',
	},
	{
		list: "testimonials",
		target: {},
		item: { quote: "Sharp and kind.", name: "Rani", consent: true },
		fields: { role: "PM at Lumen" },
		label: 'testimonial from "Rani"',
	},
	{
		list: "clients",
		target: {},
		item: { name: "Lumen", logo: { brandIcon: "github" } },
		fields: { url: "https://lumen.example.test" },
		label: 'client "Lumen"',
	},
	{
		list: "custom",
		target: {},
		item: { title: "Talks", content: "I speak at meetups." },
		fields: { hidden: true },
		label: 'section "Talks"',
	},
	{
		list: "highlights",
		target: {},
		item: { label: "Clients", value: 30 },
		fields: { suffix: "+" },
		label: 'highlight "Clients"',
	},
	{
		list: "blocks",
		target: { workId: "w1" },
		item: { type: "link", url: "https://lumen.example.test", title: "Live site" },
		fields: { description: "The shipped app." },
		label: 'link block "Live site"',
	},
	{
		list: "metrics",
		target: { workId: "w1", blockId: "b3" },
		item: { label: "Load time", value: 1.2, format: "plain", suffix: "s" },
		fields: { context: "On 4G" },
		label: 'metric "Load time"',
	},
] as const;

describe.each(LIST_CASES)("$list", ({ list, target, item, fields, label }) => {
	it("adds, updates, moves and removes an item, each undone by its inverse", () => {
		const before = stored();
		const result = strict(before, [
			{ op: "add", list, ...target, ref: "new", item },
			{ op: "update", list, ...target, id: "new", fields },
			{ op: "move", list, ...target, id: "new", to: "first" },
			{ op: "remove", list, ...target, id: "new" },
		]);
		expect(result.failed).toEqual([]);
		expect(result.applied.map((entry) => entry.summary)).toEqual([
			expect.stringContaining(`Added ${label}`),
			expect.stringContaining(`Updated ${label}`),
			expect.stringContaining(`Moved ${label}`),
			expect.stringContaining(`Removed ${label}`),
		]);
		expect(result.applied[0]).toMatchObject({ id: "id-1", ref: "new", refs: { new: "id-1" } });
		// Every resolved edit names the item by its id, never the ref.
		for (const applied of result.applied.slice(1)) expect(applied.edit).toMatchObject({ id: "id-1" });
		expect(result.data).toEqual(before);

		// Step by step, each edit's inverse gives back the data before it.
		let current = before;
		for (const applied of result.applied) {
			const next = applyPortfolioEdits(current, [applied.edit], { mode: "replay" });
			expect(next.failed).toEqual([]);
			const undone = applyPortfolioEdits(next.data, applied.inverse, { mode: "replay" });
			expect(undone.failed).toEqual([]);
			expect(undone.data).toEqual(current);
			current = next.data;
		}
	});

	it("refuses an unknown id, naming what to read again", () => {
		const result = strict(stored(), [{ op: "remove", list, ...target, id: "nope" }]);
		expect(result.failed[0]?.error).toContain('has the id "nope"');
		expect(result.failed[0]?.error).toContain("Use an id from the portfolio as you last read it");
	});

	it("refuses an id in a new item and unknown fields", () => {
		const result = strict(stored(), [
			{ op: "add", list, ...target, item: { ...item, id: "mine" } },
			{ op: "add", list, ...target, item: { ...item, colour: "red" } },
		]);
		expect(result.failed[0]?.error).toContain('leave out "id"');
		expect(result.failed[1]?.error).toContain('unknown field "colour"');
	});
});

describe("works", () => {
	it("gives a new work its own address from its title", () => {
		const result = strict(stored(), [
			{ op: "add", list: "works", item: { title: "Kopi app" } },
			{ op: "add", list: "works", item: { title: "Kopi app" } },
		]);
		expect(result.data.works.items.slice(-2).map((item) => item.slug)).toEqual(["kopi-app-2", "kopi-app-3"]);
		expect(result.applied[0]?.edit).toMatchObject({ item: { slug: "kopi-app-2", previousSlugs: [] } });
	});

	it("moves an automatic address with the title, keeping the saved one as a previous address", () => {
		const added = strict(stored(), [
			{ op: "add", list: "works", ref: "lumen", item: { title: "Lumen" } },
			{ op: "update", list: "works", id: "lumen", fields: { title: "Lumen app" } },
		]);
		// Not saved yet when renamed: no old address to forward.
		expect(work(added.data, "id-1")).toMatchObject({ slug: "lumen-app", previousSlugs: [] });

		const renamed = strict(added.data, [
			{ op: "update", list: "works", id: "id-1", fields: { title: "Lumen checkout" } },
		]);
		expect(work(renamed.data, "id-1")).toMatchObject({ slug: "lumen-checkout", previousSlugs: ["lumen-app"] });
		expect(renamed.applied[0]?.edit).toEqual({
			op: "update",
			list: "works",
			id: "id-1",
			fields: { title: "Lumen checkout", slug: "lumen-checkout", previousSlugs: ["lumen-app"] },
		});

		// An address typed by hand (w2's "no-cover") stays when the title changes.
		const kept = strict(stored(), [{ op: "update", list: "works", id: "w2", fields: { title: "Pictures later" } }]);
		expect(work(kept.data, "w2")?.slug).toBe("no-cover");
	});

	it("changes an address on request, at most five old ones kept, refusing a taken or malformed one", () => {
		const data = stored();
		const result = strict(data, [
			{ op: "update", list: "works", id: "w1", fields: { slug: "coffee" } },
			{ op: "update", list: "works", id: "w1", fields: { slug: "coffee-2" } },
			{ op: "update", list: "works", id: "w1", fields: { slug: "coffee-3" } },
			{ op: "update", list: "works", id: "w1", fields: { slug: "coffee-4" } },
			{ op: "update", list: "works", id: "w1", fields: { slug: "no-cover" } },
			{ op: "update", list: "works", id: "w1", fields: { slug: "Not OK" } },
		]);
		expect(result.failed.map((entry) => entry.index)).toEqual([4, 5]);
		expect(result.failed[0]?.error).toContain('the address "no-cover" is taken by work "Work without pictures"');
		expect(result.failed[1]?.error).toContain("lowercase letters and digits");
		// Only the first change moved a saved address; the others were made in this call.
		expect(work(result.data, "w1")).toMatchObject({
			slug: "coffee-4",
			previousSlugs: ["kopi-app", "coffee-app", "kopi"],
		});

		const again = strict(result.data, [{ op: "update", list: "works", id: "w1", fields: { slug: "kopi-app" } }]);
		expect(work(again.data, "w1")).toMatchObject({
			slug: "kopi-app",
			previousSlugs: ["coffee-4", "coffee-app", "kopi"],
		});
	});

	it("refuses the fields an update never sets", () => {
		const result = strict(stored(), [
			{ op: "update", list: "works", id: "w1", fields: { blocks: [] } },
			{ op: "update", list: "works", id: "w1", fields: { previousSlugs: [] } },
			{ op: "update", list: "works", id: "w1", fields: { fromResumeItemId: "p1" } },
			{ op: "update", list: "works", id: "w1", fields: { id: "w9" } },
			{ op: "update", list: "works", id: "w1", fields: { title: "" } },
			{ op: "add", list: "works", item: { title: "X", slug: "x" } },
			{ op: "add", list: "works", item: { summary: "No title" } },
		]);
		expect(result.applied).toEqual([]);
		expect(result.failed.map((entry) => entry.error)).toEqual([
			expect.stringContaining('"blocks" can\'t be set here'),
			expect.stringContaining('"previousSlugs" can\'t be set here'),
			expect.stringContaining('"fromResumeItemId" can\'t be set here'),
			expect.stringContaining('leave out "id"'),
			expect.stringContaining('a work needs a "title"'),
			expect.stringContaining('"slug" can\'t be set here'),
			expect.stringContaining('a work needs a "title"'),
		]);
	});

	it("creates a work with blocks whose refs later edits and its own card use", () => {
		const result = strict(stored(), [
			{
				op: "add",
				list: "works",
				ref: "lumen",
				item: {
					title: "Lumen",
					cover: { key: upload.key, alt: "Lumen screens", focus: { x: 0.5, y: 0.2 } },
					highlightMetricId: "conv",
					blocks: [
						{ type: "text", html: "<h2>Problem</h2><p>Too many steps.</p>" },
						{
							type: "metrics",
							ref: "results",
							items: [{ ref: "conv", label: "Conversion", value: 2.8, format: "percent" }],
						},
						{ type: "video", url: "https://youtu.be/dQw4w9WgXcQ", title: "Demo" },
						{ type: "embed", url: "https://www.figma.com/design/AbCdEf0123456789/Lumen?node-id=1:2" },
						{ type: "images", images: [{ key: upload.key, caption: "Home" }] },
					],
				},
			},
			{
				op: "add",
				list: "metrics",
				workId: "lumen",
				blockId: "results",
				item: { label: "Revenue", value: 12, format: "compact" },
			},
			{ op: "move", list: "blocks", workId: "lumen", id: "results", to: "first" },
		]);
		expect(result.failed).toEqual([]);
		expect(result.applied[0]?.refs).toEqual({ results: "id-3", conv: "id-4", lumen: "id-1" });
		const lumen = work(result.data, "id-1");
		expect(lumen).toMatchObject({
			slug: "lumen",
			highlightMetricId: "id-4",
			cover: { ...upload, alt: "Lumen screens", focus: { x: 0.5, y: 0.2 } },
		});
		expect(lumen?.blocks.map((block) => block.type)).toEqual(["metrics", "text", "video", "embed", "images"]);
		expect(lumen?.blocks[2]).toEqual({
			id: "id-5",
			type: "video",
			provider: "youtube",
			videoId: "dQw4w9WgXcQ",
			title: "Demo",
			thumbnailUrl: "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
		});
		expect(lumen?.blocks[3]).toEqual({
			id: "id-6",
			type: "embed",
			provider: "figma",
			ref: "design/AbCdEf0123456789?node-id=1-2",
		});
		expect(lumen?.blocks[4]).toEqual({
			id: "id-7",
			type: "images",
			images: [{ ...upload, caption: "Home" }],
			layout: "full",
		});
	});

	it("refuses PDF blocks, links no player takes, a changed block type, and metrics changed through their block", () => {
		const result = strict(stored(), [
			{ op: "add", list: "blocks", workId: "w1", item: { type: "pdf", title: "Deck" } },
			{ op: "add", list: "blocks", workId: "w1", item: { type: "video", url: "https://example.test/video" } },
			{ op: "add", list: "blocks", workId: "w1", item: { type: "embed", url: "https://example.test" } },
			{ op: "update", list: "blocks", workId: "w1", id: "b1", fields: { type: "images" } },
			{ op: "update", list: "blocks", workId: "w1", id: "b3", fields: { items: [] } },
			{ op: "update", list: "blocks", workId: "w1", id: "b6", fields: { title: "Case study" } },
		]);
		expect(result.failed.map((entry) => entry.error)).toEqual([
			expect.stringContaining("PDF blocks can't be added here"),
			expect.stringContaining("isn't a YouTube or Vimeo video link"),
			expect.stringContaining("isn't a link that can be embedded"),
			expect.stringContaining("a block's type can't change"),
			expect.stringContaining("metrics list"),
		]);
		expect(result.applied.map((entry) => entry.summary)).toEqual([
			'Updated pdf block "Case study" in work "Coffee ordering app": title',
		]);
	});

	it("replaces a video's link, dropping the old thumbnail", () => {
		const result = strict(stored(), [
			{
				op: "update",
				list: "blocks",
				workId: "w1",
				id: "b4",
				fields: { url: "https://vimeo.com/76979871/9f2c1a7b3d" },
			},
		]);
		expect(result.failed).toEqual([]);
		expect(work(result.data, "w1")?.blocks[3]).toEqual({
			id: "b4",
			type: "video",
			provider: "vimeo",
			videoId: "76979871",
			hash: "9f2c1a7b3d",
			title: "Checkout demo",
		});
		expect(result.applied[0]?.edit).toMatchObject({
			fields: { provider: "vimeo", videoId: "76979871", hash: "9f2c1a7b3d", thumbnailUrl: null, thumbnail: null },
		});
	});

	it("checks metric formats need their unit, and drops a unit the format doesn't use", () => {
		const result = strict(stored(), [
			{ op: "add", list: "highlights", item: { label: "Revenue", value: 5, format: "currency" } },
			{ op: "update", list: "metrics", workId: "w1", blockId: "b3", id: "m2", fields: { format: "compact" } },
		]);
		expect(result.failed[0]?.error).toContain('the currency format needs "currency"');
		expect(result.applied[0]?.edit).toMatchObject({ fields: { format: "compact", currency: null } });
	});
});

describe("refs and failures", () => {
	it("refuses a ref that is an existing id or already used", () => {
		const result = strict(stored(), [
			{ op: "add", list: "services", ref: "s1", item: { title: "Audit" } },
			{ op: "add", list: "services", ref: "x", item: { title: "Audit" } },
			{ op: "add", list: "services", ref: "x", item: { title: "Sprint" } },
		]);
		expect(result.failed.map((entry) => entry.index)).toEqual([0, 2]);
		expect(result.failed[0]?.error).toContain('"s1" is already an item\'s id');
		expect(result.failed[1]?.error).toContain('the ref "x" is already used');
	});

	it("tells a later edit when the add its ref named failed", () => {
		const result = strict(stored(), [
			{ op: "add", list: "works", ref: "lumen", item: { title: "x".repeat(101) } },
			{ op: "update", list: "works", id: "lumen", fields: { summary: "Hi" } },
		]);
		expect(result.failed[0]?.error).toContain('works › "');
		expect(result.failed[0]?.error).toContain("title: at most 100 characters");
		expect(result.failed[1]?.error).toBe(
			'"lumen" names the item edit #0 was to add, and that edit failed. Fix that edit first.',
		);
	});

	it("keeps going after a failed edit, leaving valid data", () => {
		const result = strict(stored(), [
			{ op: "update", list: "works", id: "w1", fields: { summary: "Short." } },
			{ op: "update", list: "works", id: "w2", fields: { summary: "y".repeat(241) } },
			{ op: "add", list: "services", item: { title: "Workshop" } },
			{ op: "nonsense" },
		]);
		expect(result.applied.map((entry) => entry.index)).toEqual([0, 2]);
		expect(result.failed).toEqual([
			{ index: 1, error: 'works › "Work without pictures" › summary: at most 240 characters' },
			{ index: 3, error: expect.stringContaining("This edit isn't in the edit language") },
		]);
		expect(work(result.data, "w2")?.summary).toBe("");
		expect(parseWritablePortfolioData(result.data)).toEqual(result.data);
	});

	it("refuses an add to a full list", () => {
		const data = stored();
		data.hero.highlights.push({ id: "h4", label: "Four", value: { kind: "number", number: 4 }, format: "plain" });
		const result = strict(data, [{ op: "add", list: "highlights", item: { label: "Five", value: 5 } }]);
		expect(result.failed[0]?.error).toBe("highlights is full: at most 4. Remove one first.");
	});

	it("says when the data was wrong before the edit", () => {
		const data = stored();
		(work(data, "w2") as { summary: string }).summary = "z".repeat(300);
		const result = strict(data, [{ op: "add", list: "services", item: { title: "Workshop" } }]);
		expect(result.failed[0]?.error).toContain("(already wrong before this edit: fix it first)");
	});
});

describe("images", () => {
	it("places only images the portfolio has or the uploads given", () => {
		const result = strict(stored(), [
			{
				op: "update",
				list: "works",
				id: "w2",
				fields: { cover: { key: "uploads/user-1/pictures/portfolio/ghost.webp" } },
			},
			{ op: "update", list: "works", id: "w2", fields: { cover: { key: upload.key } } },
			{ op: "update", list: "works", id: "w3", fields: { cover: { key: testImage("shot-1").key, alt: "Reused" } } },
		]);
		expect(result.failed).toEqual([
			{
				index: 0,
				error: expect.stringContaining(
					"isn't one of this portfolio's images. Use a key from the portfolio's images or uploads",
				),
			},
		]);
		expect(work(result.data, "w2")?.cover).toEqual(upload);
		expect(work(result.data, "w3")?.cover).toEqual({ ...testImage("shot-1"), alt: "Reused" });
	});

	it("takes full image objects as given when replaying", () => {
		const image = testImage("elsewhere");
		const result = applyPortfolioEdits(
			stored(),
			[{ op: "update", list: "works", id: "w2", fields: { cover: image } }],
			{
				mode: "replay",
			},
		);
		expect(result.failed).toEqual([]);
		expect(work(result.data, "w2")?.cover).toEqual(image);
	});
});

const FREE: PortfolioEditPlan = {
	name: "Free",
	maxWorks: 3,
	features: { premiumPortfolioThemes: false, premiumHeroEffects: false, hidePortfolioCredit: false },
};

describe("plan", () => {
	it("refuses Plus features and works past the plan's limit, telling the model to suggest instead", () => {
		const result = strict(
			stored(),
			[
				{ op: "set", path: "theme", value: "kanvas" },
				{ op: "set", path: "hero.effect", value: "typewriter" },
				{ op: "set", path: "credit.show", value: false },
				{ op: "add", list: "works", item: { title: "Fourth" } },
				{ op: "set", path: "theme", value: "prima" },
			],
			{ plan: FREE },
		);
		expect(result.applied.map((entry) => entry.index)).toEqual([4]);
		expect(result.failed.map((entry) => entry.error)).toEqual([
			"The Kanvas theme needs Plus and the Free plan doesn't include it. Don't apply it: tell the user it needs Plus and suggest it instead. The free themes are Lugas or Prima.",
			expect.stringContaining('The "typewriter" intro effect needs Plus and the Free plan'),
			expect.stringContaining('Hiding the "Made with Rezumi" badge needs Plus'),
			"The Free plan allows 3 works and the portfolio has 3. Don't add more: tell the user, and suggest removing a work, or Plus for more works.",
		]);
	});

	it("keeps what the portfolio already has, even after leaving it within the call", () => {
		const data = parseWritablePortfolioData({
			...stored(),
			theme: "kanvas",
			hero: { ...stored().hero, effect: { id: "vector-hover" } },
		});
		const result = strict(
			data,
			[
				{ op: "add", list: "services", item: { title: "Audit" } },
				{ op: "set", path: "theme", value: "lugas" },
				{ op: "set", path: "theme", value: "kanvas" },
				{ op: "set", path: "hero.effect", value: "vector-hover" },
			],
			{ plan: FREE },
		);
		expect(result.failed).toEqual([]);
	});

	it("checks nothing without a plan, or when replaying", () => {
		const edits = [
			{ op: "set", path: "theme", value: "kanvas" },
			{ op: "set", path: "credit.show", value: false },
		];
		expect(strict(stored(), edits, { plan: null }).failed).toEqual([]);
		expect(strict(stored(), edits).failed).toEqual([]);
		expect(applyPortfolioEdits(stored(), edits as PortfolioEdit[], { mode: "replay", plan: FREE }).failed).toEqual([]);
	});
});

describe("cross-references", () => {
	it("clears a work's highlight when its metric or Metrics block goes, and the inverse brings it back", () => {
		for (const edit of [
			{ op: "remove", list: "metrics", workId: "w1", blockId: "b3", id: "m1" },
			{ op: "remove", list: "blocks", workId: "w1", id: "b3" },
		]) {
			const data = stored();
			const result = strict(data, [edit]);
			expect(result.failed).toEqual([]);
			expect(work(result.data, "w1")?.highlightMetricId).toBeUndefined();
			expect(result.applied[0]?.inverse.at(-1)).toEqual({
				op: "update",
				list: "works",
				id: "w1",
				fields: { highlightMetricId: "m1" },
			});
			expect(applyPortfolioEdits(result.data, result.applied[0]?.inverse ?? [], { mode: "replay" }).data).toEqual(data);
		}
	});

	it("keeps a Metrics block's last metric", () => {
		const result = strict(stored(), [
			{ op: "remove", list: "metrics", workId: "w1", blockId: "b3", id: "m2" },
			{ op: "remove", list: "metrics", workId: "w1", blockId: "b3", id: "m1" },
		]);
		expect(result.failed[0]).toMatchObject({ index: 1, error: expect.stringContaining("Remove the block instead") });
	});

	it("adds a new section to a custom order before Contact, and a removed one leaves order, hidden and titles", () => {
		const data = parseWritablePortfolioData({
			...stored(),
			sections: {
				order: ["work", "about", "custom:x1", "contact"],
				hidden: ["custom:x1"],
				titles: { "custom:x1": "Notes" },
			},
		});
		const result = strict(data, [
			{ op: "add", list: "custom", item: { title: "Talks", content: "Meetups." } },
			{ op: "remove", list: "custom", id: "x1" },
		]);
		expect(result.failed).toEqual([]);
		expect(result.data.sections).toEqual({
			order: ["work", "about", "custom:id-1", "contact"],
			hidden: [],
			titles: {},
			hiddenItems: {},
		});
		let undone = result.data;
		for (const applied of [...result.applied].reverse())
			undone = applyPortfolioEdits(undone, applied.inverse, { mode: "replay" }).data;
		expect(undone).toEqual(data);

		// With the theme's order, a new section already shows before Contact.
		expect(strict(stored(), [{ op: "add", list: "custom", item: { title: "Talks" } }]).data.sections.order).toEqual([]);
	});
});

describe("testimonials", () => {
	it("need consent, given after the user confirmed", () => {
		const result = strict(stored(), [
			{ op: "add", list: "testimonials", item: { quote: "Great.", name: "Rani" } },
			{ op: "add", list: "testimonials", item: { quote: "Great.", name: "Rani", consent: false } },
			{ op: "update", list: "testimonials", id: "t1", fields: { consent: false } },
			{ op: "add", list: "testimonials", item: { quote: "Great.", name: "Rani", consent: true } },
		]);
		expect(result.failed.map((entry) => entry.index)).toEqual([0, 1, 2]);
		expect(result.failed[0]?.error).toContain('"consent": true, set only after the user confirmed');
		expect(result.data.testimonials.items.at(-1)).toEqual({
			id: "id-1",
			quote: "Great.",
			name: "Rani",
			role: "",
			consent: true,
		});
	});
});

describe("properties", () => {
	/** Every op on every list, refs across edits, and set paths, on the realistic fixture. */
	const SCRIPT: unknown[] = [
		{ op: "set", path: "theme", value: "prima" },
		{ op: "set", path: "design.fonts", value: "manrope" },
		{ op: "set", path: "basics.headline", value: "Product designer" },
		{ op: "set", path: "basics.picture", value: { key: upload.key, alt: "Portrait" } },
		{ op: "set", path: "about.content", value: "Calm apps.\n\nFor busy people." },
		{ op: "set", path: "sections.order", value: ["work", "about", "experience", "contact"] },
		{ op: "set", path: "sections.hiddenItems.experience", value: ["e3"] },
		{
			op: "set",
			path: "hero.buttons",
			value: [{ kind: "contact" }, { kind: "link", url: "https://x.example.test", label: "Site" }],
		},
		{
			op: "add",
			list: "works",
			ref: "lumen",
			at: { after: "w1" },
			item: {
				title: "Lumen",
				blocks: [
					{
						type: "metrics",
						ref: "results",
						items: [{ ref: "conv", label: "Conversion", value: 3, format: "percent" }],
					},
					{ type: "text", html: "Story." },
				],
				highlightMetricId: "conv",
			},
		},
		{ op: "update", list: "works", id: "lumen", fields: { title: "Lumen app", tags: ["Fintech"] } },
		{ op: "update", list: "works", id: "w1", fields: { slug: "coffee", summary: "Three taps.", cover: null } },
		{ op: "move", list: "works", id: "w3", to: { before: "w1" } },
		{ op: "add", list: "blocks", workId: "w2", ref: "intro", item: { type: "text", html: "<p>Intro</p>" } },
		{
			op: "update",
			list: "blocks",
			workId: "w1",
			id: "b4",
			fields: { title: "Demo", url: "https://youtu.be/aaaaaaaaaaa" },
		},
		{ op: "move", list: "blocks", workId: "w1", id: "b7", to: "first" },
		{ op: "remove", list: "blocks", workId: "w1", id: "b3" },
		{ op: "add", list: "metrics", workId: "lumen", blockId: "results", item: { label: "Users", value: 1200 } },
		{ op: "update", list: "metrics", workId: "lumen", blockId: "results", id: "conv", fields: { value: 3.4 } },
		{ op: "move", list: "metrics", workId: "lumen", blockId: "results", id: "conv", to: "last" },
		{ op: "remove", list: "metrics", workId: "lumen", blockId: "results", id: "conv" },
		{ op: "add", list: "highlights", at: "first", item: { label: "Years", value: 6 } },
		{ op: "update", list: "highlights", id: "h2", fields: { label: "Payments that succeed" } },
		{ op: "remove", list: "highlights", id: "h3" },
		{ op: "add", list: "services", item: { title: "Sprint", cta: { kind: "whatsapp" } } },
		{ op: "remove", list: "services", id: "s1" },
		{
			op: "add",
			list: "testimonials",
			item: { quote: "Kind.", name: "Rani", consent: true, photo: { key: upload.key } },
		},
		{ op: "update", list: "testimonials", id: "t1", fields: { role: null } },
		{ op: "add", list: "clients", at: { before: "c1" }, item: { name: "Lumen", logo: { key: upload.key } } },
		{ op: "move", list: "clients", id: "c2", to: "first" },
		{ op: "remove", list: "clients", id: "c1" },
		{
			op: "add",
			list: "custom",
			ref: "talks",
			item: { title: "Talks", content: "Meetups.", button: { kind: "contact" } },
		},
		{ op: "update", list: "custom", id: "talks", fields: { hidden: true } },
		{ op: "move", list: "custom", id: "talks", to: "first" },
		{ op: "remove", list: "custom", id: "x1" },
		{ op: "remove", list: "works", id: "w2" },
		{ op: "set", path: "sections.titles.custom:talks", value: "Speaking" },
		{ op: "set", path: "sections.order", value: ["custom:talks", "work", "about", "experience", "contact"] },
		{ op: "update", list: "works", id: "nope", fields: {} },
	];

	it("applies the script with only the expected failure, refs resolved in section keys too", () => {
		const result = strict(stored(), SCRIPT);
		expect(result.failed.map((entry) => entry.index)).toEqual([37]);
		const talks = result.applied.find((entry) => entry.ref === "talks")?.id ?? "";
		expect(result.data.sections.titles).toEqual({ [`custom:${talks}`]: "Speaking" });
		expect(result.data.sections.order[0]).toBe(`custom:${talks}`);
		expect(result.applied.at(-2)?.edit).toMatchObject({ path: `sections.titles.custom:${talks}` });
	});

	it("replaying the resolved edits on the same data gives the same data", () => {
		const data = stored();
		const result = strict(data, SCRIPT);
		const replayed = applyPortfolioEdits(
			data,
			result.applied.map((entry) => entry.edit),
			{ mode: "replay" },
		);
		expect(replayed.failed).toEqual([]);
		expect(replayed.data).toEqual(result.data);
		// Replaying makes nothing new: every summary and inverse comes out the same.
		expect(replayed.applied.map((entry) => entry.summary)).toEqual(result.applied.map((entry) => entry.summary));
		expect(replayed.applied.map((entry) => entry.inverse)).toEqual(result.applied.map((entry) => entry.inverse));
	});

	it("applying every inverse, the last edit's first, gives back the original data", () => {
		const data = stored();
		const result = strict(data, SCRIPT);
		const inverse = [...result.applied].reverse().flatMap((entry) => entry.inverse);
		const undone = applyPortfolioEdits(result.data, inverse, { mode: "replay" });
		expect(undone.failed).toEqual([]);
		expect(undone.data).toEqual(data);
	});

	it("works the same on an empty portfolio", () => {
		const data = createDefaultPortfolioData();
		const edits = SCRIPT.slice(0, 9).filter((edit) => !JSON.stringify(edit).includes('"w1"'));
		const result = strict(data, edits);
		expect(result.failed).toEqual([]);
		const undone = applyPortfolioEdits(
			result.data,
			[...result.applied].reverse().flatMap((entry) => entry.inverse),
			{ mode: "replay" },
		);
		expect(undone.data).toEqual(data);
	});
});

describe("portfolioEditItemName", () => {
	it("names the item an edit works on, from the data before it", () => {
		const data = stored();
		const name = (edit: unknown) => portfolioEditItemName(data, edit as PortfolioEdit);
		expect(name({ op: "add", list: "works", item: { title: " Lumen " } })).toBe("Lumen");
		expect(name({ op: "remove", list: "works", id: "w1" })).toBe("Coffee ordering app");
		expect(name({ op: "update", list: "testimonials", id: "t1", fields: {} })).toBe("Damar Wicaksana");
		expect(name({ op: "move", list: "metrics", workId: "w1", blockId: "b3", id: "m2", to: "first" })).toBe("Revenue");
		expect(name({ op: "remove", list: "blocks", workId: "gone", id: "b1" })).toBeNull();
		expect(name({ op: "set", path: "theme", value: "prima" })).toBeNull();
	});
});
