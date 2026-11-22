// Application stages (saved, applied, screening, interview, offer, closed): a colored dot, always beside the stage name.
// The color alone never carries the stage (web DESIGN.md → Accessibility: pair color signals with text).
import type { ApplicationStatus } from "@rezumi/schema/applications/data";
import { View } from "react-native";
import { cx } from "./cx";
import { Text } from "./text";

export type Stage = ApplicationStatus;

// Whole class names, so Uniwind finds them (global.css → --color-stage-*).
const dots = {
	saved: "bg-stage-saved",
	applied: "bg-stage-applied",
	screening: "bg-stage-screening",
	interview: "bg-stage-interview",
	offer: "bg-stage-offer",
	closed: "bg-stage-closed",
} as const satisfies Record<Stage, string>;

export type StageDotProps = { stage: Stage; size?: "sm" | "md" | undefined; className?: string | undefined };

/**
 * The stage color as a dot, hidden from screen readers. Only next to text that names the stage (a column header, a
 * segment item, a row whose value is the stage name); otherwise use StageLabel.
 */
export function StageDot({ stage, size = "md", className }: StageDotProps) {
	return (
		<View
			accessibilityElementsHidden
			importantForAccessibility="no-hide-descendants"
			testID={`stage-dot-${stage}`}
			className={cx("shrink-0 rounded-full", size === "sm" ? "size-2" : "size-2.5", dots[stage], className)}
		/>
	);
}

export type StageLabelProps = {
	stage: Stage;
	/** The translated stage name ("Interview"). */
	label: string;
	size?: "xs" | "sm" | undefined;
	tone?: "default" | "muted" | undefined;
	className?: string | undefined;
};

/** The dot and the stage name, read as the name. */
export function StageLabel({ stage, label, size = "sm", tone = "default", className }: StageLabelProps) {
	return (
		<View accessible accessibilityLabel={label} className={cx("flex-row items-center gap-1.5", className)}>
			<StageDot stage={stage} size={size === "xs" ? "sm" : "md"} />
			<Text size={size} tone={tone} numberOfLines={1}>
				{label}
			</Text>
		</View>
	);
}
