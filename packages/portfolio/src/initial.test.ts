import { describe, expect, it } from "vite-plus/test";
import { parseWritablePortfolioData } from "@rezumi/schema/portfolio/data";
import { PORTFOLIO_LIMITS, portfolioDataBytes } from "@rezumi/schema/portfolio/limits";
import { testResume } from "./fixtures.test-helpers";
import { createInitialPortfolioData } from "./initial";

describe("a new portfolio from a resume", () => {
	it("starts About from the summary, cleaned", () => {
		const data = createInitialPortfolioData({ resume: testResume() });
		expect(data.about.content).toBe("<p>I design <strong>calm</strong> apps.</p>");
	});

	it("copies visible projects as works with Text and Link blocks", () => {
		const data = createInitialPortfolioData({ resume: testResume() });
		expect(data.works.items).toHaveLength(1);
		const [work] = data.works.items;
		expect(work).toMatchObject({
			slug: "aplikasi-kopi",
			title: "Aplikasi Kopi",
			summary: "Redesigned ordering for a coffee chain.",
			date: "2024",
			fromResumeItemId: "p1",
			primaryLink: { label: "", url: "https://behance.example.test/kopi" },
			featured: false,
			hidden: false,
		});
		expect(work?.blocks.map((block) => block.type)).toEqual(["text", "link"]);
		expect(work?.blocks[0]).toMatchObject({ html: "<p>Redesigned ordering for a coffee chain.</p>" });
		expect(work?.blocks[1]).toMatchObject({ url: "https://behance.example.test/kopi", title: "behance.example.test" });
	});

	it("follows the resume's accent and fonts and the theme's order", () => {
		const data = createInitialPortfolioData({ resume: testResume(), theme: "prima" });
		expect(data.theme).toBe("prima");
		expect(data.design.accent).toEqual({ source: "resume" });
		expect(data.design.fonts).toEqual({ source: "resume" });
		expect(data.sections.order).toEqual([]);
		expect(data.basics).toEqual({});
	});

	it("gives works unique addresses and leaves out links that aren't web addresses", () => {
		const resume = testResume();
		resume.sections.projects.items = ["Kopi", "Kopi", "Kopi"].map((name, index) => ({
			id: `p${index}`,
			hidden: false,
			name,
			period: "",
			website: { url: index === 2 ? "javascript:alert(1)" : "", label: "", inlineLink: false },
			description: "",
		}));
		const data = createInitialPortfolioData({ resume });
		expect(data.works.items.map((work) => work.slug)).toEqual(["kopi", "kopi-2", "kopi-3"]);
		expect(data.works.items[2]?.primaryLink).toBeUndefined();
		expect(data.works.items[2]?.blocks).toEqual([]);
	});

	it("fits long resume text within the portfolio's limits", () => {
		const resume = testResume();
		resume.summary.content = `<p>${"word ".repeat(2000)}</p>`;
		resume.sections.projects.items = [
			{
				id: "long",
				hidden: false,
				name: "N".repeat(300),
				period: "P".repeat(80),
				website: { url: "", label: "", inlineLink: false },
				description: "<p>x</p>",
			},
		];
		const data = createInitialPortfolioData({ resume });
		expect(() => parseWritablePortfolioData(data)).not.toThrow();
		expect(data.works.items[0]?.title.length).toBeLessThanOrEqual(PORTFOLIO_LIMITS.text.workTitle);
		expect(data.works.items[0]?.date.length).toBeLessThanOrEqual(PORTFOLIO_LIMITS.text.workDate);
	});

	it("leaves out the last projects when all of them wouldn't fit the size limit", () => {
		const resume = testResume();
		resume.sections.projects.items = Array.from({ length: 40 }, (_, index) => ({
			id: `p${index}`,
			hidden: false,
			name: `Project ${index}`,
			period: "",
			website: { url: "", label: "", inlineLink: false },
			description: `<p>${"word ".repeat(1900)}</p>`,
		}));
		const data = createInitialPortfolioData({ resume });
		expect(portfolioDataBytes(data)).toBeLessThanOrEqual(PORTFOLIO_LIMITS.dataBytes);
		expect(data.works.items.length).toBeGreaterThan(10);
		expect(data.works.items.length).toBeLessThan(40);
		expect(data.works.items[0]?.title).toBe("Project 0");
	});
});

describe("a new portfolio without a resume", () => {
	it("uses the basics given, a curated accent and the theme's fonts", () => {
		const data = createInitialPortfolioData({
			resume: null,
			basics: { name: "  Bayu Saputra ", headline: "Photographer", location: "" },
			theme: "kanvas",
		});
		expect(data.basics).toEqual({ name: "Bayu Saputra", headline: "Photographer" });
		expect(data.design.accent).toEqual({ source: "preset", id: "samudra" });
		expect(data.design.fonts).toEqual({ source: "theme" });
		expect(data.works.items).toEqual([]);
		expect(data.about.content).toBe("");
	});
});
