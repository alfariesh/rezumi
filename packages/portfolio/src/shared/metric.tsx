import type { PortfolioMetric } from "@rezumi/schema/portfolio/metric";
import type { PortfolioMetricVariant } from "@rezumi/schema/portfolio/themes";
import type { CSSProperties } from "react";
import {
	beforeAfterBars,
	formatMetric,
	formatMetricBefore,
	formatMetricNumber,
	SPARKLINE_HEIGHT,
	SPARKLINE_WIDTH,
	sparklinePaths,
} from "../metric";
import { useRender } from "./context";
import { ResumeIcon, UiIcon } from "./icons";

type TrendProps = { change: NonNullable<PortfolioMetric["change"]> };

/** The change chip: arrow, text and colour, with the meaning spelled out for screen readers. */
function Trend({ change }: TrendProps) {
	const { messages } = useRender();
	const spoken =
		change.direction === "neutral"
			? messages.unchanged
			: change.direction === "up"
				? change.good
					? messages.upGood
					: messages.upBad
				: change.good
					? messages.downGood
					: messages.downBad;
	return (
		<span className="pf-trend" data-good={change.direction === "neutral" ? undefined : String(change.good)}>
			<UiIcon
				name={change.direction === "up" ? "trend-up" : change.direction === "down" ? "trend-down" : "trend-flat"}
				className=""
			/>
			<span className="sr-only">{spoken} </span>
			{change.text}
		</span>
	);
}

/** A sparkline's numbers as text, in the metric's format: what the drawing shows, for screen readers. */
function seriesText(metric: PortfolioMetric, series: readonly number[], locale: string): string {
	const values = series.map(
		(value) => `${metric.prefix ?? ""}${formatMetricNumber(value, metric, locale)}${metric.suffix ?? ""}`,
	);
	try {
		return new Intl.ListFormat(locale, { type: "unit", style: "narrow" }).format(values);
	} catch {
		return values.join(" ");
	}
}

type SparklineProps = { metric: PortfolioMetric; series: readonly number[] };

function Sparkline({ metric, series }: SparklineProps) {
	const { nextId, locale } = useRender();
	const paths = sparklinePaths(series);
	if (!paths) return null;
	const id = nextId("pf-spark");
	return (
		<dd className="pf-metric__chart">
			<span className="sr-only">{seriesText(metric, series, locale)}</span>
			<svg
				viewBox={`0 0 ${SPARKLINE_WIDTH} ${SPARKLINE_HEIGHT}`}
				preserveAspectRatio="none"
				aria-hidden="true"
				focusable="false"
			>
				<defs>
					<linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
						<stop offset="0" stopColor="currentColor" stopOpacity="0.22" />
						<stop offset="1" stopColor="currentColor" stopOpacity="0" />
					</linearGradient>
				</defs>
				<path className="pf-spark-area" d={paths.area} fill={`url(#${id})`} />
				<path className="pf-spark-line" d={paths.line} vectorEffect="non-scaling-stroke" />
				<path className="pf-spark-end" d={paths.end} vectorEffect="non-scaling-stroke" />
			</svg>
		</dd>
	);
}

type MetricProps = { metric: PortfolioMetric; compact?: boolean };

/**
 * One metric in KPI anatomy (`01-desain.md` section 16): label, value and change chip, before → after bars, progress,
 * sparkline and context. Every number is text in the HTML; the drawings are extra. `compact` keeps value and label.
 */
function Metric({ metric, compact }: MetricProps) {
	const { locale, messages } = useRender();
	const value = formatMetric(metric, locale);
	if (!value && !metric.label.trim()) return null;
	const before = compact ? null : formatMetricBefore(metric, locale);
	const bars = compact ? null : beforeAfterBars(metric);
	const width = (share: number) => ({ "--w": `${share}%` }) as CSSProperties;
	return (
		<div className="pf-metric">
			<dt className="pf-metric__label">
				{!compact && <ResumeIcon name={metric.icon} />}
				{metric.label}
			</dt>
			<dd className="pf-metric__row">
				<span className="pf-metric__value">{value}</span>
				{!compact && metric.change?.text.trim() && <Trend change={metric.change} />}
			</dd>
			{bars && before && (
				<dd className="pf-metric__ba">
					<span className="pf-metric__bar">
						<i style={width(bars.before)} />
						<span>
							{messages.before} {before}
						</span>
					</span>
					<span className="pf-metric__bar pf-metric__bar--after">
						<i style={width(bars.after)} />
						<span>
							{messages.after} {value}
						</span>
					</span>
				</dd>
			)}
			{!compact && metric.progress !== undefined && (
				// A `dd` takes no role: the bar is drawn, its value read from text beside it.
				<dd className="pf-metric__progress">
					<i style={width(Math.max(0, Math.min(100, metric.progress)))} />
					<span className="sr-only">{`${messages.progress}: ${Math.round(metric.progress)}%`}</span>
				</dd>
			)}
			{!compact && metric.series && <Sparkline metric={metric} series={metric.series} />}
			{!compact && metric.context?.trim() && <dd className="pf-metric__context">{metric.context}</dd>}
		</div>
	);
}

type MetricGroupProps = {
	metrics: readonly PortfolioMetric[];
	variant: PortfolioMetricVariant;
	className?: string;
	compact?: boolean;
};

/** A group of metrics as one definition list, drawn in the page's metric variant. */
export function MetricGroup({ metrics, variant, className, compact }: MetricGroupProps) {
	const { locale } = useRender();
	const shown = metrics.filter((metric) => formatMetric(metric, locale) || metric.label.trim());
	if (!shown.length) return null;
	return (
		<dl className={["pf-metrics", className].filter(Boolean).join(" ")} data-variant={variant}>
			{shown.map((metric) => (
				<Metric key={metric.id} metric={metric} {...(compact ? { compact } : {})} />
			))}
		</dl>
	);
}

type WorkMetricProps = { metric: PortfolioMetric };

/** A work card's highlighted metric: value and label in a soft pill. */
export function WorkMetric({ metric }: WorkMetricProps) {
	const { locale } = useRender();
	const value = formatMetric(metric, locale);
	if (!value) return null;
	return (
		<span className="pf-work-metric">
			<b>{value}</b>
			{metric.label.trim() && <span>{metric.label}</span>}
		</span>
	);
}
