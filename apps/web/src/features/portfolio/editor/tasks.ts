import type { UploadProgress } from "../images/upload";
import { useEffect } from "react";
import { create } from "zustand";
import { toast } from "@rezumi/ui/components/toast";

/**
 * Work the editor does in the background for one place in the portfolio (pictures uploading for a block, a PDF being
 * read, a link's picture being copied), kept outside the components that start it. Switching to another work or
 * another part of the editor doesn't stop it: it finishes, puts its result in the data by the ids it was started
 * with, and the place shows its progress again when it's opened. It stops when it's cancelled, when the next task for
 * the same place starts, or when the editor closes the portfolio (`cancelPortfolioTasks`).
 */
export type PortfolioTask = {
	/** Working now (after the pause it may start with). */
	running: boolean;
	/** The step it's on, in words ("Reading the link…"); null when it gives none. */
	label: string | null;
	progress: UploadProgress | null;
	/** What went wrong, for the person: kept after the task ends until dismissed or the next task for the place starts. */
	errors: readonly string[];
};

const IDLE: PortfolioTask = { running: false, label: null, progress: null, errors: [] };

const usePortfolioTasks = create<{ tasks: Readonly<Record<string, PortfolioTask>> }>()(() => ({ tasks: {} }));

const controllers = new Map<string, AbortController>();
/** How many components show each place's task now; a message for a place nobody shows becomes a toast. */
const watchers = new Map<string, number>();

function taskOf(key: string): PortfolioTask {
	return usePortfolioTasks.getState().tasks[key] ?? IDLE;
}

/** Changes a place's task; `null` forgets it. An idle task with nothing to say isn't kept. */
function patch(key: string, change: Partial<PortfolioTask> | null) {
	usePortfolioTasks.setState((state) => {
		const { [key]: previous, ...rest } = state.tasks;
		const next = change === null ? IDLE : { ...(previous ?? IDLE), ...change };
		if (!next.running && next.errors.length === 0) return previous ? { tasks: rest } : state;
		return { tasks: { ...rest, [key]: next } };
	});
}

function wait(ms: number, signal: AbortSignal): Promise<void> {
	return new Promise((resolve, reject) => {
		const onAbort = () => {
			clearTimeout(timer);
			reject(signal.reason);
		};
		const timer = setTimeout(() => {
			signal.removeEventListener("abort", onAbort);
			resolve();
		}, ms);
		signal.addEventListener("abort", onAbort, { once: true });
	});
}

/** What a task uses while it runs; once it was cancelled or replaced, its progress and messages are ignored. */
export type TaskControls = {
	signal: AbortSignal;
	/** Shows the step it's on; null hides the words. */
	say: (label: string | null) => void;
	progress: (progress: UploadProgress) => void;
	/** Tells the person something went wrong (see `addPortfolioTaskError`). */
	fail: (message: string) => void;
};

export type PortfolioTaskOptions = {
	/**
	 * A pause before it starts (a pause in typing an address): the next task for the place starts the pause over, and
	 * it doesn't count as running meanwhile.
	 */
	delayMs?: number;
};

/**
 * Runs `work` as the task for a place (`key`, such as `works.<id>.blocks.<id>.pdf`), cancelling the one running there
 * and clearing its messages. Resolves with what `work` returned, or `undefined` when it was cancelled or replaced: a
 * cancelled task must not change the data, and deletes what it uploaded. Other failures are passed on.
 */
export async function runPortfolioTask<T>(
	key: string,
	work: (task: TaskControls) => Promise<T>,
	options: PortfolioTaskOptions = {},
): Promise<T | undefined> {
	controllers.get(key)?.abort();
	const controller = new AbortController();
	controllers.set(key, controller);
	const { signal } = controller;
	const current = () => controllers.get(key) === controller;
	patch(key, null);

	try {
		if (options.delayMs) await wait(options.delayMs, signal);
		patch(key, { running: true });
		return await work({
			signal,
			say: (label) => {
				if (current()) patch(key, { label });
			},
			progress: (progress) => {
				if (current()) patch(key, { progress });
			},
			fail: (message) => {
				if (current()) addPortfolioTaskError(key, message);
			},
		});
	} catch (error) {
		if (signal.aborted) return undefined;
		throw error;
	} finally {
		if (current()) {
			controllers.delete(key);
			patch(key, { running: false, label: null, progress: null });
		}
	}
}

/** Stops a place's task (Cancel, or a choice that makes its result unwanted) and forgets its messages. */
export function cancelPortfolioTask(key: string): void {
	const controller = controllers.get(key);
	controllers.delete(key);
	controller?.abort();
	patch(key, null);
}

/** Stops every task: the editor closed or reset the portfolio, so their results have nowhere to go. */
export function cancelPortfolioTasks(): void {
	const running = [...controllers.values()];
	controllers.clear();
	for (const controller of running) controller.abort();
	usePortfolioTasks.setState({ tasks: {} });
}

/**
 * Tells the person something about a place's task went wrong: next to the place while it's shown, as a toast when
 * it isn't (the person moved on to another work or another part of the editor).
 */
export function addPortfolioTaskError(key: string, message: string): void {
	if (!watchers.get(key)) {
		toast.add({ type: "error", description: message });
		return;
	}
	patch(key, { errors: [...taskOf(key).errors, message] });
}

/** Replaces a place's messages with one (an address that can't be used, said before any task starts). */
export function showPortfolioTaskError(key: string, message: string): void {
	patch(key, { errors: [] });
	addPortfolioTaskError(key, message);
}

export function clearPortfolioTaskErrors(key: string): void {
	patch(key, { errors: [] });
}

/** Whether any task is working now (leaving the editor or closing the tab would stop it). */
export function portfolioTasksRunning(): boolean {
	return Object.values(usePortfolioTasks.getState().tasks).some((task) => task.running);
}

/** How many tasks are working now. */
export function usePortfolioTasksRunning(): number {
	return usePortfolioTasks((state) => Object.values(state.tasks).filter((task) => task.running).length);
}

/** A place's task, for the place to show; while it's shown, its messages appear here instead of as toasts. */
export function usePortfolioTask(key: string): PortfolioTask {
	useEffect(() => {
		watchers.set(key, (watchers.get(key) ?? 0) + 1);
		return () => {
			const left = (watchers.get(key) ?? 1) - 1;
			if (left > 0) watchers.set(key, left);
			else watchers.delete(key);
		};
	}, [key]);
	return usePortfolioTasks((state) => state.tasks[key] ?? IDLE);
}
