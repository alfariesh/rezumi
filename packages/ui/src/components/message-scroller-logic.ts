/*
 * Scroll logic for the message scroller, adapted from shadcn/react's message scroller (MIT License,
 * Copyright (c) 2023 shadcn) and owned here. It keeps the part the assistant and career coach transcripts use: follow
 * a streaming reply only while the reader is at the live edge, settle a new turn near the top, reopen a saved thread
 * on its last turn. Everything here is a pure decision or a small calculation, so it is unit tested without a layout
 * engine; `message-scroller-controller.ts` measures the DOM and applies the results.
 */

/** How far (px) the reader can be from the bottom and still count as "at the live edge". */
export const LIVE_EDGE_THRESHOLD = 8;

/** How much (px) of the previous row stays visible above a turn that is scrolled to the top. */
export const PREVIOUS_ROW_PEEK = 64;

/** Sub-pixel tolerance when comparing scroll positions. */
export const SCROLL_EPSILON = 0.5;

/**
 * How long (ms) a programmatic scroll to the end counts as "autoscrolling". The scroll events it causes during that
 * window are not mistaken for the reader scrolling away.
 */
export const AUTOSCROLL_WINDOW_MS = 180;

/**
 * What the transcript does when content changes.
 * - `following`: stays on the latest content (only with `autoScroll`, and only while the reader is at the live edge).
 * - `free`: stays where the reader put it.
 * - `anchored`: a new turn was scrolled near the top; its reply fills in below it.
 */
export type ScrollMode = "following" | "free" | "anchored";

/** Keys that scroll a focused viewport, so pressing one means the reader took over. */
const SCROLL_KEYS = new Set(["ArrowDown", "ArrowUp", "End", "Home", "PageDown", "PageUp", " "]);

export function isScrollKey(key: string): boolean {
	return SCROLL_KEYS.has(key);
}

/** Parses a computed CSS length such as `"12px"`; anything that is not a finite number is 0. */
export function parsePx(value: string | null | undefined): number {
	if (!value) return 0;
	const parsed = Number.parseFloat(value);
	return Number.isFinite(parsed) ? parsed : 0;
}

/** A row marks the start of a turn when `MessageScrollerItem` was given `scrollAnchor`. */
function isScrollAnchor(row: HTMLElement): boolean {
	return row.dataset.scrollAnchor === "true";
}

/** The transcript's rows: the content's element children, without the spacer. */
export function getRows(content: HTMLElement, spacer: HTMLElement | null): HTMLElement[] {
	return Array.from(content.children).filter(
		(child): child is HTMLElement => child instanceof HTMLElement && child !== spacer,
	);
}

/** The first turn start at or after `from`. */
export function findAnchorFrom(rows: readonly HTMLElement[], from: number): HTMLElement | null {
	for (let index = from; index < rows.length; index++) {
		const row = rows[index];
		if (row && isScrollAnchor(row)) return row;
	}
	return null;
}

/** The last turn start in the transcript. */
export function findLastAnchor(rows: readonly HTMLElement[]): HTMLElement | null {
	for (let index = rows.length - 1; index >= 0; index--) {
		const row = rows[index];
		if (row && isScrollAnchor(row)) return row;
	}
	return null;
}

/** The first turn start that has not been scrolled to yet. */
export function findUnhandledAnchor(rows: readonly HTMLElement[], handled: WeakSet<HTMLElement>): HTMLElement | null {
	for (const row of rows) {
		if (isScrollAnchor(row) && !handled.has(row)) return row;
	}
	return null;
}

/** Whether more than one turn starts at or after `from`. */
export function hasSeveralAnchorsFrom(rows: readonly HTMLElement[], from: number): boolean {
	let count = 0;
	for (let index = from; index < rows.length; index++) {
		const row = rows[index];
		if (row && isScrollAnchor(row)) {
			count += 1;
			if (count > 1) return true;
		}
	}
	return false;
}

type ContentExtentInput = {
	/** Bottom of each row, in scroll coordinates (distance from the top of the scrollable content). */
	rowBottoms: readonly number[];
	paddingStart: number;
	paddingEnd: number;
};

/**
 * Height of the transcript without the spacer: the bottom of the lowest row plus the content's end padding (at least
 * the two paddings, for an empty transcript).
 */
export function getContentExtent({ rowBottoms, paddingStart, paddingEnd }: ContentExtentInput): number {
	let extent = paddingStart + paddingEnd;
	for (const bottom of rowBottoms) extent = Math.max(extent, bottom + paddingEnd);
	return extent;
}

type ScrollMetrics = {
	contentExtent: number;
	scrollTop: number;
	clientHeight: number;
};

/** Whether there is more transcript below the visible part, beyond the live-edge threshold. */
export function hasContentBelow({ contentExtent, scrollTop, clientHeight }: ScrollMetrics): boolean {
	return contentExtent - scrollTop - clientHeight > LIVE_EDGE_THRESHOLD;
}

/** Whether `scrollTop` is meaningfully above where it was last time (the reader scrolled up). */
export function isScrolledUp(scrollTop: number, previousScrollTop: number): boolean {
	return scrollTop < previousScrollTop - SCROLL_EPSILON;
}

type ModeInput = {
	autoScroll: boolean;
	/** At the bottom of the transcript (no content below beyond the threshold). */
	atLiveEdge: boolean;
	scrolledUp: boolean;
	/** A programmatic scroll to the end is under way. */
	autoscrolling: boolean;
};

/**
 * The mode after the scroll position was measured. Reaching the live edge resumes following (unless a turn is
 * anchored near the top); scrolling up away from it, by any means, stops following.
 */
export function nextScrollMode(
	mode: ScrollMode,
	{ autoScroll, atLiveEdge, scrolledUp, autoscrolling }: ModeInput,
): ScrollMode {
	if (autoScroll && atLiveEdge && mode !== "anchored") return "following";
	if (mode === "following" && !atLiveEdge && scrolledUp && !autoscrolling) return "free";
	return mode;
}

/** `scrollTop` that puts a turn's first row near the top of the viewport, leaving a peek of the row above it. */
export function getAnchorScrollTop({
	anchorOffsetTop,
	paddingStart,
}: {
	/** Distance from the top of the scrollable content to the row's top. */
	anchorOffsetTop: number;
	paddingStart: number;
}): number {
	return anchorOffsetTop - paddingStart - PREVIOUS_ROW_PEEK;
}

/**
 * Height of the empty space after the transcript that lets it scroll far enough to put a turn at `scrollTop` when the
 * content is still short. It shrinks to nothing as the reply fills the viewport.
 */
export function getSpacerHeight({ scrollTop, clientHeight, contentExtent }: ScrollMetrics): number {
	return Math.max(0, Math.ceil(scrollTop + clientHeight - contentExtent));
}

/**
 * Whether everything from a turn's start to the end of the transcript fits in the viewport. A saved thread opens at
 * its end then, since there is no reason to hide the start of the turn.
 */
export function turnFitsViewport({
	contentExtent,
	anchorOffsetTop,
	clientHeight,
}: {
	contentExtent: number;
	anchorOffsetTop: number;
	clientHeight: number;
}): boolean {
	return contentExtent - anchorOffsetTop <= clientHeight;
}

export type ContentChange =
	/** Scroll to the latest content. */
	| { type: "follow" }
	/** Scroll a turn's first row near the top. */
	| { type: "anchor"; row: HTMLElement }
	/** Leave the scroll position alone and re-measure. */
	| { type: "remeasure" };

type ContentChangeInput = {
	rows: readonly HTMLElement[];
	/** Row count before this change; greater than 0 (the first rows are handled as opening the thread). */
	previousCount: number;
	/** Turn starts that have already been scrolled to. */
	handledAnchors: WeakSet<HTMLElement>;
	autoScroll: boolean;
	mode: ScrollMode;
};

/** What to do when the transcript's rows changed and there were rows before. */
export function planContentChange({
	rows,
	previousCount,
	handledAnchors,
	autoScroll,
	mode,
}: ContentChangeInput): ContentChange {
	if (rows.length > previousCount) {
		const anchor = findAnchorFrom(rows, previousCount);
		if (anchor) {
			// Several turns arrived at once while following: land on the newest content, not on the first of them.
			if (autoScroll && mode === "following" && hasSeveralAnchorsFrom(rows, previousCount)) return { type: "follow" };
			return { type: "anchor", row: anchor };
		}
	}
	if (rows.length === previousCount) {
		// Same number of rows, but a turn start that was never scrolled to (a row was replaced).
		const anchor = findUnhandledAnchor(rows, handledAnchors);
		if (anchor) return { type: "anchor", row: anchor };
	}
	return mode === "following" && autoScroll ? { type: "follow" } : { type: "remeasure" };
}
