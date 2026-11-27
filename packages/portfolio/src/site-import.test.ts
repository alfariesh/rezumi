import type { PortfolioImage } from "@rezumi/schema/portfolio/files";
import type { WorkDraft } from "@rezumi/schema/profile/website-import";
import { describe, expect, it } from "vite-plus/test";
import { parseWritablePortfolioData } from "@rezumi/schema/portfolio/data";
import { createDefaultPortfolioData } from "@rezumi/schema/portfolio/default";
import { hasWork, isSameWork, metricFromText, projectFromDraft, storyHtml, workFromDraft } from "./site-import";

const draft = (extra: Partial<WorkDraft> = {}): WorkDraft => ({
	id: "w1",
	sourceUrl: "https://dewi.design/work/kopi",
	title: "Kopi checkout",
	summary: "Six steps became three.",
	role: "Lead designer",
	date: "2024",
	tags: ["Mobile", "Product design"],
	description: "The checkout had six steps.\n\nWe cut it to three <and> tested it.",
	metrics: [
		{ label: "Checkout time", value: "-40%" },
		{ label: "Orders", value: "2.5x" },
		{ label: "Rank", value: "#1" },
		{ label: "Revenue", value: "Rp 200 billion a year" },
	],
	cover: { url: "https://dewi.design/img/cover.jpg", alt: "Cover", width: 1600, height: 1000 },
	gallery: [
		{ url: "https://dewi.design/img/a.jpg", alt: "A", width: null, height: null },
		{ url: "https://dewi.design/img/b.jpg", alt: "B", width: null, height: null },
	],
	primaryLink: { url: "https://apps.apple.com/app/kopi", label: "App Store" },
	links: [{ url: "https://medium.com/@dewi/kopi", label: "Write-up" }],
	embeds: ["https://www.youtube.com/watch?v=dQw4w9WgXcQ", "https://www.figma.com/proto/AbCdEf1234567"],
	...extra,
});

const picture = (name: string): PortfolioImage => ({
	key: `uploads/u1/pictures/portfolio/${name}.jpg`,
	width: 1200,
	height: 800,
	alt: name,
});

describe("isSameWork", () => {
	const project = (name: string, url = "") => ({ name, website: { url, label: "", inlineLink: false } });

	it("matches the same link, whatever its spelling", () => {
		expect(isSameWork(project("Something else", "http://www.dewi.design/work/kopi/"), draft())).toBe(true);
		expect(isSameWork(project("", "https://apps.apple.com/app/kopi?ref=x"), draft())).toBe(true);
	});

	it("matches the same name, or one name starting the other at a word boundary", () => {
		expect(isSameWork(project("kopi CHECKOUT!"), draft())).toBe(true);
		expect(isSameWork(project("Rekanesia"), draft({ title: "Rekanesia: one product, many brands" }))).toBe(true);
		expect(isSameWork(project("Rekanesian app"), draft({ title: "Rekanesia" }))).toBe(false);
		// A short name claims nothing.
		expect(isSameWork(project("App"), draft({ title: "App for kopi" }))).toBe(false);
		expect(isSameWork(project(""), draft())).toBe(false);
	});
});

describe("projectFromDraft", () => {
	it("makes a Profile project with the work's own link, or its page on the site", () => {
		expect(projectFromDraft(draft())).toMatchObject({
			hidden: false,
			name: "Kopi checkout",
			period: "2024",
			website: { url: "https://apps.apple.com/app/kopi", label: "App Store", inlineLink: false },
			description: "<p>Six steps became three.</p>",
		});
		expect(projectFromDraft(draft({ primaryLink: null, summary: "" })).website.url).toBe(
			"https://dewi.design/work/kopi",
		);
		expect(projectFromDraft(draft({ primaryLink: null, summary: "" })).description).toBe("");
	});
});

describe("storyHtml", () => {
	it("makes one escaped paragraph per block of text", () => {
		expect(storyHtml(draft().description)).toBe(
			"<p>The checkout had six steps.</p><p>We cut it to three &lt;and&gt; tested it.</p>",
		);
		expect(storyHtml("  \n\n ")).toBe("");
	});

	it("stops at the block's length", () => {
		const html = storyHtml(`${"a ".repeat(6000)}\n\n${"b ".repeat(6000)}`);
		expect(html.replace(/<[^>]+>/g, "").length).toBeLessThanOrEqual(10_000);
	});
});

describe("metricFromText", () => {
	it("reads percentages and multipliers as numbers, short text as text, and drops the rest", () => {
		expect(metricFromText("Checkout time", "-40%")).toMatchObject({
			label: "Checkout time",
			value: { kind: "number", number: 40 },
			format: "percent",
			prefix: "-",
		});
		expect(metricFromText("Conversion", "12,5 %")).toMatchObject({
			value: { kind: "number", number: 12.5 },
			format: "percent",
		});
		expect(metricFromText("Orders", "2.5x")).toMatchObject({
			value: { kind: "number", number: 2.5 },
			format: "multiplier",
		});
		expect(metricFromText("Rank", "#1")).toMatchObject({ value: { kind: "text", text: "#1" }, format: "plain" });
		expect(metricFromText("Revenue", "Rp 200 billion a year")).toBeNull();
		expect(metricFromText("", "40%")).toBeNull();
	});
});

describe("workFromDraft", () => {
	const pictures = new Map([
		["https://dewi.design/img/cover.jpg", picture("cover")],
		["https://dewi.design/img/a.jpg", picture("a")],
	]);

	it("builds a work the portfolio accepts: story, results, pictures, videos and embeds, then links", () => {
		const taken = new Set(["kopi-checkout"]);
		const work = workFromDraft(draft(), pictures, taken, "project-1234");
		expect(work).toMatchObject({
			slug: "kopi-checkout-2",
			title: "Kopi checkout",
			summary: "Six steps became three.",
			role: "Lead designer",
			date: "2024",
			tags: ["Mobile", "Product design"],
			cover: picture("cover"),
			primaryLink: { label: "App Store", url: "https://apps.apple.com/app/kopi" },
			fromResumeItemId: "project-1234",
		});
		expect(work.blocks.map((block) => block.type)).toEqual(["text", "metrics", "images", "video", "embed", "link"]);
		const metrics = work.blocks.find((block) => block.type === "metrics");
		expect(metrics?.type === "metrics" && metrics.items.map((item) => item.label)).toEqual([
			"Checkout time",
			"Orders",
			"Rank",
		]);
		expect(work.highlightMetricId).toBe(metrics?.type === "metrics" ? metrics.items[0]?.id : undefined);
		// The picture that couldn't be copied is left out.
		const images = work.blocks.find((block) => block.type === "images");
		expect(images?.type === "images" && images.images).toEqual([picture("a")]);
		expect(taken.has("kopi-checkout-2")).toBe(true);

		const data = createDefaultPortfolioData();
		expect(() => parseWritablePortfolioData({ ...data, works: { items: [work] } })).not.toThrow();
	});

	it("builds a bare work from a bare draft", () => {
		const work = workFromDraft(
			draft({
				description: "",
				metrics: [],
				cover: null,
				gallery: [],
				primaryLink: null,
				links: [],
				embeds: [],
				tags: [],
			}),
			new Map(),
			new Set(),
		);
		expect(work.blocks).toEqual([]);
		expect(work).not.toHaveProperty("cover");
		expect(work).not.toHaveProperty("primaryLink");
		expect(work).not.toHaveProperty("fromResumeItemId");
	});
});

describe("hasWork", () => {
	it("knows a work copied from the same project, or with the same title", () => {
		expect(hasWork([{ title: "Other", fromResumeItemId: "p1" }], draft(), "p1")).toBe(true);
		expect(hasWork([{ title: "KOPI checkout" }], draft())).toBe(true);
		expect(hasWork([{ title: "Bank app", fromResumeItemId: "p2" }], draft(), "p1")).toBe(false);
	});
});
