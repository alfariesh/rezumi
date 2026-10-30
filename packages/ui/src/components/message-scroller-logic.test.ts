import { describe, expect, it } from "vite-plus/test";
import {
	LIVE_EDGE_THRESHOLD,
	PREVIOUS_ROW_PEEK,
	findAnchorFrom,
	findLastAnchor,
	findUnhandledAnchor,
	getAnchorScrollTop,
	getContentExtent,
	getRows,
	getSpacerHeight,
	hasContentBelow,
	hasSeveralAnchorsFrom,
	isScrollKey,
	isScrolledUp,
	nextScrollMode,
	parsePx,
	planContentChange,
	turnFitsViewport,
} from "./message-scroller-logic";

function at<T>(items: readonly T[], index: number): T {
	const item = items[index];
	if (item === undefined) throw new Error(`No item at ${index}`);
	return item;
}

/** Rows from a short script: `u` starts a turn (scroll anchor), anything else is a plain row. */
function makeRows(script: string): HTMLElement[] {
	return script.split(" ").map((kind) => {
		const row = document.createElement("div");
		row.dataset.scrollAnchor = kind === "u" ? "true" : "false";
		return row;
	});
}

describe("getContentExtent", () => {
	it("is the two paddings for an empty transcript", () => {
		expect(getContentExtent({ rowBottoms: [], paddingStart: 12, paddingEnd: 16 })).toBe(28);
	});

	it("reaches the lowest row's bottom plus the end padding", () => {
		expect(getContentExtent({ rowBottoms: [60, 400, 250], paddingStart: 12, paddingEnd: 12 })).toBe(412);
	});
});

describe("hasContentBelow", () => {
	const metrics = { contentExtent: 1000, clientHeight: 600 };

	it("is false at the bottom and within the live-edge threshold of it", () => {
		expect(hasContentBelow({ ...metrics, scrollTop: 400 })).toBe(false);
		expect(hasContentBelow({ ...metrics, scrollTop: 400 - LIVE_EDGE_THRESHOLD })).toBe(false);
	});

	it("is true once the reader is further than the threshold from the bottom", () => {
		expect(hasContentBelow({ ...metrics, scrollTop: 400 - LIVE_EDGE_THRESHOLD - 1 })).toBe(true);
		expect(hasContentBelow({ ...metrics, scrollTop: 0 })).toBe(true);
	});

	it("is false when the transcript is shorter than the viewport", () => {
		expect(hasContentBelow({ contentExtent: 200, clientHeight: 600, scrollTop: 0 })).toBe(false);
	});
});

describe("isScrolledUp", () => {
	it("ignores sub-pixel movement and moving down", () => {
		expect(isScrolledUp(99.7, 100)).toBe(false);
		expect(isScrolledUp(140, 100)).toBe(false);
	});

	it("detects moving up", () => {
		expect(isScrolledUp(90, 100)).toBe(true);
	});
});

describe("nextScrollMode", () => {
	const atEdge = { autoScroll: true, atLiveEdge: true, scrolledUp: false, autoscrolling: false };
	const awayFromEdge = { ...atEdge, atLiveEdge: false };

	it("starts following when the reader reaches the live edge", () => {
		expect(nextScrollMode("free", atEdge)).toBe("following");
		expect(nextScrollMode("following", atEdge)).toBe("following");
	});

	it("never follows without autoScroll", () => {
		expect(nextScrollMode("free", { ...atEdge, autoScroll: false })).toBe("free");
	});

	it("keeps a turn anchored near the top even when the short reply reaches the live edge", () => {
		expect(nextScrollMode("anchored", atEdge)).toBe("anchored");
		expect(nextScrollMode("anchored", awayFromEdge)).toBe("anchored");
	});

	it("stops following when the reader scrolls up away from the live edge", () => {
		expect(nextScrollMode("following", { ...awayFromEdge, scrolledUp: true })).toBe("free");
	});

	it("keeps following through growth below the viewport and through its own scroll to the end", () => {
		expect(nextScrollMode("following", awayFromEdge)).toBe("following");
		expect(nextScrollMode("following", { ...awayFromEdge, scrolledUp: true, autoscrolling: true })).toBe("following");
	});

	it("stays free while the reader is away from the live edge", () => {
		expect(nextScrollMode("free", awayFromEdge)).toBe("free");
	});
});

describe("getAnchorScrollTop", () => {
	it("puts the row below the content padding with a peek of the row above", () => {
		expect(getAnchorScrollTop({ anchorOffsetTop: 1104, paddingStart: 12 })).toBe(1104 - 12 - PREVIOUS_ROW_PEEK);
	});
});

describe("getSpacerHeight", () => {
	it("fills what a short reply lacks to let the turn reach the target", () => {
		expect(getSpacerHeight({ scrollTop: 900, clientHeight: 600, contentExtent: 1084 })).toBe(416);
	});

	it("shrinks as the reply grows and is never negative", () => {
		const spacer = (contentExtent: number) => getSpacerHeight({ scrollTop: 900, clientHeight: 600, contentExtent });
		expect(spacer(1200)).toBeLessThan(spacer(1100));
		expect(spacer(1500)).toBe(0);
		expect(spacer(5000)).toBe(0);
	});

	it("rounds up to whole pixels", () => {
		expect(getSpacerHeight({ scrollTop: 10.2, clientHeight: 100, contentExtent: 50 })).toBe(61);
	});
});

describe("turnFitsViewport", () => {
	it("is true when everything from the turn start to the end fits", () => {
		expect(turnFitsViewport({ contentExtent: 1000, anchorOffsetTop: 500, clientHeight: 600 })).toBe(true);
		expect(turnFitsViewport({ contentExtent: 1000, anchorOffsetTop: 400, clientHeight: 600 })).toBe(true);
	});

	it("is false when the turn is taller than the viewport", () => {
		expect(turnFitsViewport({ contentExtent: 1000, anchorOffsetTop: 399, clientHeight: 600 })).toBe(false);
	});
});

describe("anchor lookup", () => {
	it("finds the first turn start at or after an index", () => {
		const rows = makeRows("u a u a a u");
		expect(findAnchorFrom(rows, 0)).toBe(rows[0]);
		expect(findAnchorFrom(rows, 1)).toBe(rows[2]);
		expect(findAnchorFrom(rows, 3)).toBe(rows[5]);
		expect(findAnchorFrom(rows, 6)).toBeNull();
	});

	it("finds the last turn start", () => {
		const rows = makeRows("u a u a a");
		expect(findLastAnchor(rows)).toBe(rows[2]);
		expect(findLastAnchor(makeRows("a a"))).toBeNull();
		expect(findLastAnchor([])).toBeNull();
	});

	it("finds the first turn start that was not handled yet", () => {
		const rows = makeRows("u a u a");
		const handled = new WeakSet<HTMLElement>();
		expect(findUnhandledAnchor(rows, handled)).toBe(rows[0]);
		handled.add(at(rows, 0));
		expect(findUnhandledAnchor(rows, handled)).toBe(rows[2]);
		handled.add(at(rows, 2));
		expect(findUnhandledAnchor(rows, handled)).toBeNull();
	});

	it("tells one new turn from several", () => {
		const rows = makeRows("u a u a u a");
		expect(hasSeveralAnchorsFrom(rows, 0)).toBe(true);
		expect(hasSeveralAnchorsFrom(rows, 3)).toBe(false);
		expect(hasSeveralAnchorsFrom(rows, 6)).toBe(false);
	});
});

describe("getRows", () => {
	it("lists the element children without the spacer", () => {
		const content = document.createElement("div");
		const first = document.createElement("div");
		const second = document.createElement("div");
		const spacer = document.createElement("div");
		content.append(first, "stray text", second, spacer);
		expect(getRows(content, spacer)).toEqual([first, second]);
	});
});

describe("planContentChange", () => {
	const input = (
		script: string,
		previousCount: number,
		over: Partial<Parameters<typeof planContentChange>[0]> = {},
	) => {
		const rows = makeRows(script);
		return {
			rows,
			plan: planContentChange({
				rows,
				previousCount,
				handledAnchors: new WeakSet(),
				autoScroll: true,
				mode: "following",
				...over,
			}),
		};
	};

	it("settles a new turn near the top, whatever the mode", () => {
		for (const mode of ["following", "free", "anchored"] as const) {
			const { rows, plan } = input("u a u w", 2, { mode });
			expect(plan).toEqual({ type: "anchor", row: rows[2] });
		}
	});

	it("follows a reply that arrives while following, and leaves the position alone otherwise", () => {
		expect(input("u a", 1, { mode: "following" }).plan).toEqual({ type: "follow" });
		expect(input("u a", 1, { mode: "free" }).plan).toEqual({ type: "remeasure" });
		expect(input("u a", 1, { mode: "anchored" }).plan).toEqual({ type: "remeasure" });
		expect(input("u a", 1, { mode: "following", autoScroll: false }).plan).toEqual({ type: "remeasure" });
	});

	it("lands on the newest content when several turns arrive while following", () => {
		expect(input("u a u a u a", 2, { mode: "following" }).plan).toEqual({ type: "follow" });
	});

	it("settles on the first of several turns when the reader is not following", () => {
		const { rows, plan } = input("u a u a u a", 2, { mode: "free" });
		expect(plan).toEqual({ type: "anchor", row: rows[2] });
	});

	it("settles on a turn start that was never scrolled to when a row was replaced", () => {
		const { rows, plan } = input("u a", 2, { mode: "free" });
		expect(plan).toEqual({ type: "anchor", row: rows[0] });
	});

	it("ignores turn starts that were already scrolled to", () => {
		const rows = makeRows("u a u a");
		const handledAnchors = new WeakSet<HTMLElement>([at(rows, 0), at(rows, 2)]);
		expect(planContentChange({ rows, previousCount: 4, handledAnchors, autoScroll: true, mode: "free" })).toEqual({
			type: "remeasure",
		});
	});

	it("does not scroll to a turn when rows were removed", () => {
		expect(input("u", 2, { mode: "free" }).plan).toEqual({ type: "remeasure" });
		expect(input("u", 2, { mode: "anchored" }).plan).toEqual({ type: "remeasure" });
	});
});

describe("isScrollKey", () => {
	it("recognises the keys that scroll a focused region", () => {
		for (const key of ["ArrowDown", "ArrowUp", "PageUp", "PageDown", "Home", "End", " "]) {
			expect(isScrollKey(key)).toBe(true);
		}
		for (const key of ["a", "Enter", "Tab", "ArrowLeft"]) expect(isScrollKey(key)).toBe(false);
	});
});

describe("parsePx", () => {
	it("reads computed lengths and treats anything else as 0", () => {
		expect(parsePx("12px")).toBe(12);
		expect(parsePx("0.5px")).toBe(0.5);
		expect(parsePx("")).toBe(0);
		expect(parsePx("normal")).toBe(0);
		expect(parsePx(undefined)).toBe(0);
	});
});
