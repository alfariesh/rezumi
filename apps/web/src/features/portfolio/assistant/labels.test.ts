import type { ChangeLineContext } from "./labels";
import type { PortfolioData } from "@rezumi/schema/portfolio/data";
import type { PortfolioEdit } from "@rezumi/schema/portfolio/edits";
import type { ResumeData } from "@rezumi/schema/resume/data";
import { beforeAll, describe, expect, it, vi } from "vite-plus/test";
import { i18n } from "@lingui/core";
import { portfolioMessages, portfolioViewMessages } from "@rezumi/portfolio/messages";
import { parsePortfolioData } from "@rezumi/schema/portfolio/data";
import { defaultResumeData } from "@rezumi/schema/resume/default";

vi.mock("@/libs/orpc/client", () => ({ client: {}, orpc: {} }));
vi.mock("@/libs/auth/client", () => ({ authClient: {} }));

const { portfolioChangeLines } = await import("./labels");

beforeAll(() => {
	i18n.loadAndActivate({ locale: "en-US", messages: {} });
});

function portfolio(): PortfolioData {
	return parsePortfolioData({
		works: {
			items: [
				{
					id: "work-1",
					slug: "lumen",
					title: "Lumen redesign",
					blocks: [
						{ id: "block-1", type: "text", html: "<p>Hi</p>" },
						{
							id: "block-2",
							type: "metrics",
							items: [{ id: "metric-1", label: "Conversion", value: { kind: "number", number: 35 } }],
						},
					],
				},
			],
		},
		services: { items: [{ id: "service-1", title: "Design sprints" }] },
		testimonials: { items: [{ id: "quote-1", quote: "Great", name: "Rina", role: "PM", consent: true }] },
		clients: { items: [{ id: "client-1", name: "Kopi Senja" }] },
		custom: [{ id: "custom-1", title: "Talks" }],
		hero: { highlights: [{ id: "highlight-1", label: "Years", value: { kind: "number", number: 6 } }] },
	});
}

function resume(): ResumeData {
	const data = structuredClone(defaultResumeData);
	const job = {
		id: "job-1",
		hidden: false,
		company: "Toko Kita",
		position: "Intern",
		location: "",
		period: "",
		website: { url: "", label: "" },
		description: "",
		roles: [],
	};
	data.sections.experience.items = [job as unknown as ResumeData["sections"]["experience"]["items"][number]];
	return data;
}

const context = (patch: Partial<ChangeLineContext> = {}): ChangeLineContext => {
	const data = patch.data ?? portfolio();
	return {
		before: data,
		data,
		resume: resume(),
		from: "resume",
		messages: portfolioViewMessages(portfolioMessages("en-US")),
		locale: "en-US",
		...patch,
	};
};

const texts = (edits: PortfolioEdit[], ctx = context()) => portfolioChangeLines(edits, ctx).map((line) => line.text);

describe("portfolioChangeLines", () => {
	it("names every list's adds, edits, removals and moves from the item", () => {
		expect(
			texts([
				{ op: "add", list: "works", item: { id: "work-2", title: "Kopi app" } },
				{ op: "update", list: "works", id: "work-1", fields: { summary: "New" } },
				{ op: "move", list: "works", id: "work-1", to: "first" },
				{ op: "remove", list: "works", id: "work-1" },
				{ op: "add", list: "services", item: { id: "service-2", title: "Audits" } },
				{ op: "update", list: "testimonials", id: "quote-1", fields: { quote: "Lovely" } },
				{ op: "remove", list: "clients", id: "client-1" },
				{ op: "move", list: "custom", id: "custom-1", to: "last" },
				{ op: "add", list: "highlights", item: { id: "highlight-2", label: "Clients" } },
			]),
		).toEqual([
			"Added the work “Kopi app”",
			"Edited the work “Lumen redesign”",
			"Moved the work “Lumen redesign”",
			"Removed the work “Lumen redesign”",
			"Added the service “Audits”",
			"Edited the testimonial from Rina",
			"Removed the client “Kopi Senja”",
			"Moved the section “Talks”",
			"Added the number “Clients” to the intro",
		]);
	});

	it("says hiding and showing, and names blocks and numbers with their work", () => {
		expect(
			texts([
				{ op: "update", list: "works", id: "work-1", fields: { hidden: true } },
				{ op: "update", list: "custom", id: "custom-1", fields: { hidden: null } },
				{ op: "add", list: "blocks", workId: "work-1", item: { id: "block-3", type: "video" } },
				{ op: "remove", list: "blocks", workId: "work-1", id: "block-1" },
				{
					op: "update",
					list: "metrics",
					workId: "work-1",
					blockId: "block-2",
					id: "metric-1",
					fields: { label: "CR" },
				},
			]),
		).toEqual([
			"Hid the work “Lumen redesign”",
			"Showed the section “Talks”",
			"Added a Video block to “Lumen redesign”",
			"Removed a Text block from “Lumen redesign”",
			"Edited the number “Conversion” in “Lumen redesign”",
		]);
	});

	it("names blocks of a work the same call adds", () => {
		expect(
			texts([
				{ op: "add", list: "works", item: { id: "work-9", title: "Atlas", blocks: [] } },
				{
					op: "add",
					list: "blocks",
					workId: "work-9",
					item: { id: "block-9", type: "link", url: "https://a.example" },
				},
			]),
		).toEqual(["Added the work “Atlas”", "Added a Link block to “Atlas”"]);
	});

	it("says what a removal took when the item is no longer known", () => {
		const data = portfolio();
		data.works.items = [];
		expect(texts([{ op: "remove", list: "works", id: "work-1" }], context({ before: null, data }))).toEqual([
			"Removed a work",
		]);
	});

	it("puts settings as label and value", () => {
		expect(
			texts([
				{ op: "set", path: "theme", value: "prima" },
				{ op: "set", path: "design.scheme", value: "dark" },
				{ op: "set", path: "design.accent", value: { source: "preset", id: "toska" } },
				{ op: "set", path: "design.fonts", value: { source: "pair", id: "manrope" } },
				{ op: "set", path: "basics.headline", value: "Product designer" },
				{ op: "set", path: "basics.name", value: null },
				{ op: "set", path: "basics.picture", value: "resume" },
				{ op: "set", path: "hero.effect", value: { id: "typewriter" } },
				{ op: "set", path: "about.content", value: "<p>Hi</p>" },
				{ op: "set", path: "sections.order", value: ["work", "about"] },
				{ op: "set", path: "credit.show", value: false },
				{ op: "set", path: "seo.title", value: "Nadia" },
			]),
		).toEqual([
			"Theme: Prima",
			"Mode: Dark",
			"Accent color: Toska",
			"Fonts: Manrope",
			"Headline: Product designer",
			"Name: Same as my resume",
			"Photo: The photo on my resume",
			"Intro effect: Typewriter",
			"Rewrote About me",
			"Reordered the sections",
			"Hid the Rezumi badge",
			"Changed how search engines show your page",
		]);
	});

	it("lists the sections and career items a call hid or showed", () => {
		const before = portfolio();
		before.sections.hidden = ["services"];
		const lines = portfolioChangeLines(
			[
				{ op: "set", path: "sections.hidden", value: ["experience"] },
				{ op: "set", path: "sections.hiddenItems.experience", value: ["job-1"] },
				{ op: "set", path: "sections.titles.experience", value: "Career" },
			],
			context({ before }),
		);
		expect(lines.map((line) => line.text)).toEqual([
			"Hid the section “Experience”",
			"Showed the section “Services”",
			"Hid “Intern · Toko Kita” in Experience",
			"Renamed “Experience” to “Career”",
		]);
		expect(lines[0]?.reveal).toEqual({ tab: "write", section: "experience" });
	});

	it("opens the work, the section or the tab a change is in", () => {
		const lines = portfolioChangeLines(
			[
				{ op: "update", list: "works", id: "work-1", fields: { summary: "New" } },
				{ op: "remove", list: "works", id: "work-1" },
				{ op: "add", list: "blocks", workId: "work-1", item: { id: "block-3", type: "text", html: "" } },
				{ op: "update", list: "custom", id: "custom-1", fields: { title: "Speaking" } },
				{ op: "set", path: "theme", value: "lugas" },
				{ op: "set", path: "seo.title", value: "Nadia" },
				{ op: "set", path: "hero.greeting", value: "Hi" },
			],
			context(),
		);
		expect(lines.map((line) => line.reveal)).toEqual([
			{ tab: "write", section: "work", workId: "work-1" },
			{ tab: "write", section: "work" },
			{ tab: "write", section: "work", workId: "work-1" },
			{ tab: "write", section: "custom:custom-1" },
			{ tab: "design" },
			{ tab: "share" },
			{ tab: "write" },
		]);
	});
});
