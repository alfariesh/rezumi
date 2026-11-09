import type { PortfolioAiDraft } from "./apply";
import type { PortfolioData } from "@rezumi/schema/portfolio/data";
import { describe, expect, it, vi } from "vite-plus/test";
import { produce } from "immer";
import { parseWritablePortfolioData } from "@rezumi/schema/portfolio/data";
import { createDefaultPortfolioData } from "@rezumi/schema/portfolio/default";
import { applyPortfolioDraft, countPortfolioPlaceholders } from "./apply";

vi.mock("@/libs/orpc/client", () => ({ client: {}, orpc: {} }));
vi.mock("@/features/billing/plan", () => ({ getPlanProblem: () => null }));
vi.mock("@/features/billing/plan-dialog", () => ({ openPlanDialog: () => undefined }));

function portfolio(): PortfolioData {
	return parseWritablePortfolioData({
		...createDefaultPortfolioData(),
		hero: { greeting: "Mine" },
		about: { content: "<p>Mine</p>" },
		works: {
			items: [
				{ id: "a", slug: "a", title: "A", summary: "Mine", blocks: [{ id: "t", type: "text", html: "<p>Mine</p>" }] },
				{ id: "b", slug: "b", title: "B", blocks: [{ id: "l", type: "link", url: "https://a.test" }] },
				{ id: "c", slug: "c", title: "C", summary: "Keep", blocks: [] },
			],
		},
	});
}

const draft: PortfolioAiDraft = {
	greeting: "New greeting",
	about: "<p>New about</p>",
	works: [
		{ id: "a", summary: "New A", html: "<p>Story A</p>" },
		{ id: "b", summary: "New B", html: "<p>Story B</p>" },
		{ id: "gone", summary: "x", html: "<p>x</p>" },
	],
};

describe("applying an AI draft", () => {
	it("fills the greeting, About me, summaries and the first Text block", () => {
		const data = produce(portfolio(), (next) => applyPortfolioDraft(next, draft));
		expect(data.hero.greeting).toBe("New greeting");
		expect(data.about.content).toBe("<p>New about</p>");
		expect(data.works.items[0]?.summary).toBe("New A");
		expect(data.works.items[0]?.blocks).toEqual([{ id: "t", type: "text", html: "<p>Story A</p>" }]);
	});

	it("adds a Text block at the top of a work without one", () => {
		const data = produce(portfolio(), (next) => applyPortfolioDraft(next, draft));
		expect(data.works.items[1]?.blocks.map((block) => block.type)).toEqual(["text", "link"]);
	});

	it("leaves alone what the AI left empty, and works it didn't write", () => {
		const empty = { ...draft, greeting: "", about: "", works: [{ id: "a", summary: "", html: "" }] };
		const before = portfolio();
		expect(produce(before, (next) => applyPortfolioDraft(next, empty))).toEqual(before);
		const data = produce(portfolio(), (next) => applyPortfolioDraft(next, draft));
		expect(data.works.items[2]?.summary).toBe("Keep");
	});
});

describe("counting places left to fill in", () => {
	it("finds them in the greeting, About me, summaries and Text blocks", () => {
		const data = produce(portfolio(), (next) => {
			next.hero.greeting = "Saya [tambahkan peran]";
			next.about.content = "<p>Hasilnya [tambahkan hasil] dan [tambahkan angka]</p>";
			const [work] = next.works.items;
			if (!work) throw new Error("No work.");
			work.summary = "[add the result]";
			work.blocks = [{ id: "t", type: "text", html: "<p>[add the client]</p>" }];
		});
		expect(countPortfolioPlaceholders(data)).toBe(5);
	});

	it("is zero for ordinary text", () => {
		expect(countPortfolioPlaceholders(portfolio())).toBe(0);
	});
});
