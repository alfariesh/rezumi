import type { PortfolioWork } from "@rezumi/schema/portfolio/data";
import type { PortfolioMetric } from "@rezumi/schema/portfolio/metric";
import { describe, expect, it } from "vite-plus/test";
import { produce } from "immer";
import {
	applyMetricFormat,
	dropMissingHighlight,
	isMetricComplete,
	metricFormatChoice,
	metricSeriesText,
	newMetric,
	parseMetricNumber,
	parseMetricSeries,
	workMetrics,
} from "./metrics";

const metric = (patch: Partial<PortfolioMetric> = {}): PortfolioMetric => ({ ...newMetric(), ...patch });

describe("parseMetricNumber", () => {
	it("reads Indonesian numbers: decimal comma, dot groups", () => {
		expect(parseMetricNumber("2,8", "id-ID")).toBe(2.8);
		expect(parseMetricNumber("1.200.000", "id-ID")).toBe(1_200_000);
		expect(parseMetricNumber("1.500", "id-ID")).toBe(1500);
		expect(parseMetricNumber("1.200,5", "id-ID")).toBe(1200.5);
		expect(parseMetricNumber("1,500", "id-ID")).toBe(1.5);
	});

	it("reads English numbers: decimal point, comma groups", () => {
		expect(parseMetricNumber("2.8", "en-US")).toBe(2.8);
		expect(parseMetricNumber("1,200,000", "en-US")).toBe(1_200_000);
		expect(parseMetricNumber("1.500", "en-US")).toBe(1.5);
		expect(parseMetricNumber("1,200.5", "en-US")).toBe(1200.5);
	});

	it("takes signs and spaces, and refuses what isn't a number", () => {
		expect(parseMetricNumber(" +35 ", "en-US")).toBe(35);
		expect(parseMetricNumber("−40", "en-US")).toBe(-40);
		expect(parseMetricNumber("1 200", "id-ID")).toBe(1200);
		expect(parseMetricNumber("", "en-US")).toBeNull();
		expect(parseMetricNumber("35%", "en-US")).toBeNull();
		expect(parseMetricNumber("1.2.3,4.5", "en-US")).toBeNull();
		expect(parseMetricNumber("9".repeat(20), "en-US")).toBeNull();
	});
});

describe("sparkline series", () => {
	it("splits by commas in English and by semicolons or spaces in Indonesian", () => {
		expect(parseMetricSeries("12, 15, 21.5", "en-US")).toEqual([12, 15, 21.5]);
		expect(parseMetricSeries("12; 15; 21,5", "id-ID")).toEqual([12, 15, 21.5]);
		expect(parseMetricSeries("12 15 21", "id-ID")).toEqual([12, 15, 21]);
		expect(parseMetricSeries("", "en-US")).toEqual([]);
	});

	it("refuses words and more than twelve values", () => {
		expect(parseMetricSeries("12, many", "en-US")).toBeNull();
		expect(parseMetricSeries(Array.from({ length: 13 }, (_, index) => index).join(", "), "en-US")).toBeNull();
	});

	it("writes values back the way they read", () => {
		expect(metricSeriesText([12, 21.5], "id-ID")).toBe("12; 21,5");
		expect(metricSeriesText([12, 21.5], "en-US")).toBe("12, 21.5");
		expect(parseMetricSeries(metricSeriesText([1200, 0.5, 3], "id-ID"), "id-ID")).toEqual([1200, 0.5, 3]);
	});
});

describe("formats", () => {
	it("sets the unit a format needs and drops the rest", () => {
		const usd = produce(metric(), (draft) => applyMetricFormat(draft as PortfolioMetric, "usd"));
		expect(usd).toMatchObject({ format: "currency", currency: "USD" });
		expect(metricFormatChoice(usd)).toBe("usd");
		const duration = produce(usd, (draft) => applyMetricFormat(draft as PortfolioMetric, "duration"));
		expect(duration).toMatchObject({ format: "duration", unit: "month" });
		expect(duration.currency).toBeUndefined();
		const plain = produce(duration, (draft) => applyMetricFormat(draft as PortfolioMetric, "plain"));
		expect(plain.unit).toBeUndefined();
		expect(metricFormatChoice(metric({ format: "currency", currency: "IDR" }))).toBe("idr");
	});

	it("knows a metric is ready once it has a label and a value", () => {
		expect(isMetricComplete(metric())).toBe(false);
		expect(isMetricComplete(metric({ label: "Conversion" }))).toBe(true);
		expect(isMetricComplete(metric({ label: "Rank", value: { kind: "text", text: " " } }))).toBe(false);
	});
});

describe("highlighted metric", () => {
	const work = (highlightMetricId?: string): PortfolioWork => ({
		id: "w",
		slug: "w",
		title: "W",
		summary: "",
		role: "",
		date: "",
		tags: [],
		blocks: [
			{ id: "b1", type: "text", html: "" },
			{ id: "b2", type: "metrics", items: [metric({ id: "m1", label: "A" }), metric({ id: "m2", label: "B" })] },
		],
		featured: false,
		hidden: false,
		...(highlightMetricId ? { highlightMetricId } : {}),
	});

	it("lists the metrics a card can show", () => {
		expect(workMetrics(work()).map((entry) => entry.id)).toEqual(["m1", "m2"]);
	});

	it("is dropped when its metric is gone, and kept otherwise", () => {
		expect(produce(work("m2"), (draft) => dropMissingHighlight(draft as PortfolioWork)).highlightMetricId).toBe("m2");
		const removed = produce(work("m2"), (draft) => {
			draft.blocks = draft.blocks.filter((block) => block.type !== "metrics");
			dropMissingHighlight(draft as PortfolioWork);
		});
		expect(removed.highlightMetricId).toBeUndefined();
	});
});
