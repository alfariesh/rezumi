import type { PortfolioMetric } from "@rezumi/schema/portfolio/metric";

type NumberFormat = Pick<PortfolioMetric, "format" | "currency" | "unit">;

const formatters = new Map<string, Intl.NumberFormat>();

function numberFormat(locale: string, options: Intl.NumberFormatOptions): Intl.NumberFormat {
	const key = `${locale}|${JSON.stringify(options)}`;
	let formatter = formatters.get(key);
	if (!formatter) {
		try {
			formatter = new Intl.NumberFormat(locale, options);
		} catch {
			// An unknown locale or option (old runtimes lack some units): plain numbers still read.
			formatter = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });
		}
		if (formatters.size >= 200) formatters.clear();
		formatters.set(key, formatter);
	}
	return formatter;
}

/**
 * A number in a metric's format, in the page's language: "2,8%" and "Rp1,2 M" in Indonesian, "2.8%" and "1.2M" in
 * English. A currency or duration stored without its unit reads as a plain number.
 */
export function formatMetricNumber(value: number, metric: NumberFormat, locale: string): string {
	if (!Number.isFinite(value)) return "";
	switch (metric.format) {
		case "percent":
			return numberFormat(locale, { style: "percent", maximumFractionDigits: 2 }).format(value / 100);
		case "currency":
			if (!metric.currency) break;
			return numberFormat(locale, {
				style: "currency",
				currency: metric.currency,
				currencyDisplay: "narrowSymbol",
				// Millions read better short ("Rp1,2 M"); smaller amounts keep their digits. Rupiah has no cents in use.
				...(Math.abs(value) >= 1_000_000 ? { notation: "compact", maximumFractionDigits: 1 } : {}),
				...(metric.currency === "IDR" ? { maximumFractionDigits: Math.abs(value) >= 1_000_000 ? 1 : 0 } : {}),
			}).format(value);
		case "compact":
			return numberFormat(locale, { notation: "compact", maximumFractionDigits: 1 }).format(value);
		case "multiplier":
			return `${numberFormat(locale, { maximumFractionDigits: 2 }).format(value)}×`;
		case "duration":
			if (!metric.unit) break;
			return numberFormat(locale, {
				style: "unit",
				unit: metric.unit,
				unitDisplay: "short",
				maximumFractionDigits: 1,
			}).format(value);
		case "rating":
			return `${numberFormat(locale, { maximumFractionDigits: 1 }).format(value)}/5`;
		case "plain":
			break;
	}
	return numberFormat(locale, { maximumFractionDigits: 2 }).format(value);
}

/** A metric's value as it shows: formatted number or short text, with its prefix and suffix. */
export function formatMetric(metric: PortfolioMetric, locale: string): string {
	const core =
		metric.value.kind === "text" ? metric.value.text.trim() : formatMetricNumber(metric.value.number, metric, locale);
	return `${metric.prefix ?? ""}${core}${metric.suffix ?? ""}`;
}

/** The value before, in the same format, for before → after. */
export function formatMetricBefore(metric: PortfolioMetric, locale: string): string | null {
	if (metric.before === undefined || metric.value.kind !== "number") return null;
	return `${metric.prefix ?? ""}${formatMetricNumber(metric.before, metric, locale)}${metric.suffix ?? ""}`;
}

/**
 * Bar lengths for before → after, as percentages of the larger value (at least 4%, so a tiny value still shows a
 * mark). Null when the metric has no before value or its values aren't comparable numbers.
 */
export function beforeAfterBars(metric: PortfolioMetric): { before: number; after: number } | null {
	if (metric.before === undefined || metric.value.kind !== "number") return null;
	const before = Math.abs(metric.before);
	const after = Math.abs(metric.value.number);
	const largest = Math.max(before, after);
	if (largest === 0) return { before: 4, after: 4 };
	const share = (value: number) => Math.max(4, Math.round((value / largest) * 1000) / 10);
	return { before: share(before), after: share(after) };
}

export const SPARKLINE_WIDTH = 240;
export const SPARKLINE_HEIGHT = 44;

/**
 * A sparkline's shapes in a 240 × 44 box (`01-desain.md` section 16): the line, the area under it, and its last point.
 * Drawn on the server, so the page needs no chart code. Null for fewer than two points.
 */
export function sparklinePaths(
	series: readonly number[] | undefined,
): { line: string; area: string; end: string } | null {
	const values = (series ?? []).filter((value) => Number.isFinite(value));
	if (values.length < 2) return null;
	const min = Math.min(...values);
	const max = Math.max(...values);
	const span = max - min || 1;
	const pad = 4;
	const points = values.map((value, index) => {
		const x = (index / (values.length - 1)) * SPARKLINE_WIDTH;
		const y = max === min ? SPARKLINE_HEIGHT / 2 : pad + (1 - (value - min) / span) * (SPARKLINE_HEIGHT - 2 * pad);
		return `${x.toFixed(1)},${y.toFixed(1)}`;
	});
	const line = `M${points.join(" L")}`;
	const last = points.at(-1) as string;
	return {
		line,
		area: `${line} L${SPARKLINE_WIDTH},${SPARKLINE_HEIGHT} L0,${SPARKLINE_HEIGHT} Z`,
		// A zero-length segment with round caps stays a dot when the SVG stretches.
		end: `M${last} Z`,
	};
}

const DECIMAL_DIGIT = /\p{Nd}/u;

/**
 * The digit a character stands for in any script ("٣", "۳", "৩", "३" and "3" are all 3). Unicode puts every set of
 * decimal digits in a row of ten, 0 first, so its value is its distance from the start of its row.
 */
function digitValue(char: string): string {
	const code = char.codePointAt(0) ?? 0;
	let start = code;
	while (start > 0 && DECIMAL_DIGIT.test(String.fromCodePoint(start - 1))) start--;
	return String((code - start) % 10);
}

/**
 * Text with any script's digits as Western ones and the Arabic thousands separator (٬) dropped, without the invisible
 * direction marks right-to-left languages put around numbers. The Arabic decimal separator (٫) stays, because it says
 * which mark is the decimal point: readers of the number decide what to do with it.
 */
export function westernDigits(text: string): string {
	return text
		.replace(/[\u200e\u200f\u061c\u202a-\u202e\u2066-\u2069]/g, "")
		.replace(/\p{Nd}/gu, (char) => (char >= "0" && char <= "9" ? char : digitValue(char)))
		.replace(/\u066c/g, "");
}
