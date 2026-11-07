import { describe, expect, it } from "vite-plus/test";
import { portfolioFilePrefixes, reachesPortfolioFiles } from "./files";

describe("portfolio storage folders", () => {
	it("end with a slash, so listing one never returns a sibling file", () => {
		const prefixes = portfolioFilePrefixes("u1");
		expect(prefixes).toEqual(["uploads/u1/pictures/portfolio/", "uploads/u1/documents/portfolio/"]);
		const keys = [
			"uploads/u1/pictures/portfolio/a.webp",
			"uploads/u1/pictures/portfolio-persona.jpg",
			"uploads/u1/documents/portfolio.pdf",
			"uploads/u1/documents/portfolio/b.pdf",
		];
		expect(keys.filter((key) => prefixes.some((prefix) => key.startsWith(prefix)))).toEqual([
			"uploads/u1/pictures/portfolio/a.webp",
			"uploads/u1/documents/portfolio/b.pdf",
		]);
	});

	it("tells which deletions would reach the account's portfolio files", () => {
		const reaches = (key: string) => reachesPortfolioFiles("u1", key);
		// A portfolio file, a portfolio folder, or a folder holding one.
		for (const key of [
			"uploads/u1/pictures/portfolio/a.webp",
			"uploads/u1/documents/portfolio/b.pdf",
			"uploads/u1/pictures/portfolio",
			"uploads/u1/pictures/portfolio/",
			"uploads/u1/documents",
			"uploads/u1/pictures",
			"uploads/u1",
			"uploads",
		])
			expect(reaches(key), key).toBe(true);
		// Other files of the account, siblings that only start alike, and other accounts' folders.
		for (const key of [
			"uploads/u1/pictures/photo.jpg",
			"uploads/u1/pictures/portfolio-persona.jpg",
			"uploads/u1/documents/portfolio.pdf",
			"uploads/u1/fonts/a.ttf",
			"uploads/u1/agent/thread",
			"uploads/u2/pictures/portfolio/a.webp",
		])
			expect(reaches(key), key).toBe(false);
	});
});
