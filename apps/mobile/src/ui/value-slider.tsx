// A labelled slider that changes its value once, when the finger lifts (or a tap lands): the thumb follows the drag
// on its own, so a document isn't re-rendered and saved for every step on the way. The label row shows `valueLabel`.
import { useState } from "react";
import { View } from "react-native";
import { Slider } from "./fields";
import { haptics } from "./motion";
import { Text } from "./text";

export type ValueSliderProps = {
	label: string;
	/** The value as shown at the end of the label row and read by screen readers ("10 pt"); gets the live value. */
	valueLabel: (value: number) => string;
	value: number;
	minValue: number;
	maxValue: number;
	step: number;
	onCommit: (value: number) => void;
	isDisabled?: boolean | undefined;
};

const first = (value: number | number[], fallback: number) => (Array.isArray(value) ? (value[0] ?? fallback) : value);

export function ValueSlider({
	label,
	valueLabel,
	value,
	minValue,
	maxValue,
	step,
	onCommit,
	isDisabled,
}: ValueSliderProps) {
	const [live, setLive] = useState<number | null>(null);
	// The stored value can sit outside the range (an exact value typed elsewhere): the thumb stops at the end.
	const shown = live ?? Math.min(maxValue, Math.max(minValue, value));

	return (
		<Slider
			value={shown}
			minValue={minValue}
			maxValue={maxValue}
			step={step}
			isDisabled={isDisabled ?? false}
			onChange={(next) => setLive(first(next, shown))}
			onChangeEnd={(next) => {
				setLive(null);
				const committed = first(next, shown);
				if (committed === value) return;
				haptics.selection();
				onCommit(committed);
			}}
		>
			<View className="flex-row items-baseline justify-between gap-2">
				<Text weight="medium">{label}</Text>
				<Text mono tabular tone="muted">
					{valueLabel(live ?? value)}
				</Text>
			</View>
			<Slider.Track>
				<Slider.Fill />
				<Slider.Thumb accessibilityLabel={label} />
			</Slider.Track>
		</Slider>
	);
}
