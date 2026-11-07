import type { PortfolioRecord } from "./store";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { ORPCError } from "@orpc/client";
import { parsePortfolioData } from "@rezumi/schema/portfolio/data";

const mocks = vi.hoisted(() => ({ update: vi.fn(), get: vi.fn() }));
vi.mock("@/libs/orpc/client", () => ({ client: { portfolio: { update: mocks.update, get: mocks.get } } }));

const { changeSetting } = await import("./settings");
const { usePortfolioEditorStore } = await import("./store");

const opened = new Date("2026-11-06T01:00:00.000Z");
const record = (patch: Partial<PortfolioRecord> = {}): PortfolioRecord => ({
	id: "portfolio",
	sourceResumeId: null,
	sourceResume: null,
	isPublic: false,
	showInSearchEngines: true,
	publishedAt: null,
	suspendedAt: null,
	suspendedReason: null,
	data: parsePortfolioData({}),
	createdAt: opened,
	updatedAt: opened,
	...patch,
});
const store = () => usePortfolioEditorStore.getState();
const type = (greeting: string) =>
	store().edit((draft) => {
		draft.hero.greeting = greeting;
	});

beforeEach(() => {
	vi.resetAllMocks();
	store().load(record());
});

afterEach(() => store().reset());

describe("publishing and other settings", () => {
	it("publish only once the edits are saved, so the page never goes live without them", async () => {
		const order: string[] = [];
		mocks.update.mockImplementation(({ data }) => {
			order.push("save");
			return Promise.resolve(record({ data, updatedAt: new Date(opened.getTime() + 1000) }));
		});
		const publish = vi.fn(() => {
			order.push("publish");
			return Promise.resolve(record({ isPublic: true }));
		});
		type("Hello");
		expect(await changeSetting(publish, { saveFirst: true })).toBe("changed");
		expect(order).toEqual(["save", "publish"]);
		expect(store().portfolio).toMatchObject({ isPublic: true, updatedAt: new Date(opened.getTime() + 1000) });
	});

	it("don't publish when the edits can't be saved", async () => {
		mocks.update.mockRejectedValue(new ORPCError("PORTFOLIO_FILE_NOT_FOUND", { status: 400, data: { key: "k" } }));
		const publish = vi.fn(() => Promise.resolve(record({ isPublic: true })));
		type("Hello");
		expect(await changeSetting(publish, { saveFirst: true })).toBe("unsaved");
		expect(publish).not.toHaveBeenCalled();
		expect(store().portfolio?.isPublic).toBe(false);
	});

	it("change other settings whatever the save status, keeping the edits", async () => {
		mocks.update.mockRejectedValue(new TypeError("Failed to fetch"));
		type("Hello");
		await store().flush();
		const unpublish = vi.fn(() => Promise.resolve(record({ showInSearchEngines: false })));
		expect(await changeSetting(unpublish)).toBe("changed");
		expect(store().portfolio).toMatchObject({ showInSearchEngines: false });
		expect(store().portfolio?.data.hero.greeting).toBe("Hello");
		expect(store().dirty).toBe(true);
	});
});
