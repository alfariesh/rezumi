/*
 * Scroll controller for the message scroller, adapted from shadcn/react's message scroller (MIT License,
 * Copyright (c) 2023 shadcn) and owned here. It measures the transcript, applies the decisions from
 * `message-scroller-logic.ts` and tells the Latest button and the viewport what to show. One instance lives in each
 * `MessageScrollerProvider`; the parts attach their elements through its ref callbacks.
 */
import type { ScrollMode } from "./message-scroller-logic";
import {
	AUTOSCROLL_WINDOW_MS,
	SCROLL_EPSILON,
	findLastAnchor,
	getAnchorScrollTop,
	getContentExtent,
	getRows,
	getSpacerHeight,
	hasContentBelow,
	isScrolledUp,
	nextScrollMode,
	parsePx,
	planContentChange,
	turnFitsViewport,
} from "./message-scroller-logic";

export type DefaultScrollPosition = "end" | "last-anchor";

type ControllerOptions = {
	autoScroll: boolean;
	defaultScrollPosition: DefaultScrollPosition;
};

/** A boolean that React reads with `useSyncExternalStore`. */
export type Flag = {
	get: () => boolean;
	set: (value: boolean) => void;
	subscribe: (listener: () => void) => () => void;
};

function createFlag(initial: boolean): Flag {
	let value = initial;
	const listeners = new Set<() => void>();
	return {
		get: () => value,
		set: (next) => {
			if (next === value) return;
			value = next;
			for (const listener of listeners) listener();
		},
		subscribe: (listener) => {
			listeners.add(listener);
			return () => {
				listeners.delete(listener);
			};
		},
	};
}

/** Runs `callback` on the next frame after `element` resizes (once per frame, however often it resizes). */
function observeResize(element: HTMLElement, callback: () => void): () => void {
	if (typeof ResizeObserver === "undefined") return () => {};
	let frame = 0;
	const observer = new ResizeObserver(() => {
		window.cancelAnimationFrame(frame);
		frame = window.requestAnimationFrame(callback);
	});
	observer.observe(element);
	return () => {
		window.cancelAnimationFrame(frame);
		observer.disconnect();
	};
}

function readBlockPadding(element: HTMLElement): { start: number; end: number } {
	const style = window.getComputedStyle(element);
	return {
		start: parsePx(style.paddingBlockStart || style.paddingTop),
		end: parsePx(style.paddingBlockEnd || style.paddingBottom),
	};
}

function readRowGap(element: HTMLElement | null): number {
	if (!element) return 0;
	const style = window.getComputedStyle(element);
	return parsePx(style.rowGap === "normal" ? style.gap : style.rowGap);
}

export class MessageScrollerController {
	/** True until the transcript has been moved to its starting position, so the viewport can stay hidden meanwhile. */
	readonly pendingScroll = createFlag(true);
	/** True while there is newer content below and the reader is not following it: the Latest button is active. */
	readonly canScrollToEnd = createFlag(false);

	private viewport: HTMLElement | null = null;
	private content: HTMLElement | null = null;
	private spacer: HTMLElement | null = null;
	private spacerGap = 0;
	private spacerHeight = 0;

	private autoScroll: boolean;
	private readonly defaultScrollPosition: DefaultScrollPosition;

	private mode: ScrollMode;
	/** The turn start that was scrolled near the top; set exactly while `mode` is `anchored`. */
	private anchoredRow: HTMLElement | null = null;
	private handledAnchors = new WeakSet<HTMLElement>();
	private rowCount = 0;
	private openedAtDefaultPosition = false;
	private lastScrollTop = 0;
	private autoscrolling = false;
	private autoscrollTimer: number | null = null;
	private stateFrame: number | null = null;

	constructor({ autoScroll, defaultScrollPosition }: ControllerOptions) {
		this.autoScroll = autoScroll;
		this.defaultScrollPosition = defaultScrollPosition;
		this.mode = autoScroll ? "following" : "free";
	}

	/** Ref callback for the scrolling element. */
	readonly attachViewport = (node: HTMLElement | null) => {
		if (!node) return;
		this.viewport = node;
		const stopObserving = observeResize(node, () => this.handleResize());
		return () => {
			stopObserving();
			this.viewport = null;
		};
	};

	/** Ref callback for the transcript element that holds the rows and the spacer. */
	readonly attachContent = (node: HTMLElement | null) => {
		if (!node) return;
		this.content = node;
		this.handleContentChange();
		const mutations =
			typeof MutationObserver === "undefined" ? null : new MutationObserver(() => this.handleContentChange());
		mutations?.observe(node, { childList: true });
		const stopObserving = observeResize(node, () => this.handleResize());
		return () => {
			stopObserving();
			mutations?.disconnect();
			this.content = null;
		};
	};

	/** Ref callback for the empty block after the rows that gives a short transcript room to scroll a turn to the top. */
	readonly attachSpacer = (node: HTMLElement | null) => {
		if (!node) return;
		this.spacer = node;
		this.spacerGap = readRowGap(node.parentElement);
		return () => {
			this.spacer = null;
			this.spacerGap = 0;
		};
	};

	/** Once, after the first render has attached everything: open at the starting position. */
	mount() {
		if (!this.applyDefaultScrollPosition() && this.rowCount === 0) this.pendingScroll.set(false);
	}

	/** Cancels pending frames and timers. */
	unmount() {
		if (this.stateFrame !== null) window.cancelAnimationFrame(this.stateFrame);
		this.stateFrame = null;
		if (this.autoscrollTimer !== null) window.clearTimeout(this.autoscrollTimer);
		this.autoscrollTimer = null;
		this.autoscrolling = false;
	}

	/** On mount and whenever the `autoScroll` prop changes. */
	setAutoScroll(autoScroll: boolean) {
		this.autoScroll = autoScroll;
		if (autoScroll && this.mode === "following" && this.rowCount > 0) this.scrollToEnd();
		else this.commitScrollState();
	}

	handleScroll() {
		this.commitScrollState();
	}

	/** The reader scrolled by hand (wheel, touch or a scrolling key): stop following and stop holding a turn at the top. */
	handleUserScrollIntent() {
		if (this.mode === "free") return;
		this.mode = "free";
		this.anchoredRow = null;
	}

	/** Moves to the latest content and, with `autoScroll`, resumes following it. */
	scrollToEnd({ behavior = "auto" }: { behavior?: ScrollBehavior } = {}): boolean {
		const viewport = this.viewport;
		if (!viewport) return false;
		this.setSpacerHeight(0);
		this.anchoredRow = null;
		this.mode = this.autoScroll ? "following" : "free";
		this.scrollViewportTo(Math.max(0, viewport.scrollHeight - viewport.clientHeight), {
			behavior,
			autoscrolling: true,
		});
		return true;
	}

	/** The rows changed (added, removed or replaced). */
	private handleContentChange() {
		const content = this.content;
		if (!content) return;
		const rows = getRows(content, this.spacer);
		const previousCount = this.rowCount;
		this.rowCount = rows.length;

		if (previousCount === 0) {
			// The first rows: a saved thread opened, or a first message sent.
			if (this.applyDefaultScrollPosition()) return;
			if (rows.length > 0 && this.autoScroll && this.scrollToEnd()) return;
			this.commitScrollState();
			return;
		}

		const change = planContentChange({
			rows,
			previousCount,
			handledAnchors: this.handledAnchors,
			autoScroll: this.autoScroll,
			mode: this.mode,
		});
		if (change.type === "follow") {
			this.scrollToEnd();
		} else if (change.type === "anchor") {
			this.anchorTo(change.row);
			this.handledAnchors.add(change.row);
		} else {
			this.commitScrollState();
		}
	}

	/** The viewport or the transcript changed size (a reply grew, the window resized). */
	private handleResize() {
		if (this.mode === "following" && this.autoScroll) {
			this.scrollToEnd();
			return;
		}
		const spacerHeightBefore = this.spacerHeight;
		if (this.reanchor()) {
			// The reply has grown past the viewport, so the spacer is used up: carry on following the latest content.
			if (this.autoScroll && spacerHeightBefore > 0 && this.spacerHeight === 0) this.scrollToEnd();
			return;
		}
		this.scheduleStateCommit();
	}

	/** Opens a thread at its starting position once it has rows. Returns whether it did. */
	private applyDefaultScrollPosition(): boolean {
		if (this.openedAtDefaultPosition || this.rowCount === 0) return false;
		const opened = this.defaultScrollPosition === "last-anchor" ? this.openOnLastTurn() : this.scrollToEnd();
		if (!opened) return false;
		this.openedAtDefaultPosition = true;
		this.pendingScroll.set(false);
		return true;
	}

	/** Opens on the last turn's first row, or at the end when the turn fits the viewport (or there is no turn). */
	private openOnLastTurn(): boolean {
		const { content, viewport } = this;
		const anchor = content && viewport ? findLastAnchor(getRows(content, this.spacer)) : null;
		if (!content || !viewport || !anchor) return this.scrollToEnd();
		const fits = turnFitsViewport({
			contentExtent: this.measureContentExtent(),
			anchorOffsetTop: this.measureOffsetTop(anchor),
			clientHeight: viewport.clientHeight,
		});
		return fits ? this.scrollToEnd() : this.anchorTo(anchor);
	}

	/**
	 * Scrolls a turn's first row near the top. A spacer after the transcript makes that possible while the reply is
	 * short; it is trimmed as the reply grows (see `reanchor`).
	 */
	private anchorTo(row: HTMLElement): boolean {
		const { content, viewport } = this;
		if (!content || !viewport || !content.contains(row)) return false;
		const target = getAnchorScrollTop({
			anchorOffsetTop: this.measureOffsetTop(row),
			paddingStart: readBlockPadding(content).start,
		});
		this.setSpacerHeight(
			getSpacerHeight({
				scrollTop: target,
				clientHeight: viewport.clientHeight,
				contentExtent: this.measureContentExtent(),
			}),
		);
		this.mode = "anchored";
		this.anchoredRow = row;
		this.scrollViewportTo(target, { behavior: "auto", autoscrolling: false });
		return true;
	}

	/** Keeps the anchored turn where it is after the transcript changed size. Returns whether there was one. */
	private reanchor(): boolean {
		const row = this.anchoredRow;
		if (!row || !row.isConnected || this.mode !== "anchored") return false;
		return this.anchorTo(row);
	}

	private scrollViewportTo(
		top: number,
		{ behavior, autoscrolling }: { behavior: ScrollBehavior; autoscrolling: boolean },
	) {
		const viewport = this.viewport;
		if (!viewport) return;
		const target = Math.max(0, top);
		if (Math.abs(viewport.scrollTop - target) <= SCROLL_EPSILON) {
			viewport.scrollTop = target;
			this.commitScrollState();
			return;
		}
		if (autoscrolling) this.setAutoscrolling(true);
		viewport.scrollTo({ top: target, behavior });
		this.scheduleStateCommit();
	}

	/** Marks a programmatic scroll to the end as under way, for a short window (see `AUTOSCROLL_WINDOW_MS`). */
	private setAutoscrolling(value: boolean) {
		if (this.autoscrollTimer !== null) {
			window.clearTimeout(this.autoscrollTimer);
			this.autoscrollTimer = null;
		}
		if (this.autoscrolling !== value) {
			this.autoscrolling = value;
			this.commitScrollState();
		}
		if (value) {
			this.autoscrollTimer = window.setTimeout(() => {
				this.autoscrollTimer = null;
				this.autoscrolling = false;
				this.commitScrollState();
			}, AUTOSCROLL_WINDOW_MS);
		}
	}

	private setSpacerHeight(height: number) {
		const spacer = this.spacer;
		if (!spacer || this.spacerHeight === height) return;
		this.spacerHeight = height;
		spacer.hidden = height === 0;
		spacer.style.height = `${height}px`;
		// The spacer is a flex item after the last row, so cancel the row gap it would otherwise add above itself.
		spacer.style.marginTop = height > 0 ? `${-this.spacerGap}px` : "";
	}

	/** Measures the scroll position, updates the mode and publishes whether the Latest button should be active. */
	private commitScrollState() {
		const viewport = this.viewport;
		if (!viewport || !this.content) return;
		const scrollTop = viewport.scrollTop;
		const below = hasContentBelow({
			contentExtent: this.measureContentExtent(),
			scrollTop,
			clientHeight: viewport.clientHeight,
		});
		this.mode = nextScrollMode(this.mode, {
			autoScroll: this.autoScroll,
			atLiveEdge: !below,
			scrolledUp: isScrolledUp(scrollTop, this.lastScrollTop),
			autoscrolling: this.autoscrolling,
		});
		this.lastScrollTop = scrollTop;
		this.canScrollToEnd.set(below && this.mode !== "following");
	}

	private scheduleStateCommit() {
		if (this.stateFrame !== null) return;
		this.stateFrame = window.requestAnimationFrame(() => {
			this.stateFrame = null;
			this.commitScrollState();
		});
	}

	/** Height of the rows plus the content padding, in scroll coordinates; the spacer is not part of it. */
	private measureContentExtent(): number {
		const { content, viewport } = this;
		if (!content || !viewport) return 0;
		const padding = readBlockPadding(content);
		const viewportTop = viewport.getBoundingClientRect().top;
		return getContentExtent({
			rowBottoms: getRows(content, this.spacer).map(
				(row) => row.getBoundingClientRect().bottom - viewportTop + viewport.scrollTop,
			),
			paddingStart: padding.start,
			paddingEnd: padding.end,
		});
	}

	/** Distance from the top of the scrollable content to the top of `row`. */
	private measureOffsetTop(row: HTMLElement): number {
		const viewport = this.viewport;
		if (!viewport) return 0;
		return row.getBoundingClientRect().top - viewport.getBoundingClientRect().top + viewport.scrollTop;
	}
}
