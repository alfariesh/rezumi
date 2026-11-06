import { describe, expect, it } from "vite-plus/test";
import { parseWritablePortfolioData } from "@rezumi/schema/portfolio/data";
import { portfolioFileKeys } from "./files";

const image = (name: string, thumb = false) => ({
	key: `uploads/u/pictures/portfolio/${name}.webp`,
	...(thumb ? { thumbKey: `uploads/u/pictures/portfolio/${name}-s.webp` } : {}),
	width: 10,
	height: 10,
});

describe("portfolioFileKeys", () => {
	it("finds every file the data uses, once", () => {
		const data = parseWritablePortfolioData({
			basics: { picture: image("me", true) },
			hero: { background: { kind: "image", image: image("bg") } },
			works: {
				items: [
					{
						id: "w",
						slug: "w",
						cover: image("cover"),
						blocks: [
							{ id: "i", type: "images", images: [image("g1"), image("me")] },
							{
								id: "p",
								type: "pdf",
								file: "uploads/u/documents/portfolio/deck.pdf",
								title: "Deck",
								pages: 3,
								preview: image("page1"),
							},
							{ id: "l", type: "link", url: "https://example.com", image: image("og") },
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
		expect(portfolioFileKeys(data).sort()).toEqual(
			["me", "me-s", "bg", "cover", "g1", "page1", "og", "ana", "acme", "custom", "map-light", "map-dark"]
				.map((name) => `uploads/u/pictures/portfolio/${name}.webp`)
				.concat("uploads/u/documents/portfolio/deck.pdf")
				.sort(),
		);
	});
});
