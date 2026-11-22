// Counts by category as labelled horizontal bars (stages reached, sources): native views, so the labels are real text
// that grows with the system size and mirrors in RTL. A stage row draws its stage color beside the name, never alone.
import type { Stage } from "./stage";
import { View } from "react-native";
import { cx } from "./cx";
import { StageDot } from "./stage";
import { Text } from "./text";

// Whole class names, so Uniwind finds them (global.css → --color-stage-*).
const fills = {
	saved: "bg-stage-saved",
	applied: "bg-stage-applied",
	screening: "bg-stage-screening",
	interview: "bg-stage-interview",
	offer: "bg-stage-offer",
	closed: "bg-stage-closed",
} as const satisfies Record<Stage, string>;

export type BarListItem = {
	key: string;
	/** The translated category name ("Interview", "LinkedIn"). */
	label: string;
	value: number;
	/** Shown after the count and read with it ("60%"). */
	note?: string | undefined;
	/** Draws the bar in this stage's color, with its dot before the name; otherwise the accent. */
	stage?: Stage | undefined;
};

export type BarListProps = {
	items: readonly BarListItem[];
	/** The value of a full bar; the largest value by default. */
	max?: number | undefined;
	className?: string | undefined;
};

export function BarList({ items, max, className }: BarListProps) {
	const full = Math.max(1, max ?? Math.max(0, ...items.map((item) => item.value)));
	return (
		<View className={cx("gap-3", className)}>
			{items.map((item) => {
				// A bar that counts something stays visible, however small next to the largest.
				const share = item.value > 0 ? Math.max(item.value / full, 0.03) : 0;
				const fill = { width: `${Math.round(Math.min(1, share) * 100)}%` } as const;
				return (
					<View
						key={item.key}
						accessible
						accessibilityLabel={[`${item.label}: ${item.value}`, item.note].filter(Boolean).join(", ")}
						className="flex-row items-center gap-3"
						testID={`bar-${item.key}`}
					>
						<View className="w-28 flex-row items-center gap-1.5">
							{item.stage ? <StageDot stage={item.stage} size="sm" /> : null}
							<Text size="sm" tone="muted" numberOfLines={1} className="shrink">
								{item.label}
							</Text>
						</View>
						<View className="h-3 flex-1 overflow-hidden rounded-full bg-surface-secondary">
							<View className={cx("h-full rounded-full", item.stage ? fills[item.stage] : "bg-accent")} style={fill} />
						</View>
						<Text size="sm" weight="medium" tabular className="min-w-8 text-end">
							{item.note ? `${item.value} · ${item.note}` : String(item.value)}
						</Text>
					</View>
				);
			})}
		</View>
	);
}
