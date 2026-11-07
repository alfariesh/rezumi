import { describe, expect, it } from "vite-plus/test";
import { parseWritablePortfolioData } from "@rezumi/schema/portfolio/data";
import { PORTFOLIO_LIMITS, portfolioDataBytes } from "@rezumi/schema/portfolio/limits";
import { testResume } from "./fixtures.test-helpers";
import { createInitialPortfolioData, workFromResumeProject } from "./initial";

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

	it("copies nothing the resume hides: its summary or its Projects section", () => {
		const resume = testResume();
		resume.summary.hidden = true;
		resume.sections.projects.hidden = true;
		const data = createInitialPortfolioData({ resume });
		expect(data.about.content).toBe("");
		expect(data.works.items).toEqual([]);
	});

	it("remembers which resume project a work came from, whatever text its id is", () => {
		const resume = testResume();
		const ids = ["proj.1", "Ünïcode id", "x".repeat(PORTFOLIO_LIMITS.text.id + 1)];
		resume.sections.projects.items = ids.map((id, index) => ({
			id,
			hidden: false,
			name: `Project ${index}`,
			period: "",
			website: { url: "", label: "", inlineLink: false },
			description: "",
		}));
		const data = createInitialPortfolioData({ resume });
		expect(data.works.items.map((work) => work.fromResumeItemId)).toEqual(["proj.1", "Ünïcode id", undefined]);
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

	it("keeps the text of resume HTML whose markup is too long for the field", () => {
		const links = (count: number) =>
			`<p>${Array.from({ length: count }, (_, index) => `<a href="https://example.test/${"a".repeat(1900)}">Link ${index}</a>`).join(" ")}</p>`;
		const project = {
			id: "p1",
			hidden: false,
			name: "Links",
			period: "",
			website: { url: "", label: "", inlineLink: false },
			description: links(50),
		};
		const resume = testResume();
		resume.summary.content = links(25);
		resume.sections.projects.items = [project];
		const data = createInitialPortfolioData({ resume });
		expect(() => parseWritablePortfolioData(data)).not.toThrow();
		expect(data.about.content).toMatch(/^<p>Link 0 Link 1 .* Link 24<\/p>$/);
		expect(data.works.items[0]?.blocks[0]).toMatchObject({
			type: "text",
			html: expect.stringMatching(/Link 49<\/p>$/),
		});
		// Adding the project later ("Take from resume") makes the same work.
		const work = workFromResumeProject(project, new Set());
		expect(() => parseWritablePortfolioData({ works: { items: [work] } })).not.toThrow();
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
