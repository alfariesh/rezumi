// Pro's ProgressCircle as one screen-reader element with a required label: a ring with a value in the middle (the
// readability score in Check). Pro's root is a plain view, so the wrapper adds the role, label and value.
import type { ProgressCircleRootProps } from "heroui-native-pro/progress-circle";
import type { ReactNode } from "react";
import { ProgressCircle as ProProgressCircle } from "heroui-native-pro/progress-circle";

export type ProgressCircleProps = Omit<ProgressCircleRootProps, "children" | "accessibilityLabel"> & {
	/** What the ring measures ("Readability score"); read with the value. */
	accessibilityLabel: string;
	/** What the middle shows; the formatted value when left out. */
	children?: ReactNode;
};

function ProgressCircleRoot({
	accessibilityLabel,
	children,
	value = 0,
	minValue = 0,
	maxValue = 100,
	...props
}: ProgressCircleProps) {
	return (
		<ProProgressCircle
			accessible
			accessibilityRole="progressbar"
			accessibilityLabel={accessibilityLabel}
			accessibilityValue={{ min: minValue, max: maxValue, now: value }}
			value={value}
			minValue={minValue}
			maxValue={maxValue}
			{...props}
		>
			<ProProgressCircle.Indicator />
			<ProProgressCircle.ValueLabel>{children}</ProProgressCircle.ValueLabel>
		</ProProgressCircle>
	);
}

export const ProgressCircle = Object.assign(ProgressCircleRoot, {
	Indicator: ProProgressCircle.Indicator,
	ValueLabel: ProProgressCircle.ValueLabel,
});
