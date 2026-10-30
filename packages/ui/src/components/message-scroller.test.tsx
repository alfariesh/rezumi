import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { StrictMode } from "react";
import {
	MessageScroller,
	MessageScrollerButton,
	MessageScrollerContent,
	MessageScrollerItem,
	MessageScrollerProvider,
	MessageScrollerViewport,
} from "./message-scroller";
import { PREVIOUS_ROW_PEEK } from "./message-scroller-logic";

/*
 * happy-dom has no layout, so these tests give the transcript a small one: a 600px viewport over a column of rows
 * (12px padding, 12px gap) whose heights come from `data-h`. The scroller measures it through the same DOM calls it
 * uses in a browser, so a session can be played out step by step.
 */
const VIEWPORT_TOP = 100;
const VIEWPORT_HEIGHT = 600;
const PADDING = 12;
const GAP = 12;

type Row = { id: string; kind: "user" | "assistant" | "other"; height: number };

const user = (id: string, height = 40): Row => ({ id, kind: "user", height });
const reply = (id: string, height: number): Row => ({ id, kind: "assistant", height });
const other = (id: string, height: number): Row => ({ id, kind: "other", height });

const isViewport = (element: unknown) => element instanceof HTMLElement && element.getAttribute("role") === "region";

function required<T>(value: T | null): T {
	if (value === null) throw new Error("Expected the element to exist");
	return value;
}

function lay(content: HTMLElement) {
	const boxes = new Map<Element, { top: number; height: number }>();
	let y = PADDING;
	let first = true;
	for (const child of Array.from(content.children) as HTMLElement[]) {
		if (child.hidden) continue;
		const isSpacer = child.dataset.slot === "message-scroller-spacer";
		const height = isSpacer ? Number.parseFloat(child.style.height || "0") : Number(child.dataset.h);
		if (!first) y += GAP;
		y += Number.parseFloat(child.style.marginTop || "0");
		boxes.set(child, { top: y, height });
		y += height;
		first = false;
	}
	return { boxes, total: y + PADDING };
}

function contentOf(viewport: HTMLElement) {
	return viewport.querySelector<HTMLElement>('[role="log"]');
}

const resizeCallbacks = new Set<() => void>();
const restore: Array<() => void> = [];

function override(target: object, key: string, descriptor: PropertyDescriptor) {
	const previous = Object.getOwnPropertyDescriptor(target, key);
	Object.defineProperty(target, key, { configurable: true, ...descriptor });
	restore.push(() => {
		if (previous) Object.defineProperty(target, key, previous);
		else Reflect.deleteProperty(target, key);
	});
}

function installLayout() {
	const scrollTops = new WeakMap<Element, number>();
	const maxScrollTop = (viewport: HTMLElement) => {
		const content = contentOf(viewport);
		return Math.max(0, (content ? lay(content).total : 0) - VIEWPORT_HEIGHT);
	};
	const noBox = { top: 0, bottom: 0, height: 0, left: 0, right: 0, width: 0 };

	override(HTMLElement.prototype, "scrollTop", {
		get(this: HTMLElement) {
			return isViewport(this) ? Math.min(scrollTops.get(this) ?? 0, maxScrollTop(this)) : 0;
		},
		set(this: HTMLElement, value: number) {
			if (isViewport(this)) scrollTops.set(this, Math.max(0, Math.min(value, maxScrollTop(this))));
		},
	});
	override(HTMLElement.prototype, "clientHeight", {
		get(this: HTMLElement) {
			return isViewport(this) ? VIEWPORT_HEIGHT : 0;
		},
	});
	override(HTMLElement.prototype, "scrollHeight", {
		get(this: HTMLElement) {
			if (!isViewport(this)) return 0;
			const content = contentOf(this);
			return Math.max(VIEWPORT_HEIGHT, content ? lay(content).total : 0);
		},
	});
	override(HTMLElement.prototype, "scrollTo", {
		value(this: HTMLElement, options: ScrollToOptions) {
			if (isViewport(this)) this.scrollTop = options.top ?? 0;
		},
	});
	override(HTMLElement.prototype, "getBoundingClientRect", {
		value(this: HTMLElement) {
			if (isViewport(this)) {
				return { ...noBox, top: VIEWPORT_TOP, bottom: VIEWPORT_TOP + VIEWPORT_HEIGHT, height: VIEWPORT_HEIGHT };
			}
			const viewport = this.closest<HTMLElement>('[role="region"]');
			const content = viewport ? contentOf(viewport) : null;
			if (!viewport || !content) return noBox;
			const { boxes, total } = lay(content);
			const origin = VIEWPORT_TOP - viewport.scrollTop;
			if (this === content) return { ...noBox, top: origin, bottom: origin + total, height: total };
			const box = boxes.get(this);
			if (!box) return noBox;
			return { ...noBox, top: origin + box.top, bottom: origin + box.top + box.height, height: box.height };
		},
	});
	const computedStyle = window.getComputedStyle.bind(window);
	override(window, "getComputedStyle", {
		value: (element: Element) =>
			element.getAttribute("role") === "log"
				? ({
						paddingBlockStart: `${PADDING}px`,
						paddingBlockEnd: `${PADDING}px`,
						rowGap: `${GAP}px`,
					} as CSSStyleDeclaration)
				: computedStyle(element),
	});
	override(globalThis, "ResizeObserver", {
		value: class {
			private readonly callback: () => void;
			constructor(callback: () => void) {
				this.callback = callback;
			}
			observe() {
				resizeCallbacks.add(this.callback);
			}
			unobserve() {}
			disconnect() {
				resizeCallbacks.delete(this.callback);
			}
		},
	});
}

/** Lets mutation observers and animation frames run. */
async function settle() {
	await act(async () => {
		await vi.advanceTimersByTimeAsync(20);
	});
}

/** The transcript changed size, as a browser would report after the rows were laid out again. */
async function resized() {
	await act(async () => {
		for (const callback of Array.from(resizeCallbacks)) callback();
		await vi.advanceTimersByTimeAsync(20);
	});
}

type TranscriptProps = { rows: Row[]; autoScroll?: boolean; onWheel?: () => void };

function Transcript({ rows, autoScroll = true, onWheel }: TranscriptProps) {
	return (
		<MessageScrollerProvider autoScroll={autoScroll} defaultScrollPosition="last-anchor">
			<MessageScroller>
				<MessageScrollerViewport aria-label="Conversation" onWheel={onWheel}>
					<MessageScrollerContent>
						{rows.map((row) => (
							<MessageScrollerItem
								key={row.id}
								messageId={row.id}
								scrollAnchor={row.kind === "user"}
								data-h={row.height}
							>
								{row.id}
							</MessageScrollerItem>
						))}
					</MessageScrollerContent>
				</MessageScrollerViewport>
				<MessageScrollerButton>Latest</MessageScrollerButton>
			</MessageScroller>
		</MessageScrollerProvider>
	);
}

const turn = (n: number, replyHeight = 300): Row[] => [user(`u${n}`), reply(`a${n}`, replyHeight)];

function viewport() {
	return screen.getByRole("region", { name: "Conversation" });
}

function latest() {
	return screen.getByRole("button", { name: "Latest", hidden: true });
}

function spacer() {
	return required(viewport().querySelector<HTMLElement>('[data-slot="message-scroller-spacer"]'));
}

/** Where the top of a row is, in scroll coordinates. */
function topOf(id: string) {
	const row = required(viewport().querySelector<HTMLElement>(`[data-message-id="${id}"]`));
	return required(lay(required(contentOf(viewport()))).boxes.get(row) ?? null).top;
}

function bottomScrollTop() {
	const element = viewport();
	return element.scrollHeight - element.clientHeight;
}

/** A reply growing from a short first sentence to a long answer: one render and one resize per step. */
async function grow(view: ReturnType<typeof render>, before: Row[], id: string, heights: number[]) {
	for (const height of heights) {
		view.rerender(<Transcript rows={[...before, reply(id, height)]} />);
		await settle();
		await resized();
	}
}

describe("MessageScroller", () => {
	beforeEach(() => {
		vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "requestAnimationFrame", "cancelAnimationFrame"] });
		resizeCallbacks.clear();
		installLayout();
	});

	afterEach(() => {
		cleanup();
		vi.restoreAllMocks();
		for (const undo of restore.splice(0).reverse()) undo();
		vi.useRealTimers();
	});

	it("marks up a labelled region holding a log of rows", async () => {
		render(<Transcript rows={turn(1)} />);
		await settle();
		expect(viewport()).toHaveAttribute("tabindex", "0");
		expect(screen.getByRole("log")).toHaveAttribute("aria-relevant", "additions");
		expect(screen.getByRole("log").querySelectorAll('[data-scroll-anchor="true"]')).toHaveLength(1);
	});

	describe("opening a saved thread", () => {
		it("opens on the last turn, leaving a peek of the row above it", async () => {
			render(<Transcript rows={[...turn(1), ...turn(2), ...turn(3), ...turn(4, 900)]} />);
			await settle();
			expect(viewport().scrollTop).toBe(topOf("u4") - PADDING - PREVIOUS_ROW_PEEK);
			expect(viewport()).not.toHaveAttribute("data-pending-scroll");
		});

		it("opens at the end when the last turn fits the viewport", async () => {
			render(<Transcript rows={[...turn(1), ...turn(2), ...turn(3), ...turn(4)]} />);
			await settle();
			expect(viewport().scrollTop).toBe(bottomScrollTop());
			expect(viewport().scrollTop).not.toBe(topOf("u4") - PADDING - PREVIOUS_ROW_PEEK);
		});

		it("is visible straight away when the thread is empty", async () => {
			render(<Transcript rows={[]} />);
			await settle();
			expect(viewport()).not.toHaveAttribute("data-pending-scroll");
		});

		it("opens the same way when React mounts everything twice", async () => {
			render(
				<StrictMode>
					<Transcript rows={[...turn(1), ...turn(2, 900)]} />
				</StrictMode>,
			);
			await settle();
			expect(viewport().scrollTop).toBe(topOf("u2") - PADDING - PREVIOUS_ROW_PEEK);
			expect(viewport()).not.toHaveAttribute("data-pending-scroll");
		});
	});

	describe("a new turn", () => {
		const earlier = turn(1);

		it("settles near the top and holds there while a short reply fills in", async () => {
			const view = render(<Transcript rows={earlier} />);
			await settle();
			const asked = [...earlier, user("u2", 60)];
			view.rerender(<Transcript rows={asked} />);
			await settle();
			await resized();
			const settledAt = viewport().scrollTop;
			expect(settledAt).toBe(topOf("u2") - PADDING - PREVIOUS_ROW_PEEK);
			expect(spacer().hidden).toBe(false);

			await grow(view, asked, "a2", [30, 150, 330]);
			expect(viewport().scrollTop).toBe(settledAt);
			expect(spacer().hidden).toBe(false);
		});

		it("follows the reply once it outgrows the viewport", async () => {
			const view = render(<Transcript rows={earlier} />);
			await settle();
			const asked = [...earlier, user("u2", 60)];
			view.rerender(<Transcript rows={asked} />);
			await settle();
			await resized();

			await grow(view, asked, "a2", [330, 700, 1200]);
			expect(spacer().hidden).toBe(true);
			expect(viewport().scrollTop).toBe(bottomScrollTop());
			expect(latest()).toHaveAttribute("data-active", "false");
		});
	});

	describe("following a reply", () => {
		const asked = [...turn(1), user("u2")];

		it("stops when the reader scrolls up, and the Latest button brings them back", async () => {
			const onWheel = vi.fn();
			const view = render(<Transcript rows={[...asked, reply("a2", 100)]} />);
			await settle();
			await grow(view, asked, "a2", [500, 800]);
			expect(viewport().scrollTop).toBe(bottomScrollTop());
			expect(latest()).toHaveAttribute("data-active", "false");
			expect(latest()).toHaveAttribute("inert");
			expect(latest()).toHaveAttribute("tabindex", "-1");

			view.rerender(<Transcript rows={[...asked, reply("a2", 800)]} onWheel={onWheel} />);
			fireEvent.wheel(viewport());
			viewport().scrollTop -= 250;
			fireEvent.scroll(viewport());
			await settle();
			expect(onWheel).toHaveBeenCalledOnce();
			const readingAt = viewport().scrollTop;
			expect(latest()).toHaveAttribute("data-active", "true");
			expect(latest()).not.toHaveAttribute("inert");
			expect(latest()).not.toHaveAttribute("tabindex");

			await grow(view, asked, "a2", [1000, 1300]);
			expect(viewport().scrollTop).toBe(readingAt);
			expect(latest()).toHaveAttribute("data-active", "true");

			fireEvent.click(latest());
			await settle();
			expect(viewport().scrollTop).toBe(bottomScrollTop());
			expect(latest()).toHaveAttribute("data-active", "false");

			await grow(view, asked, "a2", [1600]);
			expect(viewport().scrollTop).toBe(bottomScrollTop());
		});

		it("stops when the reader presses a scrolling key, but not for other keys", async () => {
			const view = render(<Transcript rows={[...asked, reply("a2", 100)]} />);
			await settle();
			await grow(view, asked, "a2", [800]);

			fireEvent.keyDown(viewport(), { key: "a" });
			await grow(view, asked, "a2", [900]);
			expect(viewport().scrollTop).toBe(bottomScrollTop());

			fireEvent.keyDown(viewport(), { key: "PageUp" });
			viewport().scrollTop -= 300;
			fireEvent.scroll(viewport());
			await settle();
			const readingAt = viewport().scrollTop;
			await grow(view, asked, "a2", [1100]);
			expect(viewport().scrollTop).toBe(readingAt);
		});

		it("resumes when the reader scrolls back to the bottom", async () => {
			const view = render(<Transcript rows={[...asked, reply("a2", 100)]} />);
			await settle();
			await grow(view, asked, "a2", [800]);
			fireEvent.wheel(viewport());
			viewport().scrollTop -= 250;
			fireEvent.scroll(viewport());
			await settle();
			expect(latest()).toHaveAttribute("data-active", "true");

			viewport().scrollTop = bottomScrollTop();
			fireEvent.scroll(viewport());
			await settle();
			expect(latest()).toHaveAttribute("data-active", "false");

			await grow(view, asked, "a2", [1100]);
			expect(viewport().scrollTop).toBe(bottomScrollTop());
		});

		it("still settles a new turn, but never follows its reply, without autoScroll", async () => {
			const rows = [...turn(1), ...turn(2, 500)];
			const view = render(<Transcript rows={rows} autoScroll={false} />);
			await settle();
			const openedAt = viewport().scrollTop;
			const asked = [...rows, user("u3")];
			view.rerender(<Transcript rows={[...asked, reply("a3", 900)]} autoScroll={false} />);
			await settle();
			await resized();
			const settledAt = viewport().scrollTop;
			expect(settledAt).toBe(topOf("u3") - PADDING - PREVIOUS_ROW_PEEK);
			expect(settledAt).toBeGreaterThan(openedAt);
			expect(latest()).toHaveAttribute("data-active", "true");

			view.rerender(<Transcript rows={[...asked, reply("a3", 1500)]} autoScroll={false} />);
			await settle();
			await resized();
			expect(viewport().scrollTop).toBe(settledAt);
			expect(settledAt).toBeLessThan(bottomScrollTop());
		});
	});

	describe("the Latest button", () => {
		async function awayFromTheEnd() {
			render(<Transcript rows={[...turn(1), user("u2"), other("a2", 1200)]} />);
			await settle();
			fireEvent.wheel(viewport());
			viewport().scrollTop = 0;
			fireEvent.scroll(viewport());
			await settle();
		}

		it("scrolls smoothly", async () => {
			await awayFromTheEnd();
			const scrollTo = vi.spyOn(viewport(), "scrollTo");
			fireEvent.click(latest());
			expect(scrollTo).toHaveBeenCalledWith({ top: bottomScrollTop(), behavior: "smooth" });
		});

		it("jumps instead when the reader prefers reduced motion", async () => {
			vi.spyOn(window, "matchMedia").mockImplementation(
				(query) => ({ matches: query.includes("reduce"), media: query }) as MediaQueryList,
			);
			await awayFromTheEnd();
			const scrollTo = vi.spyOn(viewport(), "scrollTo");
			fireEvent.click(latest());
			expect(scrollTo).toHaveBeenCalledWith({ top: bottomScrollTop(), behavior: "auto" });
		});

		it("does nothing while it is inert", async () => {
			render(<Transcript rows={turn(1)} />);
			await settle();
			const scrollTo = vi.spyOn(viewport(), "scrollTo");
			fireEvent.click(latest());
			expect(scrollTo).not.toHaveBeenCalled();
		});
	});
});
