// @vitest-environment happy-dom

import type { PortfolioRecord } from "./store";
import type { PortfolioToolContext } from "./webmcp";
import type { WebMcpTool } from "@/libs/webmcp";
import type { PortfolioData } from "@rezumi/schema/portfolio/data";
import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { i18n } from "@lingui/core";
import { produce } from "immer";
import { parsePortfolioData } from "@rezumi/schema/portfolio/data";

const mocks = vi.hoisted(() => ({ update: vi.fn(), toast: vi.fn(), plan: undefined as unknown }));
vi.mock("@/libs/orpc/client", () => ({ client: { portfolio: { update: mocks.update, get: vi.fn() } }, orpc: {} }));
vi.mock("@/features/billing/plan-dialog", () => ({ openPlanDialog: vi.fn() }));
vi.mock("@rezumi/ui/components/toast", () => ({ toast: { add: mocks.toast } }));
vi.mock("./context", () => ({
	usePortfolioSource: () => ({ data: null, from: "profile", designData: null, resume: undefined, isLoading: false }),
}));
vi.mock("./publish-panel", () => ({ usePortfolioUrl: () => "https://rezumi.app/nadia" }));
vi.mock("../works/limits", () => ({ usePortfolioLimits: () => ({ works: 3 }) }));
vi.mock("@/features/billing/plan", () => ({
	usePlan: () => mocks.plan,
	getPlanName: (id: string) => (id === "free" ? "Free" : "Plus"),
}));

const { assignChanged } = await import("./assign");
const { usePortfolioEditorStore } = await import("./store");
const { createPortfolioTools, portfolioEditPlan, usePortfolioWebMcpTools } = await import("./webmcp");

const opened = new Date("2026-11-14T01:00:00.000Z");

function record(data: PortfolioData): PortfolioRecord {
	return {
		id: "portfolio",
		sourceResumeId: null,
		sourceResume: null,
		isPublic: false,
		showInSearchEngines: true,
		publishedAt: null,
		suspendedAt: null,
		suspendedReason: null,
		hasPassword: false,
		data,
		createdAt: opened,
		updatedAt: opened,
	};
}

const store = () => usePortfolioEditorStore.getState();

const context = (plan: PortfolioToolContext["plan"] = null): PortfolioToolContext => ({
	source: { from: "profile", name: null, resume: null },
	plan,
	status: { published: false, url: "https://rezumi.app/nadia" },
});

function toolsFor(plan: PortfolioToolContext["plan"] = null) {
	const tools = new Map(createPortfolioTools(() => context(plan)).map((tool) => [tool.name, tool]));
	return (name: string) => {
		const tool = tools.get(name);
		if (!tool) throw new Error(`${name} wasn't made`);
		return tool;
	};
}

beforeEach(() => {
	vi.useFakeTimers();
	i18n.loadAndActivate({ locale: "en-US", messages: {} });
	mocks.update.mockReset().mockImplementation(async ({ data }: { data: PortfolioData }) => ({ ...record(data) }));
	mocks.toast.mockReset();
	mocks.plan = undefined;
	store().load(record(parsePortfolioData({ works: { items: [{ id: "work-1", slug: "first", title: "First" }] } })));
});

afterEach(() => {
	store().reset();
	vi.clearAllTimers();
	vi.useRealTimers();
	delete (document as { modelContext?: unknown }).modelContext;
});

describe("assignChanged", () => {
	it("writes the new value and keeps the references of what didn't change", () => {
		const before = { basics: { name: "Ada" }, list: [{ id: "a" }, { id: "b", name: "x" }], gone: true };
		const next = { basics: { name: "Ada" }, list: [{ id: "a" }, { id: "b", name: "y" }], added: 1 };
		const result = produce(before as Record<string, unknown>, (draft) => assignChanged(draft, before, next));
		expect(result).toEqual(next);
		expect(result.basics).toBe(before.basics);
		expect((result.list as unknown[])[0]).toBe(before.list[0]);
	});
});

describe("portfolio editor WebMCP tools", () => {
	it("registers its tools while the editor is open", () => {
		const registered = new Map<string, WebMcpTool>();
		Object.defineProperty(document, "modelContext", {
			value: { registerTool: (tool: WebMcpTool) => void registered.set(tool.name, tool) },
			configurable: true,
		});
		renderHook(() => usePortfolioWebMcpTools());
		expect([...registered.keys()]).toEqual(["portfolio_read", "portfolio_edit"]);
		expect(registered.get("portfolio_read")?.annotations.readOnlyHint).toBe(true);
		expect(registered.get("portfolio_edit")?.annotations.readOnlyHint).toBeUndefined();
	});

	it("reads the portfolio as it is on screen, with the edit guide", async () => {
		store().edit((draft) => {
			draft.hero.greeting = "Not saved yet";
		});
		const result = JSON.parse(await toolsFor()("portfolio_read").execute({}));
		expect(JSON.stringify(result.view)).toContain("Not saved yet");
		expect(result.guide).toContain("edit");
	});

	it("applies edits as one undo step and says what applied and what failed", async () => {
		const first = store().portfolio?.data.works.items[0];
		const result = JSON.parse(
			await toolsFor()("portfolio_edit").execute({
				title: "Add a work",
				edits: [
					{ op: "add", list: "works", item: { title: "Lumen redesign" }, ref: "lumen" },
					{ op: "remove", list: "services", id: "missing" },
				],
			}),
		);

		const data = store().portfolio?.data;
		expect(data?.works.items.map((work) => work.title)).toEqual(["First", "Lumen redesign"]);
		expect(data?.works.items[0]).toBe(first);
		expect(store().undoStack).toHaveLength(1);
		expect(result.applied).toEqual([expect.objectContaining({ index: 0, ref: "lumen", id: expect.any(String) })]);
		expect(result.failed).toEqual([expect.objectContaining({ index: 1 })]);
		expect(mocks.toast).toHaveBeenCalledTimes(1);

		store().undo();
		expect(store().portfolio?.data.works.items.map((work) => work.title)).toEqual(["First"]);
	});

	it("refuses what the plan doesn't open and changes nothing", async () => {
		const plan = portfolioEditPlan(
			{
				enabled: true,
				planId: "free",
				features: { premiumPortfolioThemes: false, premiumHeroEffects: false, hidePortfolioCredit: false },
			} as never,
			3,
		);
		const result = JSON.parse(
			await toolsFor(plan)("portfolio_edit").execute({
				title: "Theme",
				edits: [{ op: "set", path: "theme", value: "kanvas" }],
			}),
		);
		expect(result.applied).toEqual([]);
		expect(result.failed[0].error).toContain("Free");
		expect(store().undoStack).toHaveLength(0);
		expect(mocks.toast).not.toHaveBeenCalled();
	});

	it("has no plan to check while plans don't apply", () => {
		expect(portfolioEditPlan(undefined, 50)).toBeNull();
		expect(portfolioEditPlan({ enabled: false } as never, 50)).toBeNull();
	});
});
