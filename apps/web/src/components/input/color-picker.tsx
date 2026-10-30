import type { Color } from "@heroui/react";
import {
	ColorArea,
	ColorField,
	ColorSlider,
	ColorSwatch,
	ColorSwatchPicker,
	parseColor,
	Popover,
	Separator,
} from "@heroui/react";
import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { useState } from "react";
import { useControlledState } from "@/hooks/use-controlled-state";

const presetColors = [
	"rgba(0, 0, 0, 1)",
	"rgba(231, 0, 11, 1)",
	"rgba(245, 73, 0, 1)",
	"rgba(225, 113, 0, 1)",
	"rgba(208, 135, 0, 1)",
	"rgba(94, 165, 0, 1)",
	"rgba(0, 166, 62, 1)",
	"rgba(0, 153, 102, 1)",
	"rgba(0, 146, 184, 1)",
	"rgba(0, 132, 209, 1)",
	"rgba(21, 93, 252, 1)",
	"rgba(79, 57, 246, 1)",
	"rgba(127, 34, 254, 1)",
	"rgba(200, 0, 222, 1)",
	"rgba(230, 0, 118, 1)",
	"rgba(69, 85, 108, 1)",
] as const;

const BLACK = parseColor("rgba(0, 0, 0, 1)");

/** The stored `rgba()` string as a HeroUI colour; anything unparseable (a CSS keyword, say) shows as black. */
function toColor(value: string | undefined): Color {
	if (!value) return BLACK;
	try {
		return parseColor(value);
	} catch {
		return BLACK;
	}
}

type ColorPickerProps = Omit<
	React.ComponentProps<typeof Popover.Trigger>,
	"children" | "defaultValue" | "onChange" | "value"
> & {
	value?: string;
	defaultValue?: string;
	onChange?: (value: string) => void;
	open?: boolean;
	onOpenChange?: (open: boolean) => void;
	trigger?: React.ReactNode;
	children?: React.ReactNode;
};

/**
 * A colour swatch that opens presets, a saturation and brightness area, hue and opacity sliders and a hex field.
 * Values go in and out as `rgba(r, g, b, a)` strings.
 */
export function ColorPicker({
	value,
	defaultValue,
	onChange,
	open,
	onOpenChange,
	trigger,
	children,
	...triggerProps
}: ColorPickerProps) {
	const [currentValue, setCurrentValue] = useControlledState<string>({
		value,
		defaultValue,
		onChange,
	});
	// An rgba string has no hue once the colour is grey or black. Keep the colour last picked here while it still
	// matches the value, so the area and hue thumbs stay put while dragging through those shades.
	const [picked, setPicked] = useState<Color | null>(null);
	const color = picked && picked.toString("rgba") === currentValue ? picked : toColor(currentValue);

	const pick = (next: Color) => {
		setPicked(next);
		setCurrentValue(next.toString("rgba"));
	};

	return (
		<Popover {...(open !== undefined && { isOpen: open })} {...(onOpenChange && { onOpenChange })}>
			{trigger ?? (
				<Popover.Trigger
					aria-label={t`Choose color`}
					className="shrink-0 cursor-(--cursor-interactive) rounded-md"
					{...triggerProps}
				>
					<ColorSwatch color={color} shape="square" size="sm" className="rounded-md" />
				</Popover.Trigger>
			)}

			<Popover.Content placement="bottom start" className="w-72">
				<Popover.Dialog className="grid gap-4 p-3 outline-hidden">
					{children && (
						<>
							{children}
							<Separator />
						</>
					)}

					<div className="grid gap-2">
						<span className="text-xs font-medium text-muted">
							<Trans>Presets</Trans>
						</span>
						<ColorSwatchPicker
							aria-label={t`Presets`}
							value={color}
							onChange={pick}
							size="sm"
							variant="square"
							className="grid grid-cols-8 gap-1.5"
						>
							{presetColors.map((preset) => (
								<ColorSwatchPicker.Item key={preset} color={preset}>
									<ColorSwatchPicker.Swatch />
									<ColorSwatchPicker.Indicator />
								</ColorSwatchPicker.Item>
							))}
						</ColorSwatchPicker>
					</div>

					<div className="grid gap-3">
						<span className="text-xs font-medium text-muted">
							<Trans>Custom</Trans>
						</span>
						<ColorArea
							aria-label={t`Saturation and brightness`}
							value={color}
							onChange={pick}
							colorSpace="hsb"
							xChannel="saturation"
							yChannel="brightness"
							className="w-full"
						>
							<ColorArea.Thumb />
						</ColorArea>
						<ColorSlider aria-label={t`Hue`} channel="hue" colorSpace="hsb" value={color} onChange={pick}>
							<ColorSlider.Track>
								<ColorSlider.Thumb />
							</ColorSlider.Track>
						</ColorSlider>
						<ColorSlider aria-label={t`Opacity`} channel="alpha" value={color} onChange={pick}>
							<ColorSlider.Track>
								<ColorSlider.Thumb />
							</ColorSlider.Track>
						</ColorSlider>
						<ColorField
							aria-label={t`Hex color`}
							fullWidth
							value={color}
							// A hex has no opacity: keep the one set on the slider.
							onChange={(next) => next && pick(next.withChannelValue("alpha", color.getChannelValue("alpha")))}
						>
							<ColorField.Group variant="secondary" fullWidth>
								<ColorField.Input className="font-mono" />
							</ColorField.Group>
						</ColorField>
					</div>
				</Popover.Dialog>
			</Popover.Content>
		</Popover>
	);
}
