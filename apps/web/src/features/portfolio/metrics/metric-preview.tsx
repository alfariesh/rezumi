import type { PortfolioMetric } from "@rezumi/schema/portfolio/metric";
import { TrendChip } from "@heroui-pro/react";
import { KPI } from "@heroui-pro/react/kpi";
import { t } from "@lingui/core/macro";
import { formatMetric, formatMetricBefore } from "@rezumi/portfolio/metric";
import { Icon } from "@rezumi/ui/components/icon";

type MetricPreviewProps = { metric: PortfolioMetric; locale: string };

/**
 * A small KPI card of one metric in the page's language, so the number reads right while it's typed. The page draws
 * its own widget (the preview on the right is the reference); this one only checks the value, format and change.
 */
export default function MetricPreview({ metric, locale }: MetricPreviewProps) {
	const value = formatMetric(metric, locale);
	const before = formatMetricBefore(metric, locale);
	const change = metric.change;
	return (
		<KPI className="bg-surface-secondary">
			<KPI.Header>
				<KPI.Title>{metric.label.trim() || t`Label`}</KPI.Title>
			</KPI.Header>
			<KPI.Content>
				<div className="flex flex-wrap items-center gap-2">
					<dd className="text-2xl font-semibold tabular-nums" dir="auto">
						{value || "—"}
					</dd>
					{change && change.text.trim() && (
						// The chip's colour says good or bad; its arrow says which way it went.
						<TrendChip trend={change.direction === "neutral" ? "neutral" : change.good ? "up" : "down"}>
							<TrendChip.Indicator>
								<Icon
									name={
										change.direction === "up" ? "arrow-up" : change.direction === "down" ? "arrow-down" : "arrow-right"
									}
									size={12}
								/>
							</TrendChip.Indicator>
							{change.text}
						</TrendChip>
					)}
				</div>
				{(before || metric.context) && (
					<p className="text-xs text-muted" dir="auto">
						{[before ? t`Before: ${before}` : "", metric.context?.trim() ?? ""].filter(Boolean).join(" · ")}
					</p>
				)}
			</KPI.Content>
		</KPI>
	);
}
