import type { ColorResult } from "@uiw/color-convert";
import { Popover, Separator } from "@heroui/react";
import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { hsvaToRgbaString, rgbaStringToHsva } from "@uiw/color-convert";
import ReactColorColorful from "@uiw/react-color-colorful";
import { cn } from "@rezumi/utils/style";
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

	const color = rgbaStringToHsva(currentValue);

	function onColorChange(color: ColorResult) {
		const rgbaString = hsvaToRgbaString(color.hsva);
		setCurrentValue(rgbaString);
	}

	return (
		<Popover {...(open !== undefined && { isOpen: open })} {...(onOpenChange && { onOpenChange })}>
			{trigger ?? (
				<Popover.Trigger aria-label={t`Choose color`} {...triggerProps}>
					<div
						className="size-6 shrink-0 cursor-pointer rounded-sm border border-ink/60 transition-transform duration-quick ease-enter focus-visible:outline-hidden active:scale-[0.97]"
						style={{ backgroundColor: currentValue }}
					/>
				</Popover.Trigger>
			)}

			<Popover.Content placement="bottom start" className="min-w-xs">
				<Popover.Dialog className="grid gap-3 p-3 outline-hidden">
					{children && (
						<>
							{children}
							<Separator />
						</>
					)}

					<div className="flex flex-col gap-2">
						<span className="text-xs font-medium text-ink-3">
							<Trans>Presets</Trans>
						</span>

						<div className="grid grid-cols-8 gap-3 rounded bg-sunken p-3">
							{presetColors.map((color) => (
								<button
									key={color}
									type="button"
									title={color}
									style={{ backgroundColor: color }}
									aria-label={t`Use color ${color}`}
									aria-pressed={currentValue === color}
									onClick={() => setCurrentValue(color)}
									className={cn(
										"size-5 shrink-0 cursor-pointer rounded-sm transition-transform duration-quick ease-enter focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-hidden active:scale-[0.97]",
										currentValue === color && "border border-ink/60",
									)}
								/>
							))}
						</div>
					</div>

					<div className="flex flex-col gap-2">
						<span className="text-xs font-medium text-ink-3">
							<Trans>Custom</Trans>
						</span>

						<div className="rounded bg-sunken p-3 *:w-full! [&_.w-color-alpha]:mt-4! [&_.w-color-alpha]:h-4! [&_.w-color-alpha>div]:rounded-sm! [&_.w-color-hue]:mt-4! [&_.w-color-hue]:h-4! [&_.w-color-hue]:rounded-sm! [&_.w-color-saturation]:h-36! [&_.w-color-saturation]:rounded-sm!">
							<ReactColorColorful color={color} onChange={onColorChange} />
						</div>
					</div>
				</Popover.Dialog>
			</Popover.Content>
		</Popover>
	);
}
