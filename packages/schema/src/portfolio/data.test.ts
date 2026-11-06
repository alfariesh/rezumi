import { describe, expect, it } from "vite-plus/test";
import {
	parsePortfolioData,
	parseWritablePortfolioData,
	slugifyPortfolioTitle,
	uniquePortfolioSlug,
	writablePortfolioDataSchema,
} from "./data";
import { createDefaultPortfolioData } from "./default";
import { PORTFOLIO_LIMITS, portfolioDataBytes, richTextLength } from "./limits";

const image = (name = "a") => ({
	key: `uploads/user-1/pictures/portfolio/${name}.webp`,
	width: 1600,
	height: 1200,
	alt: "",
});

const metric = (id: string) => ({ id, label: "Conversion", value: { kind: "number", number: 2.8 }, format: "percent" });

const work = (id: string, extra: Record<string, unknown> = {}) => ({ id, slug: id, title: `Work ${id}`, ...extra });

const issues = (input: unknown) => {
	const result = writablePortfolioDataSchema.safeParse(input as never);
	return result.success ? [] : result.error.issues.map((issue) => issue.path.join("."));
};

describe("portfolio defaults", () => {
	it("fills every field of a new portfolio", () => {
		const data = createDefaultPortfolioData();
		expect(data).toMatchObject({
			version: 1,
			theme: "lugas",
			basics: {},
			design: { accent: { source: "resume" }, fonts: { source: "theme" }, variants: {} },
			hero: { greeting: "", showPicture: true, highlights: [], buttons: [], effect: { target: "name" } },
			about: { content: "" },
			works: { items: [] },
			sections: { order: [], hidden: ["profiles"], titles: {}, hiddenItems: {} },
			location: { showMap: false, workModes: [] },
			contact: { email: true, phone: false, website: true, form: false, profiles: true },
			credit: { show: true },
		});
		expect(data.design.scheme).toBeUndefined();
		expect(data.hero.effect.id).toBeUndefined();
		expect(createDefaultPortfolioData("kanvas").theme).toBe("kanvas");
	});

	it("keeps a new portfolio far below the size limit", () => {
		expect(portfolioDataBytes(createDefaultPortfolioData())).toBeLessThan(4096);
	});
});

describe("reading stored portfolio data", () => {
	it("reads data that isn't a portfolio as an empty one", () => {
		for (const value of [null, "text", 42, []]) expect(parsePortfolioData(value).theme).toBe("lugas");
	});

	it("falls back to defaults for broken fields instead of failing", () => {
		const data = parsePortfolioData({
			theme: "retired-theme",
			locale: "xx-XX",
			design: { accent: { source: "preset", id: "neon" }, scheme: "sepia" },
			hero: { greeting: 42, showPicture: "yes", effect: { id: "sparkles" } },
			contact: { whatsapp: { show: true, number: "+62 812" } },
		});
		expect(data.theme).toBe("lugas");
		expect(data.locale).toBeUndefined();
		expect(data.design.accent).toEqual({ source: "resume" });
		expect(data.design.scheme).toBeUndefined();
		expect(data.hero.greeting).toBe("");
		expect(data.hero.showPicture).toBe(true);
		expect(data.hero.effect.id).toBeUndefined();
		expect(data.contact.whatsapp).toEqual({ show: true, number: "" });
	});

	it("drops broken, repeated and unknown items but keeps the rest", () => {
		const data = parsePortfolioData({
			works: {
				items: [
					work("one", {
						blocks: [
							{ id: "b1", type: "text", html: "<p>Hi</p>" },
							{ id: "b2", type: "hologram", source: "future editor" },
							{ id: "b3", type: "video", provider: "youtube", videoId: "not valid!" },
							{ id: "b1", type: "text", html: "<p>Repeated</p>" },
						],
					}),
					{ title: "No id" },
					work("one"),
					work("two"),
				],
			},
			testimonials: { items: [{ id: "t1", quote: "Great", name: "Ana" }] },
		});
		expect(data.works.items.map((item) => item.id)).toEqual(["one", "two"]);
		expect(data.works.items[0]?.blocks).toEqual([{ id: "b1", type: "text", html: "<p>Hi</p>" }]);
		// A testimonial without its author's consent never shows.
		expect(data.testimonials.items).toEqual([]);
	});

	it("doesn't apply write limits to data saved before them", () => {
		const long = "a".repeat(PORTFOLIO_LIMITS.text.greeting + 40);
		expect(parsePortfolioData({ hero: { greeting: long } }).hero.greeting).toBe(long);
	});

	it("drops a highlighted metric the work no longer has, and repairs work addresses", () => {
		const data = parsePortfolioData({
			works: {
				items: [
					work("a", { slug: "Not A Slug", title: "Café Ordering", highlightMetricId: "gone" }),
					work("b", { slug: "cafe-ordering", title: "Other" }),
					work("c", { slug: "cafe-ordering", title: "Third" }),
				],
			},
		});
		expect(data.works.items[0]?.highlightMetricId).toBeUndefined();
		expect(data.works.items.map((item) => item.slug)).toEqual(["cafe-ordering-2", "cafe-ordering", "third"]);
	});

	it("keeps variants, section keys and titles it knows and drops the rest", () => {
		const data = parsePortfolioData({
			design: { variants: { work: "grid-2", metric: "ba", hero: "spinning", nav: "sticky" } },
			sections: {
				order: ["work", "about", "work", "nope", "custom:abc", "resume:0193-abc"],
				titles: { work: "Case studies", bogus: "X" },
			},
		});
		expect(data.design.variants).toEqual({ work: "grid-2", metric: "ba" });
		expect(data.sections.order).toEqual(["work", "about", "custom:abc", "resume:0193-abc"]);
		expect(data.sections.titles).toEqual({ work: "Case studies" });
	});
});

describe("checking portfolio data before saving", () => {
	it("fills in defaults for fields a client leaves out", () => {
		const data = parseWritablePortfolioData({ works: { items: [{ id: "w1", slug: "w1" }] } });
		expect(data.works.items[0]).toMatchObject({ title: "", blocks: [], featured: false, hidden: false, tags: [] });
		expect(data.contact.email).toBe(true);
	});

	it("drops blocks of a kind it doesn't know and checks the others", () => {
		const data = parseWritablePortfolioData({
			works: {
				items: [
					work("w", {
						blocks: [
							{ id: "x", type: "hologram" },
							{ id: "t", type: "text", html: "" },
						],
					}),
				],
			},
		});
		expect(data.works.items[0]?.blocks).toEqual([{ id: "t", type: "text", html: "" }]);
		expect(
			issues({
				works: { items: [work("w", { blocks: [{ id: "v", type: "video", provider: "vimeo", videoId: "abc" }] })] },
			}),
		).toEqual(["works.items.0.blocks.0.videoId"]);
	});

	it("enforces text limits, counting visible text in rich text", () => {
		expect(issues({ hero: { greeting: "a".repeat(PORTFOLIO_LIMITS.text.greeting) } })).toEqual([]);
		expect(issues({ hero: { greeting: "a".repeat(PORTFOLIO_LIMITS.text.greeting + 1) } })).toEqual(["hero.greeting"]);
		const about = `<p><strong>${"a".repeat(PORTFOLIO_LIMITS.text.about)}</strong></p>`;
		expect(richTextLength(about)).toBe(PORTFOLIO_LIMITS.text.about);
		expect(issues({ about: { content: about } })).toEqual([]);
		expect(issues({ about: { content: `${about}<p>b</p>` } })).toEqual(["about.content"]);
	});

	it("enforces list limits", () => {
		const works = Array.from({ length: PORTFOLIO_LIMITS.works + 1 }, (_, index) => work(`w${index}`));
		expect(issues({ works: { items: works } })).toEqual(["works.items"]);
		expect(issues({ works: { items: works.slice(1) } })).toEqual([]);
		const blocks = Array.from({ length: PORTFOLIO_LIMITS.blocksPerWork + 1 }, (_, index) => ({
			id: `b${index}`,
			type: "text",
			html: "",
		}));
		expect(issues({ works: { items: [work("w", { blocks })] } })).toEqual(["works.items.0.blocks"]);
		expect(issues({ hero: { highlights: ["a", "b", "c", "d", "e"].map(metric) } })).toEqual(["hero.highlights"]);
	});

	it("holds 1 to 12 pictures and 1 to 4 metrics per block, with a caption limit", () => {
		const pictures = (count: number) =>
			Array.from({ length: count }, (_, index) => ({ ...image(`p${index}`), caption: "" }));
		const metrics = (count: number) => Array.from({ length: count }, (_, index) => metric(`m${index}`));
		const block = (extra: Record<string, unknown>) => ({ works: { items: [work("w", { blocks: [extra] })] } });
		const images = (count: number) => block({ id: "g", type: "images", images: pictures(count), layout: "grid" });
		const numbers = (count: number) => block({ id: "n", type: "metrics", items: metrics(count) });

		expect(issues(images(PORTFOLIO_LIMITS.imagesPerBlock))).toEqual([]);
		expect(issues(images(PORTFOLIO_LIMITS.imagesPerBlock + 1))).toEqual(["works.items.0.blocks.0.images"]);
		expect(issues(images(0))).toEqual(["works.items.0.blocks.0.images"]);
		expect(issues(numbers(PORTFOLIO_LIMITS.metricsPerBlock))).toEqual([]);
		expect(issues(numbers(PORTFOLIO_LIMITS.metricsPerBlock + 1))).toEqual(["works.items.0.blocks.0.items"]);
		expect(issues(numbers(0))).toEqual(["works.items.0.blocks.0.items"]);
		expect(
			issues(
				block({
					id: "g",
					type: "images",
					images: [{ ...image(), caption: "c".repeat(PORTFOLIO_LIMITS.text.caption + 1) }],
				}),
			),
		).toEqual(["works.items.0.blocks.0.images.0.caption"]);
		expect(issues(block({ id: "g", type: "images", images: pictures(1), layout: "mosaic" }))).toEqual([
			"works.items.0.blocks.0.layout",
		]);

		// Stored data over the limits still reads, cut to them.
		const stored = parsePortfolioData({
			works: {
				items: [
					work("w", {
						blocks: [
							{ id: "g", type: "images", images: pictures(15), layout: "grid" },
							{ id: "n", type: "metrics", items: metrics(6) },
						],
					}),
				],
			},
		});
		const [gallery, group] = stored.works.items[0]?.blocks ?? [];
		expect(gallery?.type === "images" && gallery.images).toHaveLength(PORTFOLIO_LIMITS.imagesPerBlock);
		expect(group?.type === "metrics" && group.items).toHaveLength(PORTFOLIO_LIMITS.metricsPerBlock);
	});

	it("needs each item to have its own id and each work its own address", () => {
		expect(issues({ works: { items: [work("a"), work("a", { slug: "other" })] } })).toEqual(["works.items.1.id"]);
		expect(issues({ works: { items: [work("a"), work("b", { slug: "a" })] } })).toEqual(["works.items.1.slug"]);
		expect(issues({ works: { items: [work("a", { slug: "Not A Slug" })] } })).toEqual(["works.items.0.slug"]);
	});

	it("needs a highlighted metric to come from the work's Metrics blocks", () => {
		const blocks = [{ id: "m", type: "metrics", items: [metric("conversion")] }];
		expect(issues({ works: { items: [work("a", { blocks, highlightMetricId: "conversion" })] } })).toEqual([]);
		expect(issues({ works: { items: [work("a", { blocks, highlightMetricId: "missing" })] } })).toEqual([
			"works.items.0.highlightMetricId",
		]);
	});

	it("refuses a testimonial its author didn't agree to show", () => {
		const testimonial = { id: "t", quote: "Great work", name: "Ana", role: "PM" };
		expect(issues({ testimonials: { items: [testimonial] } })).toEqual(["testimonials.items.0.consent"]);
		expect(issues({ testimonials: { items: [{ ...testimonial, consent: false }] } })).toEqual([
			"testimonials.items.0.consent",
		]);
		expect(issues({ testimonials: { items: [{ ...testimonial, consent: true }] } })).toEqual([]);
	});

	it("only accepts http(s) and mailto links, and WhatsApp numbers as digits", () => {
		const link = (url: string) => issues({ hero: { buttons: [{ kind: "link", url }] } });
		expect(link("https://example.com/work")).toEqual([]);
		expect(link("mailto:ana@example.com")).toEqual([]);
		for (const url of ["javascript:alert(1)", "data:text/html,hi", "//example.com", "example.com", "ftp://x.test"])
			expect(link(url)).toEqual(["hero.buttons.0.url"]);
		expect(issues({ clients: { items: [{ id: "c", name: "Ana", url: "mailto:ana@example.com" }] } })).toEqual([
			"clients.items.0.url",
		]);
		expect(issues({ contact: { whatsapp: { show: true, number: "6281234567890" } } })).toEqual([]);
		expect(issues({ contact: { whatsapp: { show: true, number: "+62 812-3456" } } })).toEqual([
			"contact.whatsapp.number",
		]);
	});

	it("only accepts files from the portfolio's own storage folders", () => {
		expect(issues({ basics: { picture: image() } })).toEqual([]);
		expect(issues({ basics: { picture: null } })).toEqual([]);
		for (const key of [
			"uploads/user-1/pictures/avatar.webp",
			"https://example.com/a.webp",
			"uploads/user-1/pictures/portfolio/../../secret.webp",
			"uploads/user-1/pictures/portfolio/a.svg",
		])
			expect(issues({ basics: { picture: { ...image(), key } } })).toEqual(["basics.picture.key"]);
		const pdf = { id: "p", type: "pdf", file: "uploads/user-1/documents/portfolio/deck.pdf", title: "Deck", pages: 12 };
		expect(issues({ works: { items: [work("w", { blocks: [pdf] })] } })).toEqual([]);
		expect(issues({ works: { items: [work("w", { blocks: [{ ...pdf, file: "uploads/user-1/x.pdf" }] })] } })).toEqual([
			"works.items.0.blocks.0.file",
		]);
	});

	it("only accepts video thumbnails from YouTube's and Vimeo's image servers", () => {
		const video = { id: "v", type: "video", provider: "youtube", videoId: "dQw4w9WgXcQ" };
		const check = (thumbnailUrl: string) =>
			issues({ works: { items: [work("w", { blocks: [{ ...video, thumbnailUrl }] })] } });
		expect(check("https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg")).toEqual([]);
		expect(check("https://tracker.example/pixel.gif")).toEqual(["works.items.0.blocks.0.thumbnailUrl"]);
	});

	it("checks layouts, section keys, accents and fonts against the known lists", () => {
		expect(issues({ design: { variants: { work: "grid-3", metric: "kpi" } } })).toEqual([]);
		expect(issues({ design: { variants: { work: "masonry" } } })).toEqual(["design.variants.work"]);
		expect(issues({ sections: { order: ["about", "custom:x1", "resume:0193"] } })).toEqual([]);
		expect(issues({ sections: { order: ["projects"] } })).toEqual(["sections.order.0"]);
		expect(issues({ sections: { titles: { references: "Refs" } } })).toEqual(["sections.titles.references"]);
		expect(issues({ design: { accent: { source: "custom", color: "#12ab9F" } } })).toEqual([]);
		expect(issues({ design: { accent: { source: "custom", color: "red" } } })).toEqual(["design.accent.color"]);
		expect(issues({ design: { fonts: { source: "pair", id: "comic-sans" } } })).toEqual(["design.fonts.id"]);
	});

	it("can't carry visibility settings inside the data", () => {
		const data = parseWritablePortfolioData({ isPublic: true, showInSearchEngines: false, suspendedAt: "now" });
		expect(data).not.toHaveProperty("isPublic");
		expect(data).not.toHaveProperty("showInSearchEngines");
		expect(data).not.toHaveProperty("suspendedAt");
	});
});

describe("work addresses", () => {
	it("turns titles into ASCII slugs and keeps them unique", () => {
		expect(slugifyPortfolioTitle("  Redesain Aplikasi Kopi — Ça Va!  ")).toBe("redesain-aplikasi-kopi-ca-va");
		expect(slugifyPortfolioTitle("日本語")).toBe("");
		expect(uniquePortfolioSlug("日本語", new Set())).toBe("work");
		expect(uniquePortfolioSlug("App", new Set(["app", "app-2"]))).toBe("app-3");
		const long = uniquePortfolioSlug("x".repeat(80), new Set(["x".repeat(64)]));
		expect(long).toHaveLength(64);
		expect(long.endsWith("-2")).toBe(true);
	});
});
