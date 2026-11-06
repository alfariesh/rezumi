import type { SchemaKit } from "./kit";
import z from "zod";
import { icons } from "../icons";
import { itemIdSchema } from "./kit";
import { PORTFOLIO_LIMITS } from "./limits";

const { text: max } = PORTFOLIO_LIMITS;

export const METRIC_FORMATS = ["plain", "percent", "currency", "compact", "multiplier", "duration", "rating"] as const;
export type MetricFormat = (typeof METRIC_FORMATS)[number];
export const METRIC_CURRENCIES = ["IDR", "USD"] as const;
export const METRIC_DURATION_UNITS = ["hour", "day", "week", "month"] as const;
export const METRIC_DIRECTIONS = ["up", "down", "neutral"] as const;

const ICON_NAMES = new Set<string>(icons);
/** An icon from the resume icon set (Hugeicons names). */
export const portfolioIconSchema = z
	.string()
	.refine((name) => ICON_NAMES.has(name), "Use an icon from the resume icon set.")
	.describe("A Hugeicons name from the resume icon set, such as 'chart-increase'.");

/** Finite numbers a page can format; far beyond any real result. */
const metricNumber = z.number().finite().min(-1e15).max(1e15);

/**
 * A result shown as a metric widget (`02-teknis.md` section 17): a work's Metrics block, the metric a work card
 * highlights, and the intro's achievement numbers.
 */
export function createMetricSchema(kit: SchemaKit) {
	const metric = z.object({
		id: itemIdSchema,
		label: kit.field(kit.text(max.metricLabel), "").describe("What was measured, such as 'Checkout conversion'."),
		value: kit
			.field(
				z.discriminatedUnion("kind", [
					z.object({ kind: z.literal("number"), number: metricNumber }),
					z.object({ kind: z.literal("text"), text: kit.text(max.metricText) }),
				]),
				{ kind: "number", number: 0 },
			)
			.describe("The value: a number to format, or short text such as 'Top 3' or '#1'."),
		format: kit.field(z.enum(METRIC_FORMATS), "plain").describe("How a number value is formatted."),
		currency: kit.optional(z.enum(METRIC_CURRENCIES)).describe("The currency, for the currency format."),
		unit: kit.optional(z.enum(METRIC_DURATION_UNITS)).describe("The unit, for the duration format."),
		prefix: kit.optional(kit.text(max.metricPrefix)).describe("Text before the value, such as '+'."),
		suffix: kit.optional(kit.text(max.metricSuffix)).describe("Text after the value, such as '/month'."),
		change: kit
			.optional(
				z.object({
					direction: z.enum(METRIC_DIRECTIONS),
					text: kit.text(max.metricChange),
					good: z.boolean().describe("Whether the change is good news; a fall can be (faster load times)."),
				}),
			)
			.describe("A change chip: arrow, text such as '+35%', and whether it's good."),
		before: kit.optional(metricNumber).describe("The value before, drawn as a bar against the value after."),
		series: kit
			.optional(
				z.array(metricNumber).min(PORTFOLIO_LIMITS.sparklinePoints.min).max(PORTFOLIO_LIMITS.sparklinePoints.max),
			)
			.describe("Values in order for a sparkline, 3 to 12."),
		progress: kit.optional(z.number().finite().min(0).max(100)).describe("Progress from 0 to 100."),
		context: kit.optional(kit.text(max.metricContext)).describe("Where the number comes from or when it was measured."),
		icon: kit.optional(portfolioIconSchema),
	});

	// A currency or duration without its unit renders as a plain number; the editor sets both together.
	return metric;
}

export type PortfolioMetric = z.output<ReturnType<typeof createMetricSchema>>;
