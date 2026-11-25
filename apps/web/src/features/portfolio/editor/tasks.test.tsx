// @vitest-environment happy-dom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";

const toasts = vi.hoisted(() => ({ add: vi.fn() }));
vi.mock("@rezumi/ui/components/toast", () => ({ toast: toasts }));

const {
	addPortfolioTaskError,
	cancelPortfolioTask,
	cancelPortfolioTasks,
	clearPortfolioTaskErrors,
	portfolioTasksRunning,
	runPortfolioTask,
	showPortfolioTaskError,
	usePortfolioTask,
	usePortfolioTasksRunning,
} = await import("./tasks");

type Pending<T> = { promise: Promise<T>; resolve: (value: T) => void };

function pending<T>(): Pending<T> {
	let resolve!: (value: T) => void;
	const promise = new Promise<T>((done) => {
		resolve = done;
	});
	return { promise, resolve };
}

/** Work that waits for `gate`, and rejects with the abort reason once cancelled, like a request does. */
const until =
	<T,>(gate: Pending<T>) =>
	({ signal }: { signal: AbortSignal }) =>
		new Promise<T>((resolve, reject) => {
			signal.addEventListener("abort", () => reject(signal.reason));
			void gate.promise.then(resolve);
		});

afterEach(() => {
	cleanup();
	cancelPortfolioTasks();
	vi.useRealTimers();
	vi.clearAllMocks();
});

describe("portfolio tasks", () => {
	it("keep running with nobody watching, and show their progress to whoever opens the place later", async () => {
		const gate = pending<string>();
		const first = renderHook(() => usePortfolioTask("works.a.cover"));
		let progress: ((value: { done: number; total: number; current: string | null }) => void) | undefined;
		let running: Promise<string | undefined> = Promise.resolve(undefined);
		act(() => {
			running = runPortfolioTask("works.a.cover", (task) => {
				progress = task.progress;
				return until(gate)(task);
			});
		});
		expect(first.result.current.running).toBe(true);
		first.unmount();

		act(() => progress?.({ done: 1, total: 3, current: "b.jpg" }));
		const later = renderHook(() => usePortfolioTask("works.a.cover"));
		expect(later.result.current).toMatchObject({ running: true, progress: { done: 1, total: 3 } });

		await act(async () => {
			gate.resolve("done");
			expect(await running).toBe("done");
		});
		expect(later.result.current).toMatchObject({ running: false, progress: null, label: null });
		expect(portfolioTasksRunning()).toBe(false);
	});

	it("replace the task running for the same place, which then resolves with nothing", async () => {
		const old = runPortfolioTask("blocks.b.pdf", until(pending<string>()));
		const gate = pending<string>();
		const fresh = runPortfolioTask("blocks.b.pdf", until(gate));
		expect(await old).toBeUndefined();
		gate.resolve("new");
		expect(await fresh).toBe("new");
	});

	it("ignore the progress and messages of a task that was replaced", async () => {
		const watched = renderHook(() => usePortfolioTask("blocks.b.read"));
		let stale: { say: (label: string | null) => void; fail: (message: string) => void } | undefined;
		const old = runPortfolioTask("blocks.b.read", (task) => {
			stale = task;
			return until(pending<void>())(task);
		});
		const gate = pending<void>();
		const fresh = runPortfolioTask("blocks.b.read", until(gate));
		await old;
		act(() => {
			stale?.say("Old step");
			stale?.fail("Old failure");
		});
		expect(watched.result.current).toMatchObject({ running: true, label: null, errors: [] });
		gate.resolve();
		await act(() => fresh);
	});

	it("stop on Cancel, forgetting their messages", async () => {
		const watched = renderHook(() => usePortfolioTask("works.a.add.end.pictures"));
		act(() => addPortfolioTaskError("works.a.add.end.pictures", "Earlier problem"));
		const running = runPortfolioTask("works.a.add.end.pictures", until(pending<void>()));
		act(() => cancelPortfolioTask("works.a.add.end.pictures"));
		expect(await running).toBeUndefined();
		expect(watched.result.current).toEqual({ running: false, label: null, progress: null, errors: [] });
	});

	it("all stop when the editor puts the portfolio away", async () => {
		const one = runPortfolioTask("a", until(pending<void>()));
		const two = runPortfolioTask("b", until(pending<void>()));
		const count = renderHook(() => usePortfolioTasksRunning());
		expect(count.result.current).toBe(2);
		act(() => cancelPortfolioTasks());
		expect(await one).toBeUndefined();
		expect(await two).toBeUndefined();
		expect(count.result.current).toBe(0);
	});

	it("pass on failures other than being cancelled", async () => {
		await expect(runPortfolioTask("x", () => Promise.reject(new Error("broken")))).rejects.toThrow("broken");
		expect(portfolioTasksRunning()).toBe(false);
	});

	it("wait out a pause before starting, not running meanwhile; a newer task starts the pause over", async () => {
		vi.useFakeTimers();
		const work = vi.fn(() => Promise.resolve("read"));
		const first = runPortfolioTask("blocks.v.details", work, { delayMs: 600 });
		expect(portfolioTasksRunning()).toBe(false);
		await vi.advanceTimersByTimeAsync(300);
		const second = runPortfolioTask("blocks.v.details", work, { delayMs: 600 });
		await vi.advanceTimersByTimeAsync(300);
		expect(await first).toBeUndefined();
		expect(work).not.toHaveBeenCalled();
		await vi.advanceTimersByTimeAsync(300);
		expect(await second).toBe("read");
		expect(work).toHaveBeenCalledTimes(1);
	});

	it("say what went wrong next to the place while it's shown, and in a toast when it isn't", async () => {
		const watched = renderHook(() => usePortfolioTask("custom.s.image"));
		await act(() =>
			runPortfolioTask("custom.s.image", (task) => {
				task.fail("First");
				task.fail("Second");
				return Promise.resolve();
			}),
		);
		expect(watched.result.current.errors).toEqual(["First", "Second"]);
		expect(toasts.add).not.toHaveBeenCalled();

		act(() => showPortfolioTaskError("custom.s.image", "Only this"));
		expect(watched.result.current.errors).toEqual(["Only this"]);
		act(() => clearPortfolioTaskErrors("custom.s.image"));
		expect(watched.result.current.errors).toEqual([]);

		watched.unmount();
		addPortfolioTaskError("custom.s.image", "Nobody is looking");
		expect(toasts.add).toHaveBeenCalledWith({ type: "error", description: "Nobody is looking" });
		expect(renderHook(() => usePortfolioTask("custom.s.image")).result.current.errors).toEqual([]);
	});

	it("start with the place's earlier messages cleared", async () => {
		const watched = renderHook(() => usePortfolioTask("p"));
		act(() => addPortfolioTaskError("p", "Old"));
		const gate = pending<void>();
		let running: Promise<void> = Promise.resolve();
		act(() => {
			running = runPortfolioTask("p", until(gate)).then(() => undefined);
		});
		expect(watched.result.current.errors).toEqual([]);
		gate.resolve();
		await act(() => running);
	});
});
