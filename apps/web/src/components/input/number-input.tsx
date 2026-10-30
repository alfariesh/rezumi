import type { InputGroupInputProps } from "@heroui/react";
import { InputGroup } from "@heroui/react";
import { useState } from "react";

type NumberInputProps = Omit<InputGroupInputProps, "value" | "onChange" | "min" | "max" | "type"> & {
	value: number;
	min?: number | undefined;
	max?: number | undefined;
	onValueChange: (value: number) => void;
};

export function NumberInput({ value, min, max, onValueChange, onBlur, ...props }: NumberInputProps) {
	// Keep partial text local: clamping the visible value mid-keystroke prevents typing e.g. 12 with min=6.
	const [draft, setDraft] = useState<{ text: string; value: number } | null>(null);

	return (
		<InputGroup.Input
			{...props}
			data-slot="input-group-control"
			type="number"
			min={min}
			max={max}
			value={draft?.value === value ? draft.text : value}
			onChange={(event) => {
				const text = event.target.value;
				const number = event.target.valueAsNumber;
				const next = Number.isFinite(number) ? Math.min(Math.max(number, min ?? -Infinity), max ?? Infinity) : value;
				setDraft({ text, value: next });
				if (Number.isFinite(number)) onValueChange(next);
			}}
			onBlur={(event) => {
				setDraft(null);
				onBlur?.(event);
			}}
		/>
	);
}
