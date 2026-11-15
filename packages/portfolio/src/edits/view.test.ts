import type { PortfolioAiViewInput } from "./types";
import { describe, expect, it } from "vite-plus/test";
import { parseWritablePortfolioData } from "@rezumi/schema/portfolio/data";
import { fullPortfolioData, fullTestResume, testImage, testResume } from "../fixtures.test-helpers";
import { portfolioAiView } from "./view";

const input = (overrides: Partial<PortfolioAiViewInput> = {}): PortfolioAiViewInput => ({
	data: parseWritablePortfolioData({
		...fullPortfolioData,
		sections: { hiddenItems: { experience: ["e3"] }, titles: { experience: "Where I've worked" } },
	}),
	source: { from: "resume", name: "Product CV", resume: testResume() },
	plan: undefined,
	uploads: [{ ...testImage("fresh"), uploadedAt: "2026-11-14T08:00:00.000Z" }],
	status: { published: true, url: "https://rezumi.example/nadia" },
	...overrides,
});

describe("portfolioAiView", () => {
	it("leaves every contact value and the map point out, saying only what the source has", () => {
		const view = portfolioAiView(input());
		const json = JSON.stringify(view);
		for (const secret of [
			"nadia@example.test",
			"+62 812 0000 0000",
			"6281255501824",
			"nadia.example.test",
			"linkedin.example.test/in/nadia",
			"-6.2088",
			"106.8456",
		])
			expect(json, secret).not.toContain(secret);
		expect(view.contact).toEqual({
			email: { show: true, sourceHas: true },
			phone: { show: false, sourceHas: true },
			website: { show: true, sourceHas: true },
			profiles: { show: true, sourceHas: true },
			whatsapp: { show: true, numberSet: true },
			form: false,
			saveContact: true,
			note: "Let's talk.",
		});
		expect(view.location).toMatchObject({ label: "Jakarta, Indonesia", hasMapPoint: true, timezone: "Asia/Jakarta" });
	});

	it("reads the source's location only while the page shows it", () => {
		const shown = portfolioAiView(input()).basics as Record<string, unknown>;
		expect(shown.location).toEqual({ value: "Bandung, Indonesia", override: false });
		const data = input().data;
		data.hero.showLocation = false;
		const hidden = portfolioAiView(input({ data })).basics as Record<string, unknown>;
		expect(hidden.location).toEqual({ value: null, override: false, hidden: true });
		expect(JSON.stringify(hidden)).not.toContain("Bandung");
	});

	it("lists the career sections read-only with their items' ids and where each is hidden", () => {
		const view = portfolioAiView(input());
		const sections = view.sections as {
			key: string;
			title?: string;
			from: string;
			items?: unknown[];
			onPage: boolean;
		}[];
		const experience = sections.find((section) => section.key === "experience");
		expect(experience).toEqual({
			key: "experience",
			title: "Where I've worked",
			customTitle: true,
			onPage: true,
			from: "resume",
			items: [
				{ id: "e1", label: "Product Designer · Tokopedia · Jakarta", when: "2021 – now" },
				{ id: "e2", label: "Intern · Hidden Co", when: "2019", hiddenInSource: true },
				{ id: "e3", label: "Designer · Startup", when: "2020", hidden: true },
			],
		});
		// Default titles are in the page's language (the resume's, Indonesian).
		expect(sections.find((section) => section.key === "work")).toMatchObject({ from: "portfolio", onPage: true });
		expect(sections.map((section) => section.key)).toContain("custom:x1");
		expect(sections.find((section) => section.key === "education")).toMatchObject({ onPage: false, items: [] });

		const full = portfolioAiView(input({ source: { from: "profile", name: null, resume: fullTestResume() } }));
		const tools = (full.sections as { key: string }[]).find((section) => section.key === "resume:tools");
		expect(tools).toMatchObject({ title: "Tools", from: "profile", items: [{ id: "k1", label: "Design tools" }] });
	});

	it("lists works with their blocks, images with where they're used, and uploads not placed", () => {
		const view = portfolioAiView(input());
		const works = view.works as { id: string; blocks: { id: string; type: string; url?: string }[] }[];
		expect(works.map((work) => work.id)).toEqual(["w1", "w2", "w3"]);
		expect(works[0]?.blocks.find((block) => block.id === "b4")).toEqual({
			id: "b4",
			type: "video",
			url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
			title: "Checkout demo",
		});
		expect(works[0]?.blocks.find((block) => block.id === "e1")?.url).toBe(
			"https://www.figma.com/design/AbCdEf0123456789?node-id=1-2",
		);
		expect(JSON.stringify(works)).not.toContain("previousSlugs");
		expect(JSON.stringify(works)).not.toContain("thumbKey");
		const images = view.images as { key: string; usedIn: string[] }[];
		expect(images.find((image) => image.key === testImage("cover-1").key)).toEqual({
			key: testImage("cover-1").key,
			alt: "cover-1 picture",
			usedIn: ['work "Coffee ordering app" › cover'],
		});
		expect(view.uploads).toEqual([
			{ key: testImage("fresh").key, alt: "fresh picture", uploadedAt: "2026-11-14T08:00:00.000Z" },
		]);
		expect(view.limits).toMatchObject({ works: { used: 3, max: 50 }, highlights: { used: 3, max: 4 } });
	});

	it("marks what the plan locks, keeping what the portfolio already has", () => {
		const data = input().data;
		data.theme = "kanvas";
		const view = portfolioAiView(
			input({
				data,
				plan: {
					name: "Free",
					maxWorks: 6,
					features: { premiumPortfolioThemes: false, premiumHeroEffects: false, hidePortfolioCredit: false },
				},
			}),
		);
		expect(view.plan).toEqual({
			name: "Free",
			maxWorks: 6,
			locked: ["premiumPortfolioThemes", "premiumHeroEffects", "hidePortfolioCredit"],
		});
		const themes = view.themes as { id: string; locked?: boolean; plan: string; character: string }[];
		expect(themes.find((theme) => theme.id === "kanvas")).not.toHaveProperty("locked");
		expect(themes.find((theme) => theme.id === "mozaik")?.locked).toBe(true);
		expect(themes.find((theme) => theme.id === "lugas")).toMatchObject({ plan: "free", character: expect.any(String) });
		expect((view.design as { offered: { lockedEffects: string[] } }).offered.lockedEffects).toEqual([
			"vector-hover",
			"gradient",
			"typewriter",
		]);
		expect(view.credit).toEqual({ show: true, hidingLocked: true });
		expect(view.limits).toMatchObject({ works: { used: 3, max: 6 } });
		expect(portfolioAiView(input()).plan).toBeNull();
	});
});
