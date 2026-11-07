import type { PortfolioData } from "@rezumi/schema/portfolio/data";
import type { ResumeData } from "@rezumi/schema/resume/data";
import type { Draft } from "immer";
import { beforeAll, describe, expect, it } from "vite-plus/test";
import { i18n } from "@lingui/core";
import { produce } from "immer";
import { portfolioMessages, portfolioViewMessages } from "@rezumi/portfolio/messages";
import { buildPortfolioView } from "@rezumi/portfolio/view";
import { parsePortfolioData } from "@rezumi/schema/portfolio/data";
import { defaultResumeData } from "@rezumi/schema/resume/default";
import {
	editorSectionOrder,
	isStandardSection,
	moveSection,
	resumeSectionItems,
	sectionLabel,
	setBasicsText,
	setItemHidden,
	setSectionHidden,
	setSectionTitle,
} from "./sections";

const portfolio = (patch: Partial<PortfolioData> = {}): PortfolioData => ({ ...parsePortfolioData({}), ...patch });

beforeAll(() => {
	i18n.loadAndActivate({ locale: "en", messages: {} });
});

function resume(): ResumeData {
	const data = structuredClone(defaultResumeData);
	data.basics.name = "Nadia Rahmawati";
	data.basics.headline = "Product designer";
	data.basics.location = "Bandung, Indonesia";
	data.sections.experience.items = [
		{ ...structuredClone(defaultExperience()), id: "job-1", company: "Kopi Senja", position: "Designer" },
		{ ...structuredClone(defaultExperience()), id: "job-2", company: "Toko Kita", position: "Intern", hidden: true },
	];
	return data;
}

function defaultExperience() {
	return {
		id: "",
		hidden: false,
		company: "",
		position: "",
		location: "",
		period: "",
		website: { url: "", label: "" },
		description: "",
		roles: [],
	} as unknown as ResumeData["sections"]["experience"]["items"][number];
}

const edit = (data: PortfolioData, recipe: (draft: Draft<PortfolioData>) => void) => produce(data, recipe);

const englishMessages = portfolioViewMessages(portfolioMessages("en-US"));

/** The resume with one custom section of its own (an experience-like list), as `resume:<id>` on the portfolio. */
function withCustomSection(data: ResumeData, id: string, title: string): ResumeData {
	const item = { ...defaultExperience(), id: "talk-1", company: "Kopi Senja", position: "Designer" };
	const section = { id, type: "experience", title, icon: "", columns: 1, hidden: false, items: [item] };
	return { ...data, customSections: [section as unknown as ResumeData["customSections"][number]] };
}

const view = (data: PortfolioData, source: ResumeData | null = resume()) =>
	buildPortfolioView({
		portfolio: { data },
		resume: source ? { data: source } : null,
		owner: { name: "Account name", username: "nadia" },
		entitlements: { hidePortfolioCredit: false },
		messages: englishMessages,
		fileUrl: (key) => `/${key}`,
	});

describe("section order", () => {
	it("lists every section in the theme's order until the user moves one", () => {
		const order = editorSectionOrder(portfolio(), null);
		expect(order.slice(0, 3)).toEqual(["about", "work", "services"]);
		expect(order.at(-1)).toBe("contact");
	});

	it("moves a section and keeps the whole order, so the theme no longer places any", () => {
		const data = portfolio();
		const order = editorSectionOrder(data, null);
		const moved = edit(data, (draft) => moveSection(draft, order, "contact", 0));
		expect(moved.sections.order[0]).toBe("contact");
		expect(moved.sections.order).toHaveLength(order.length);
		expect(editorSectionOrder(moved, null)[0]).toBe("contact");

		const down = edit(moved, (draft) => moveSection(draft, editorSectionOrder(moved, null), "about", 2));
		expect(editorSectionOrder(down, null).slice(0, 3)).toEqual(["contact", "work", "about"]);
	});

	it("ignores a move of a section that isn't listed", () => {
		const data = portfolio();
		const order = editorSectionOrder(data, null);
		expect(edit(data, (draft) => moveSection(draft, order, "custom:missing", 0))).toBe(data);
	});

	it("keeps the place of a resume section the list can't show yet (the resume is still loading)", () => {
		const source = withCustomSection(resume(), "cs-1", "Speaking");
		const placed = edit(portfolio(), (draft) =>
			moveSection(draft, editorSectionOrder(draft, source), "resume:cs-1", 1),
		);
		expect(editorSectionOrder(placed, source).slice(0, 3)).toEqual(["about", "resume:cs-1", "work"]);

		// Moved while the resume loads: the list has no resume sections, but the saved order keeps this one's place.
		const moved = edit(placed, (draft) => moveSection(draft, editorSectionOrder(placed, null), "contact", 0));
		expect(moved.sections.order).toContain("resume:cs-1");
		expect(editorSectionOrder(moved, source).slice(0, 4)).toEqual(["contact", "about", "resume:cs-1", "work"]);
	});
});

describe("section names", () => {
	it("use a custom title, else the page's default, the portfolio's own title, or the resume's", () => {
		const source = withCustomSection(resume(), "cs-1", " Speaking ");
		const data = edit(portfolio(), (draft) => {
			draft.custom.push({ id: "c-1", title: "How I work", content: "", hidden: false });
			draft.sections.titles.about = "Who I am";
		});
		expect(sectionLabel("about", data, source, englishMessages)).toBe("Who I am");
		expect(sectionLabel("work", data, source, englishMessages)).toBe(englishMessages.sections.work);
		expect(sectionLabel("custom:c-1", data, source, englishMessages)).toBe("How I work");
		expect(sectionLabel("resume:cs-1", data, source, englishMessages)).toBe("Speaking");
		expect(sectionLabel("custom:gone", data, source, englishMessages)).toBe("Untitled section");
		expect(sectionLabel("resume:cs-1", data, null, englishMessages)).toBe("Resume section");
	});

	it("tell the standard sections from the portfolio's and the resume's own", () => {
		expect(isStandardSection("experience")).toBe(true);
		expect(isStandardSection("custom:c-1")).toBe(false);
		expect(isStandardSection("resume:cs-1")).toBe(false);
	});
});

describe("hiding", () => {
	it("hides and shows a section on the page", () => {
		const data = edit(
			portfolio({ about: { content: "<p>Hello</p>" } }),
			(draft) => void setSectionHidden(draft, "about", true),
		);
		expect(data.sections.hidden).toEqual(["about"]);
		expect(view(data).sections.some((section) => section.key === "about")).toBe(false);
		const shown = edit(data, (draft) => setSectionHidden(draft, "about", false));
		expect(shown.sections.hidden).toEqual([]);
		expect(view(shown).sections.some((section) => section.key === "about")).toBe(true);
	});

	it("hides one resume item on the portfolio only, and forgets the list once it's empty", () => {
		const source = resume();
		const data = edit(portfolio(), (draft) => setItemHidden(draft, "experience", "job-1", true));
		expect(data.sections.hiddenItems.experience).toEqual(["job-1"]);
		expect(view(data, source).sections.some((section) => section.key === "experience")).toBe(false);
		expect(source.sections.experience.items[0]?.hidden).toBe(false);

		const shown = edit(data, (draft) => setItemHidden(draft, "experience", "job-1", false));
		expect(shown.sections.hiddenItems).toEqual({});
	});

	it("lists resume items with the ones hidden on the resume marked", () => {
		expect(resumeSectionItems(resume(), "experience")).toEqual([
			{ id: "job-1", label: "Designer · Kopi Senja", hiddenOnResume: false },
			{ id: "job-2", label: "Intern · Toko Kita", hiddenOnResume: true },
		]);
		expect(resumeSectionItems(null, "experience")).toEqual([]);
		expect(resumeSectionItems(resume(), "about")).toEqual([]);
	});

	it("lists the items of the resume's own sections too", () => {
		const source = withCustomSection(resume(), "cs-1", "Speaking");
		expect(resumeSectionItems(source, "resume:cs-1")).toEqual([
			{ id: "talk-1", label: "Designer · Kopi Senja", hiddenOnResume: false },
		]);
		expect(resumeSectionItems(source, "resume:missing")).toEqual([]);
	});
});

describe("section titles", () => {
	it("keeps a custom title and goes back to the default when it's cleared", () => {
		const titled = edit(portfolio({ about: { content: "<p>Hi</p>" } }), (draft) =>
			setSectionTitle(draft, "about", "  Who I am "),
		);
		expect(titled.sections.titles.about).toBe("Who I am");
		expect(view(titled).sections.find((section) => section.key === "about")?.title).toBe("Who I am");

		const cleared = edit(titled, (draft) => setSectionTitle(draft, "about", "   "));
		expect(cleared.sections.titles).toEqual({});
		expect(view(cleared).sections.find((section) => section.key === "about")?.title).toBe(
			englishMessages.sections.about,
		);
	});
});

describe("portfolio-only basics", () => {
	it("follows the resume while empty and replaces it once filled", () => {
		expect(view(portfolio()).basics).toMatchObject({
			name: "Nadia Rahmawati",
			headline: "Product designer",
			location: "Bandung, Indonesia",
		});

		const own = edit(portfolio(), (draft) => {
			setBasicsText(draft, "name", "Nadia R.");
			setBasicsText(draft, "headline", "UI designer");
			setBasicsText(draft, "location", "Remote");
		});
		expect(view(own).basics).toMatchObject({ name: "Nadia R.", headline: "UI designer", location: "Remote" });

		const cleared = edit(own, (draft) => {
			setBasicsText(draft, "name", "");
			setBasicsText(draft, "headline", "   ");
		});
		expect(cleared.basics).toEqual({ location: "Remote" });
		expect(view(cleared).basics).toMatchObject({ name: "Nadia Rahmawati", headline: "Product designer" });
	});

	it("falls back to the account's name without a resume", () => {
		expect(view(portfolio(), null).basics.name).toBe("Account name");
	});
});
