// A labelled slider that changes its value once, when the finger lifts (or a tap lands): the thumb follows the drag
// on its own, so a document isn't re-rendered and saved for every step on the way. The label row shows `valueLabel`,
// which screen readers also read; they adjust the value one step at a time.
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
const decimals = (value: number) => (String(value).split(".")[1] ?? "").length;

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
	const commit = (next: number) => {
		if (next === value) return;
		haptics.selection();
		onCommit(next);
	};
	// Screen readers adjust by one step (swipe up/down on iOS, volume keys on Android); a value stored past an end moves
	// to that end first.
	const adjust = (direction: 1 | -1) => {
		const places = Math.max(decimals(step), decimals(minValue));
		const snapped = minValue + Math.round((value + direction * step - minValue) / step) * step;
		const next = Number(Math.min(maxValue, Math.max(minValue, snapped)).toFixed(places));
		if (direction > 0 ? next > value : next < value) commit(next);
	};
	const percent = maxValue > minValue ? Math.round(((shown - minValue) / (maxValue - minValue)) * 100) : 0;

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
				commit(first(next, shown));
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
				<Slider.Thumb
					// HeroUI gives the thumb a slider role but doesn't make it an accessibility element.
					accessible
					accessibilityLabel={label}
					// `now` is a whole percentage (the native bridge takes integers); `text` is what's read ("10 pt").
					accessibilityValue={{ min: 0, max: 100, now: percent, text: valueLabel(live ?? value) }}
					accessibilityActions={isDisabled ? [] : [{ name: "increment" }, { name: "decrement" }]}
					onAccessibilityAction={(event) => {
						if (event.nativeEvent.actionName === "increment") adjust(1);
						else if (event.nativeEvent.actionName === "decrement") adjust(-1);
					}}
				/>
			</Slider.Track>
		</Slider>
	);
}
