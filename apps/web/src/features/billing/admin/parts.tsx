import type { ReactNode } from "react";
import { TrendChip, Widget } from "@heroui-pro/react";
import { AreaChart } from "@heroui-pro/react/area-chart";
import { Button, Tooltip } from "@heroui/react";
import { t } from "@lingui/core/macro";
import { useId } from "react";
import { cn } from "@rezumi/utils/style";

type AdminCardProps = {
	title: ReactNode;
	description?: ReactNode;
	/** Sits at the end of the header: a legend, a filter, an action. */
	action?: ReactNode;
	children: ReactNode;
	className?: string;
	/** No card around it: a table brings its own frame, as in the dashboard template. */
	plain?: boolean;
	/** Warning: an orange widget with a white header, for alerts. */
	tone?: "warning";
	/** An icon in a tile before the title and description. */
	icon?: ReactNode;
	/** Classes for the content area, such as p-0 for a table that runs edge to edge. */
	contentClassName?: string;
};

/** A dashboard card: title and an optional line under it, something at the end of the header, then the content. */
export function AdminCard({
	title,
	description,
	action,
	children,
	className,
	plain = false,
	tone,
	icon,
	contentClassName,
}: AdminCardProps) {
	const titleId = useId();
	if (plain)
		return (
			<section className="flex flex-col gap-3 pt-2">
				<div className="flex flex-row flex-wrap items-end justify-between gap-x-4 gap-y-2">
					<div className="grid min-w-0 gap-0.5">
						<h2 className="text-base font-semibold">{title}</h2>
						{description && <p className="text-xs text-muted">{description}</p>}
					</div>
					{action}
				</div>
				{children}
			</section>
		);
	return (
		<Widget
			role="region"
			aria-labelledby={titleId}
			{...((className ?? tone) && { className: cn(tone === "warning" && "bg-warning", className) })}
		>
			<Widget.Header className="flex-wrap items-start justify-between gap-x-4 gap-y-2">
				<div className="flex min-w-0 items-center gap-3">
					{icon && (
						<span
							className={cn(
								"grid size-10 shrink-0 place-items-center rounded-xl",
								tone === "warning" ? "bg-white/20 text-white" : "bg-default text-muted",
							)}
						>
							{icon}
						</span>
					)}
					<div className="grid min-w-0 gap-0.5">
						<Widget.Title id={titleId} role="heading" aria-level={2} className={cn(tone === "warning" && "text-white")}>
							{title}
						</Widget.Title>
						{description && (
							<Widget.Description className={cn("text-xs", tone === "warning" ? "text-white" : "text-muted")}>
								{description}
							</Widget.Description>
						)}
					</div>
				</div>
				{action}
			</Widget.Header>
			<Widget.Content className={cn("flex flex-col gap-4", contentClassName)}>{children}</Widget.Content>
		</Widget>
	);
}

type LegendDotProps = { color: string; label: ReactNode };

export function LegendDot({ color, label }: LegendDotProps) {
	return (
		<span className="flex items-center gap-1.5">
			<span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
			<span className="text-xs text-muted">{label}</span>
		</span>
	);
}

type MiniStatProps = { value: ReactNode; label: ReactNode };

/** A figure with its label under it, for the row above a chart. */
export function MiniStat({ value, label }: MiniStatProps) {
	return (
		<div className="flex flex-col">
			<span className="text-lg font-semibold text-foreground tabular-nums">{value}</span>
			<span className="text-xs text-muted">{label}</span>
		</div>
	);
}

type IconButtonProps = {
	label: string;
	onPress: () => void;
	isDisabled?: boolean;
	children: ReactNode;
};

/** An icon-only button that names itself in a tooltip as well as to screen readers. */
export function IconButton({ label, onPress, isDisabled = false, children }: IconButtonProps) {
	return (
		<Tooltip>
			<Button isIconOnly size="sm" variant="tertiary" aria-label={label} isDisabled={isDisabled} onPress={onPress}>
				{children}
			</Button>
			<Tooltip.Content>{label}</Tooltip.Content>
		</Tooltip>
	);
}

export type Trend = { trend: "up" | "down" | "neutral"; label: string };

/**
 * How a figure moved since the period before, for a trend chip: a percentage, "new" when there was nothing to
 * compare with, or null when both are zero.
 */
export function trendOf(current: number, previous: number): Trend | null {
	if (previous === 0) return current === 0 ? null : { trend: "up", label: t`new` };
	const change = (current - previous) / Math.abs(previous);
	if (Math.abs(change) < 0.005) return { trend: "neutral", label: "0%" };
	const percent = Math.round(change * 100);
	return { trend: change > 0 ? "up" : "down", label: `${percent > 0 ? "+" : ""}${percent}%` };
}

/** The accent shades the charts use, darkest first. */
export const CHART_COLORS = ["var(--chart-2)", "var(--chart-4)", "var(--chart-1)", "var(--chart-3)", "var(--chart-5)"];

type StatWidgetProps = {
	icon: ReactNode;
	title: ReactNode;
	value: ReactNode;
	trend?: Trend | null;
	/** A day-by-day line under the value. */
	series?: number[];
	color?: string;
	footer?: ReactNode;
};

/** A headline number in a widget: icon and title in the header, the value with its trend, a sparkline, a note. */
export function StatWidget({
	icon,
	title,
	value,
	trend,
	series,
	color = "var(--color-accent)",
	footer,
}: StatWidgetProps) {
	const titleId = useId();
	const gradientId = useId();
	return (
		<Widget role="region" aria-labelledby={titleId}>
			<Widget.Header className="flex items-center justify-start gap-2">
				<span className="flex shrink-0 text-muted">{icon}</span>
				<Widget.Title id={titleId} role="heading" aria-level={2}>
					{title}
				</Widget.Title>
			</Widget.Header>
			<Widget.Content className="flex flex-col gap-2">
				<div className="flex items-center justify-between gap-2">
					<span className="truncate text-2xl font-semibold tracking-tight tabular-nums">{value}</span>
					{trend && (
						<TrendChip trend={trend.trend} size="sm">
							{trend.label}
						</TrendChip>
					)}
				</div>
				{series && series.length > 1 && (
					<AreaChart
						data={series.map((point) => ({ value: point }))}
						height={48}
						margin={{ top: 4, bottom: 0, left: 0, right: 0 }}
					>
						<defs>
							<linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
								<stop offset="0%" stopColor={color} stopOpacity={0.25} />
								<stop offset="100%" stopColor={color} stopOpacity={0} />
							</linearGradient>
						</defs>
						<AreaChart.Area
							dataKey="value"
							type="monotone"
							stroke={color}
							strokeWidth={1.5}
							fill={`url(#${gradientId})`}
							isAnimationActive={false}
						/>
					</AreaChart>
				)}
				{footer && <p className="text-xs text-muted">{footer}</p>}
			</Widget.Content>
		</Widget>
	);
}
