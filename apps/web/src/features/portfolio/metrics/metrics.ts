import type { PortfolioWork } from "@rezumi/schema/portfolio/data";
import type { MetricFormat, PortfolioMetric } from "@rezumi/schema/portfolio/metric";
import { PORTFOLIO_LIMITS } from "@rezumi/schema/portfolio/limits";
import { generateId } from "@rezumi/utils/string";

/** The editor's format choices: currency is two choices (rupiah, dollar), the rest map one to one. */
export const METRIC_FORMAT_CHOICES = [
	"plain",
	"percent",
	"idr",
	"usd",
	"compact",
	"multiplier",
	"duration",
	"rating",
] as const;
export type MetricFormatChoice = (typeof METRIC_FORMAT_CHOICES)[number];

export function newMetric(): PortfolioMetric {
	return { id: generateId(), label: "", value: { kind: "number", number: 0 }, format: "plain" };
}

export function metricFormatChoice(metric: Pick<PortfolioMetric, "format" | "currency">): MetricFormatChoice {
	if (metric.format === "currency") return metric.currency === "USD" ? "usd" : "idr";
	return metric.format;
}

/** Sets a format and the unit it needs (a currency, a duration unit), dropping units it doesn't. */
export function applyMetricFormat(metric: PortfolioMetric, choice: MetricFormatChoice): void {
	const format: MetricFormat = choice === "idr" || choice === "usd" ? "currency" : choice;
	metric.format = format;
	if (format === "currency") metric.currency = choice === "usd" ? "USD" : "IDR";
	else delete metric.currency;
	if (format === "duration") metric.unit ??= "month";
	else delete metric.unit;
}

/** Whether the language writes a decimal comma ("2,8"), as Indonesian does. */
export function usesDecimalComma(locale: string): boolean {
	try {
		return new Intl.NumberFormat(locale).format(1.5).includes(",");
	} catch {
		return false;
	}
}

/**
 * A number as people type it, in the app's language: "2,8" and "1.200.000" in Indonesian, "2.8" and "1,200,000" in
 * English. With both separators, the last one is the decimal point. Null when it isn't a number.
 */
export function parseMetricNumber(text: string, locale: string): number | null {
	let value = text
		.trim()
		.replace(/[\s  ]/g, "")
		.replace(/^\+/, "")
		.replace(/[−–]/g, "-");
	if (!value || !/^-?[\d.,]+$/.test(value)) return null;
	const comma = value.lastIndexOf(",");
	const dot = value.lastIndexOf(".");
	const decimalComma = usesDecimalComma(locale);
	if (comma !== -1 && dot !== -1) {
		const decimal = comma > dot ? "," : ".";
		value = value.replaceAll(decimal === "," ? "." : ",", "").replace(decimal, ".");
	} else if (comma !== -1) {
		// "1,200,000" groups thousands; one comma is a decimal unless the language groups with commas.
		const grouped = /^-?\d{1,3}(?:,\d{3})+$/.test(value);
		value =
			grouped && (!decimalComma || value.split(",").length > 2) ? value.replaceAll(",", "") : value.replace(",", ".");
	} else if (dot !== -1) {
		const grouped = /^-?\d{1,3}(?:\.\d{3})+$/.test(value);
		value = grouped && (decimalComma || value.split(".").length > 2) ? value.replaceAll(".", "") : value;
	}
	if ((value.match(/\./g) ?? []).length > 1) return null;
	const number = Number(value);
	return Number.isFinite(number) && Math.abs(number) <= 1e15 ? number : null;
}

/** A number for an input, as the app's language writes it, without grouping (so it reads back the same). */
export function metricNumberText(value: number | undefined, locale: string): string {
	if (value === undefined) return "";
	return new Intl.NumberFormat(locale, { useGrouping: false, maximumFractionDigits: 6 }).format(value);
}

/**
 * Sparkline values typed in a row: "12, 15, 21" (or one per line; semicolons too). In languages with a decimal comma,
 * only semicolons and spaces separate numbers. Null when any value isn't a number or there are too many.
 */
export function parseMetricSeries(text: string, locale: string): number[] | null {
	const decimalComma = usesDecimalComma(locale);
	const parts = text
		.split(decimalComma ? /[;\n]+|\s+/ : /[;,\n]+|\s+/)
		.map((part) => part.trim())
		.filter(Boolean);
	if (!parts.length) return [];
	const values = parts.map((part) => parseMetricNumber(part, locale));
	if (values.some((value) => value === null)) return null;
	if (values.length > PORTFOLIO_LIMITS.sparklinePoints.max) return null;
	return values as number[];
}

export function metricSeriesText(series: readonly number[] | undefined, locale: string): string {
	if (!series?.length) return "";
	const decimalComma = usesDecimalComma(locale);
	return series.map((value) => metricNumberText(value, locale)).join(decimalComma ? "; " : ", ");
}

/** Every metric in a work's Metrics blocks, in order: the ones its card can highlight. */
export function workMetrics(work: Pick<PortfolioWork, "blocks">): PortfolioMetric[] {
	return work.blocks.flatMap((block) => (block.type === "metrics" ? block.items : []));
}

/** Drops the card's highlighted metric when no Metrics block holds it any more, so the card shows no chip. */
export function dropMissingHighlight(work: PortfolioWork): void {
	if (work.highlightMetricId && !workMetrics(work).some((metric) => metric.id === work.highlightMetricId))
		delete work.highlightMetricId;
}

/** Whether a metric has what the page needs to show it: a label and a value. */
export function isMetricComplete(metric: PortfolioMetric): boolean {
	return metric.label.trim() !== "" && (metric.value.kind === "number" || metric.value.text.trim() !== "");
}
