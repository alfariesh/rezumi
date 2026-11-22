// An exact number in a row: the label, − and +, and the value typed between them (a margin in pt, a line height). A
// typed value is rounded to the nearest step (counted from `min`) and kept within the range when the field is left or
// submitted.
import { useState } from "react";
import { View } from "react-native";
import { IconButton } from "./button";
import { Input } from "./fields";
import { haptics } from "./motion";
import { Text } from "./text";

export type NumberStepperProps = {
	label: string;
	value: number;
	/** After the field ("pt", "%", "×"). */
	unit?: string | undefined;
	min: number;
	max?: number | undefined;
	step: number;
	onChange: (value: number) => void;
	/** The buttons' screen-reader names ("Decrease line height"), translated by the caller. */
	decreaseLabel: string;
	increaseLabel: string;
	isDisabled?: boolean | undefined;
	/** On a white surface (a card, a sheet): the field is filled with the page background. */
	variant?: "primary" | "secondary" | undefined;
};

const decimals = (step: number) => (String(step).split(".")[1] ?? "").length;

/** `next` rounded to the nearest step counted from `min`, then kept within the range (the step's decimals, no float dust). */
export function clampStep(next: number, min: number, max: number, step: number) {
	const places = Math.max(decimals(step), decimals(min));
	const snapped = step > 0 ? min + Math.round((next - min) / step) * step : next;
	return Number(Math.min(max, Math.max(min, snapped)).toFixed(places));
}

export function NumberStepper(props: NumberStepperProps) {
	const {
		label,
		value,
		unit,
		min,
		max = Number.POSITIVE_INFINITY,
		step,
		onChange,
		decreaseLabel,
		increaseLabel,
	} = props;
	const { isDisabled = false, variant = "secondary" } = props;
	const [typed, setTyped] = useState<string | null>(null);
	const change = (next: number) => {
		const rounded = clampStep(next, min, max, step);
		if (rounded === value) return;
		haptics.selection();
		onChange(rounded);
	};
	const commit = () => {
		const parsed = Number.parseFloat((typed ?? "").replace(",", "."));
		setTyped(null);
		if (Number.isFinite(parsed)) change(parsed);
	};

	return (
		<View className="min-h-12 flex-row items-center gap-1">
			<Text numberOfLines={2} className="flex-1">
				{label}
			</Text>
			<IconButton
				icon="minus"
				variant="ghost"
				label={decreaseLabel}
				isDisabled={isDisabled || value <= min}
				onPress={() => change(value - step)}
			/>
			<Input
				variant={variant}
				accessibilityLabel={label}
				editable={!isDisabled}
				keyboardType="decimal-pad"
				returnKeyType="done"
				selectTextOnFocus
				value={typed ?? String(value)}
				onChangeText={setTyped}
				onBlur={commit}
				onSubmitEditing={commit}
				className="w-20 text-center font-mono"
			/>
			{unit ? (
				<Text size="xs" tone="muted" className="w-5">
					{unit}
				</Text>
			) : null}
			<IconButton
				icon="plus"
				variant="ghost"
				label={increaseLabel}
				isDisabled={isDisabled || value >= max}
				onPress={() => change(value + step)}
			/>
		</View>
	);
}
