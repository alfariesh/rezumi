import type { PortfolioRecord } from "./store";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { i18n } from "@lingui/core";
import { ORPCError } from "@orpc/client";
import { parsePortfolioData } from "@rezumi/schema/portfolio/data";

const mocks = vi.hoisted(() => ({ update: vi.fn(), get: vi.fn() }));
vi.mock("@/libs/orpc/client", () => ({ client: { portfolio: { update: mocks.update, get: mocks.get } } }));

const { LEAVE_SAVE_TIMEOUT_MS, shouldStayInEditor } = await import("./leave");
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
	hasPassword: false,
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

beforeAll(() => {
	i18n.loadAndActivate({ locale: "en", messages: {} });
});

beforeEach(() => {
	vi.resetAllMocks();
	store().load(record());
});

afterEach(() => {
	vi.useRealTimers();
	store().reset();
});

describe("leaving the editor", () => {
	it("goes at once when everything is saved", async () => {
		const confirm = vi.fn();
		expect(await shouldStayInEditor(confirm)).toBe(false);
		expect(confirm).not.toHaveBeenCalled();
	});

	it("saves what's pending first, then goes without asking", async () => {
		mocks.update.mockImplementation(({ data }) => Promise.resolve(record({ data })));
		const confirm = vi.fn();
		type("Hello");
		expect(await shouldStayInEditor(confirm)).toBe(false);
		expect(mocks.update).toHaveBeenCalledTimes(1);
		expect(confirm).not.toHaveBeenCalled();
	});

	it("asks when the save fails, and goes or stays as answered", async () => {
		mocks.update.mockRejectedValue(new ORPCError("PORTFOLIO_TOO_LARGE", { status: 413 }));
		type("Hello");
		const leave = vi.fn().mockResolvedValue(true);
		expect(await shouldStayInEditor(leave)).toBe(false);
		expect(leave).toHaveBeenCalledWith(
			"Leave without saving?",
			expect.objectContaining({ confirmText: "Leave without saving" }),
		);

		const stay = vi.fn().mockResolvedValue(false);
		expect(await shouldStayInEditor(stay)).toBe(true);
	});

	it("lets the person leave a portfolio that can't be saved anymore", async () => {
		mocks.update.mockRejectedValue(new ORPCError("NOT_FOUND", { status: 404 }));
		type("Hello");
		await store().flush();
		expect(store().status).toBe("gone");
		expect(await shouldStayInEditor(vi.fn().mockResolvedValue(true))).toBe(false);
	});

	it("asks instead of waiting for a save without an answer, which is given up and tried again later", async () => {
		vi.useFakeTimers();
		mocks.update.mockImplementation(
			(_input: unknown, { signal }: { signal: AbortSignal }) =>
				new Promise((_resolve, reject) =>
					signal.addEventListener("abort", () => reject(new DOMException("No answer", "AbortError"))),
				),
		);
		type("Hello");
		const confirm = vi.fn().mockResolvedValue(false);
		const staying = shouldStayInEditor(confirm);
		await vi.advanceTimersByTimeAsync(LEAVE_SAVE_TIMEOUT_MS);
		expect(await staying).toBe(true);
		expect(confirm).toHaveBeenCalledTimes(1);

		await vi.advanceTimersByTimeAsync(30_000 - LEAVE_SAVE_TIMEOUT_MS);
		expect(store()).toMatchObject({ status: "error", dirty: true, retry: { attempt: 1, reason: "offline" } });
	});
});
