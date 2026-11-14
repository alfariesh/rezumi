import { afterEach, beforeEach, expect, it, vi } from "vite-plus/test";
import { startJobScheduler } from "./job-scheduler";

const run = vi.hoisted(() => vi.fn<() => Promise<{ processed: number }>>());
const billing = vi.hoisted(() => vi.fn<() => Promise<{ releasedReservations: number }>>());
const portfolio = vi.hoisted(() => vi.fn<() => Promise<{ deletedFiles: number; checkedPortfolios: number }>>());
vi.mock("@rezumi/api/features/career/jobs", () => ({ runCareerJobs: run }));
vi.mock("@rezumi/api/features/billing/jobs", () => ({ runBillingJobs: billing }));
vi.mock("@rezumi/api/features/portfolio/jobs", () => ({ runPortfolioJobs: portfolio }));
vi.mock("@rezumi/api/features/applications/extension-jobs", () => ({
	runExtensionJobs: vi.fn(async () => ({ emailed: false, deleted: 0 })),
}));

beforeEach(() => {
	vi.useFakeTimers();
	run.mockReset().mockResolvedValue({ processed: 0 });
	billing.mockReset().mockResolvedValue({ releasedReservations: 0 });
	portfolio.mockReset().mockResolvedValue({ deletedFiles: 0, checkedPortfolios: 0 });
});
afterEach(() => {
	vi.useRealTimers();
	vi.restoreAllMocks();
});

it("starts immediately, skips overlapping ticks, and drains active work before stopping", async () => {
	const first = Promise.withResolvers<{ processed: number }>();
	run.mockReturnValueOnce(first.promise);
	const scheduler = startJobScheduler();
	await vi.advanceTimersByTimeAsync(0);
	expect(run).toHaveBeenCalledTimes(1);
	await vi.advanceTimersByTimeAsync(120_000);
	expect(run).toHaveBeenCalledTimes(1);
	first.resolve({ processed: 1 });
	await vi.advanceTimersByTimeAsync(60_000);
	expect(run).toHaveBeenCalledTimes(2);

	const active = Promise.withResolvers<{ processed: number }>();
	run.mockReturnValueOnce(active.promise);
	await vi.advanceTimersByTimeAsync(60_000);
	expect(run).toHaveBeenCalledTimes(3);
	const stopped = vi.fn();
	const drain = scheduler.stop().then(stopped);
	await vi.advanceTimersByTimeAsync(120_000);
	expect(stopped).not.toHaveBeenCalled();
	expect(run).toHaveBeenCalledTimes(3);
	active.resolve({ processed: 1 });
	await drain;
	expect(stopped).toHaveBeenCalledOnce();
	await vi.advanceTimersByTimeAsync(60_000);
	expect(run).toHaveBeenCalledTimes(3);
	expect(billing).toHaveBeenCalledTimes(3);
});

it("runs billing, then career, then portfolio upkeep on every tick", async () => {
	const order: string[] = [];
	billing.mockImplementation(async () => {
		order.push("billing");
		return { releasedReservations: 0 };
	});
	run.mockImplementation(async () => {
		order.push("career");
		return { processed: 0 };
	});
	portfolio.mockImplementation(async () => {
		order.push("portfolio");
		return { deletedFiles: 0, checkedPortfolios: 0 };
	});
	const scheduler = startJobScheduler();
	try {
		await vi.advanceTimersByTimeAsync(60_000);
		expect(order).toEqual(["billing", "career", "portfolio", "billing", "career", "portfolio"]);
	} finally {
		await scheduler.stop();
	}
});

it("still runs career work when billing fails, and recovers on the next tick without logging payloads", async () => {
	const log = vi.spyOn(console, "error").mockImplementation(() => {});
	billing.mockRejectedValueOnce(new Error("private billing payload"));
	run.mockRejectedValueOnce(new Error("private provider payload"));
	const scheduler = startJobScheduler();
	try {
		await vi.advanceTimersByTimeAsync(0);
		expect(run).toHaveBeenCalledOnce();
		expect(portfolio).toHaveBeenCalledOnce();
		expect(log).toHaveBeenCalledTimes(2);
		expect(JSON.stringify(log.mock.calls)).not.toContain("private");
		await vi.advanceTimersByTimeAsync(60_000);
		expect(billing).toHaveBeenCalledTimes(2);
		expect(run).toHaveBeenCalledTimes(2);
	} finally {
		await scheduler.stop();
	}
});
