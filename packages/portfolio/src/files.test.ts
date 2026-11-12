import { describe, expect, it } from "vite-plus/test";
import { parsePortfolioData, parseWritablePortfolioData } from "@rezumi/schema/portfolio/data";
import { PORTFOLIO_LIMITS } from "@rezumi/schema/portfolio/limits";
import { portfolioFileKeys, portfolioFileKeysInStoredData } from "./files";

const key = (name: string) => `uploads/u/pictures/portfolio/${name}.webp`;
const image = (name: string) => ({ key: key(name), thumbKey: key(`${name}-sm`), width: 10, height: 10 });
const pdfKey = "uploads/u/documents/portfolio/deck.pdf";

/** Every field that can hold a file, each filled, every picture with its small copy. */
const maximal = () =>
	parseWritablePortfolioData({
		basics: { picture: image("me") },
		hero: { background: { kind: "image", image: image("bg") } },
		works: {
			items: [
				{
					id: "w",
					slug: "w",
					cover: image("cover"),
					blocks: [
						{ id: "t", type: "text", html: "<p>Story</p>" },
						{ id: "i", type: "images", images: [image("g1"), image("g2")] },
						{ id: "p", type: "pdf", file: pdfKey, title: "Deck", pages: 3, preview: image("page1") },
						{ id: "l", type: "link", url: "https://example.com", image: image("og") },
						{
							id: "v",
							type: "video",
							provider: "youtube",
							videoId: "dQw4w9WgXcQ",
							thumbnailUrl: "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
							thumbnail: image("video"),
						},
						{
							id: "e",
							type: "embed",
							provider: "loom",
							ref: "0123456789abcdef0123456789abcdef",
							thumbnail: image("embed"),
						},
					],
				},
			],
		},
		testimonials: { items: [{ id: "t", quote: "q", consent: true, photo: image("ana") }] },
		clients: {
			items: [
				{ id: "c1", name: "Acme", logo: image("acme") },
				{ id: "c2", name: "Google", logo: { brandIcon: "google" } },
			],
		},
		custom: [{ id: "x", image: image("custom") }],
		location: { map: { light: image("map-light"), dark: image("map-dark") } },
	});

const names = [
	"me",
	"bg",
	"cover",
	"g1",
	"g2",
	"page1",
	"og",
	"video",
	"embed",
	"ana",
	"acme",
	"custom",
	"map-light",
	"map-dark",
];
const everyKey = [...names.flatMap((name) => [key(name), key(`${name}-sm`)]), pdfKey].sort();

describe("portfolioFileKeys", () => {
	it("finds every file the data refers to, once", () => {
		const data = maximal();
		data.works.items[0]?.blocks.push({
			id: "again",
			type: "images",
			images: [{ ...image("me"), alt: "" }],
			layout: "grid",
		});
		expect(portfolioFileKeys(data).sort()).toEqual(everyKey);
	});
});

describe("portfolioFileKeysInStoredData", () => {
	it("finds exactly what portfolioFileKeys finds in data the schema reads", () => {
		const data = maximal();
		const stored: unknown = JSON.parse(JSON.stringify(data));
		expect(portfolioFileKeysInStoredData(stored).sort()).toEqual(everyKey);
		expect(portfolioFileKeys(parsePortfolioData(stored)).sort()).toEqual(everyKey);
	});

	it("also finds keys today's schema doesn't read, so the files they name are never deleted", () => {
		const items = Array.from({ length: PORTFOLIO_LIMITS.works + 1 }, (_, index) => ({
			id: `w${index}`,
			slug: `w${index}`,
			cover: image(`cover-${index}`),
		}));
		const stored = {
			// A field a later version adds.
			intro: { slides: [{ picture: key("future") }] },
			// More works than the lenient read keeps.
			works: { items },
			// An item the lenient read drops (no consent), still naming its photo.
			testimonials: { items: [{ id: "t", quote: "q", photo: image("unconsented") }] },
		};
		expect(portfolioFileKeys(parsePortfolioData(stored))).not.toContain(key(`cover-${PORTFOLIO_LIMITS.works}`));
		const found = portfolioFileKeysInStoredData(stored);
		expect(found).toEqual(
			expect.arrayContaining([
				key("future"),
				key(`cover-${PORTFOLIO_LIMITS.works}`),
				key("unconsented"),
				key("unconsented-sm"),
			]),
		);
		expect(found).toHaveLength(2 * (PORTFOLIO_LIMITS.works + 1) + 3);
	});

	it("takes only whole strings that are file keys", () => {
		const stored = {
			about: { content: `<p><a href="https://app.example/${key("linked")}">Picture</a> ${key("in-text")}</p>` },
			url: `https://app.example/api/${key("absolute")}`,
			traversal: "uploads/u/pictures/portfolio/../../fonts/a.webp",
			otherFolder: "uploads/u/pictures/photo.webp",
			sibling: "uploads/u/pictures/portfolio-persona.jpg",
			[key("as-a-name")]: true,
			pdf: pdfKey,
			number: 3,
			nothing: null,
		};
		expect(portfolioFileKeysInStoredData(stored)).toEqual([pdfKey]);
		for (const value of [null, undefined, 3, "", key("bare")])
			expect(portfolioFileKeysInStoredData(value)).toEqual(value === key("bare") ? [key("bare")] : []);
	});
});
