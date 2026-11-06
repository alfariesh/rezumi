import type { PortfolioMetric } from "@rezumi/schema/portfolio/metric";
import { describe, expect, it } from "vite-plus/test";
import { beforeAfterBars, formatMetric, formatMetricBefore, sparklinePaths } from "./metric";

const metric = (overrides: Partial<PortfolioMetric>): PortfolioMetric => ({
	id: "m",
	label: "",
	value: { kind: "number", number: 0 },
	format: "plain",
	...overrides,
});

// Intl separates numbers and units with no-break spaces; compare with ordinary ones.
const plain = (text: string) => text.replace(/[  ]/g, " ");
const format = (value: Partial<PortfolioMetric>, locale: string) => plain(formatMetric(metric(value), locale));
const number = (n: number) => ({ kind: "number" as const, number: n });

describe("formatMetric", () => {
	it("formats each kind of number in Indonesian", () => {
		expect(format({ value: number(2.8), format: "percent" }, "id-ID")).toBe("2,8%");
		expect(format({ value: number(1_200_000), format: "compact" }, "id-ID")).toBe("1,2 jt");
		expect(format({ value: number(12_000), format: "compact" }, "id-ID")).toBe("12 rb");
		expect(format({ value: number(1_500_000), format: "currency", currency: "IDR" }, "id-ID")).toBe("Rp 1,5 jt");
		expect(format({ value: number(250_000), format: "currency", currency: "IDR" }, "id-ID")).toBe("Rp 250.000");
		expect(format({ value: number(3), format: "multiplier" }, "id-ID")).toBe("3×");
		expect(format({ value: number(4.8), format: "rating" }, "id-ID")).toBe("4,8/5");
		expect(format({ value: number(2), format: "duration", unit: "week" }, "id-ID")).toMatch(/^2 mgg/);
		expect(format({ value: number(1234.5) }, "id-ID")).toBe("1.234,5");
	});

	it("formats each kind of number in English", () => {
		expect(format({ value: number(2.8), format: "percent" }, "en-US")).toBe("2.8%");
		expect(format({ value: number(1_200_000), format: "compact" }, "en-US")).toBe("1.2M");
		expect(format({ value: number(1_500_000), format: "currency", currency: "USD" }, "en-US")).toBe("$1.5M");
		expect(format({ value: number(990), format: "currency", currency: "USD" }, "en-US")).toBe("$990.00");
		expect(format({ value: number(36), format: "duration", unit: "hour" }, "en-US")).toBe("36 hr");
	});

	it("formats in Arabic with its own digits", () => {
		const text = format({ value: number(2.8), format: "percent" }, "ar-SA");
		expect(text).not.toMatch(/NaN|undefined/);
		expect(text.length).toBeGreaterThan(0);
	});

	it("keeps text values and adds prefix and suffix", () => {
		expect(format({ value: { kind: "text", text: "Top 3" } }, "id-ID")).toBe("Top 3");
		expect(format({ value: number(35), format: "percent", prefix: "+" }, "en-US")).toBe("+35%");
		expect(format({ value: number(40), suffix: "+" }, "en-US")).toBe("40+");
	});

	it("reads a currency or duration without its unit as a plain number", () => {
		expect(format({ value: number(1500), format: "currency" }, "en-US")).toBe("1,500");
		expect(format({ value: number(3), format: "duration" }, "en-US")).toBe("3");
	});
});

describe("before → after", () => {
	it("formats the value before like the value after", () => {
		expect(
			plain(formatMetricBefore(metric({ value: number(2.8), before: 2.1, format: "percent" }), "id-ID") ?? ""),
		).toBe("2,1%");
		expect(formatMetricBefore(metric({ value: { kind: "text", text: "#1" }, before: 3 }), "en-US")).toBeNull();
	});

	it("sizes the bars against the larger value, at least 4%", () => {
		expect(beforeAfterBars(metric({ value: number(97.5), before: 91 }))).toEqual({ before: 93.3, after: 100 });
		expect(beforeAfterBars(metric({ value: number(38), before: 66 }))).toEqual({ before: 100, after: 57.6 });
		expect(beforeAfterBars(metric({ value: number(1000), before: 1 }))).toEqual({ before: 4, after: 100 });
		expect(beforeAfterBars(metric({ value: number(5) }))).toBeNull();
	});
});

describe("sparklinePaths", () => {
	it("draws a line, an area and its last point inside the box", () => {
		const paths = sparklinePaths([1, 3, 2, 5]);
		expect(paths?.line).toBe("M0.0,40.0 L80.0,22.0 L160.0,31.0 L240.0,4.0");
		expect(paths?.area.endsWith("L240,44 L0,44 Z")).toBe(true);
		expect(paths?.end).toBe("M240.0,4.0 Z");
	});

	it("draws a flat series in the middle and skips too few points", () => {
		expect(sparklinePaths([2, 2, 2])?.line).toBe("M0.0,22.0 L120.0,22.0 L240.0,22.0");
		expect(sparklinePaths([1])).toBeNull();
		expect(sparklinePaths(undefined)).toBeNull();
	});
});
