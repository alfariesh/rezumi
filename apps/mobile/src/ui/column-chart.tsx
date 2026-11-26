// Counts over a few periods as columns (applications per week): Pro's Skia BarChart with whole-number ticks and the
// accent fill. Skia draws in physical coordinates, so the chart stays left to right in RTL (as Pro intends). Screen
// readers get one summary of every value instead of the canvas.
import { BarChart } from "heroui-native-pro/bar-chart";
import { View } from "react-native";
import { cx } from "./cx";

export type ColumnChartPoint = { label: string; value: number };

export type ColumnChartProps = {
	/** In reading order, oldest first; `label` names the period under its column ("3/11"). */
	data: readonly ColumnChartPoint[];
	/** What the chart shows with every value ("Applications per week: 3/11, 2; 10/11, 0"). */
	accessibilityLabel: string;
	/** The chart's height (`h-48` by default). */
	className?: string | undefined;
	testID?: string | undefined;
	/** Limits date labels on long timelines while keeping every column. */
	maxXAxisLabels?: number | undefined;
};

/** Ticks on whole numbers: 0 to the top in at most four steps. */
export function countTicks(max: number) {
	const step = Math.max(1, Math.ceil(max / 4));
	const top = Math.max(1, Math.ceil(max / step)) * step;
	return Array.from({ length: top / step + 1 }, (_, index) => index * step);
}

export function ColumnChart({ data, accessibilityLabel, className, testID, maxXAxisLabels }: ColumnChartProps) {
	const rows = data.map((point, index) => ({ index, value: point.value }));
	const labelStep = maxXAxisLabels ? Math.max(1, Math.ceil((rows.length - 1) / Math.max(1, maxXAxisLabels - 1))) : 1;
	const xTicks = rows
		.filter(
			({ index }) => index === rows.length - 1 || (index % labelStep === 0 && rows.length - 1 - index >= labelStep / 2),
		)
		.map(({ index }) => index);
	const ticks = countTicks(Math.max(0, ...data.map((point) => point.value)));
	return (
		<View
			accessible
			accessibilityRole="image"
			accessibilityLabel={accessibilityLabel}
			testID={testID}
			className={cx("h-48 w-full", className)}
		>
			<View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" className="flex-1">
				<BarChart
					data={rows}
					xKey="index"
					yKeys={["value"]}
					domain={{ y: [0, ticks.at(-1) ?? 1] }}
					domainPadding={{ left: 18, right: 18 }}
					xAxis={{
						tickValues: xTicks,
						formatXLabel: (index) => data[Math.round(index)]?.label ?? "",
					}}
					yAxis={[{ tickValues: ticks, formatYLabel: (value) => String(Math.round(value)) }]}
					wrapperClassName="flex-1"
				>
					{({ points, chartBounds }) => <BarChart.Bar points={points.value} chartBounds={chartBounds} />}
				</BarChart>
			</View>
		</View>
	);
}
