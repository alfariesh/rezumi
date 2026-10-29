import type { ButtonProps } from "@rezumi/ui/components/button";
import type { IconName } from "@rezumi/ui/components/icon";
import { Button } from "@rezumi/ui/components/button";
import { Icon } from "@rezumi/ui/components/icon";
import { Kbd } from "@rezumi/ui/components/kbd";
import { Tooltip, TooltipContent, TooltipTrigger } from "@rezumi/ui/components/tooltip";

type IconButtonProps = Omit<ButtonProps, "children" | "aria-label"> & {
	icon: IconName;
	/** Accessible name, also shown in the tooltip. */
	label: string;
	/** Keyboard shortcut shown in the tooltip, e.g. "⌘Z". */
	shortcut?: string;
	iconSize?: number;
	tooltipSide?: "top" | "bottom" | "left" | "right";
};

/** Icon-only buttons (back, close, more, undo, history, assistant, zoom) always carry a name and a tooltip. */
function IconButton({
	icon,
	label,
	shortcut,
	iconSize,
	tooltipSide = "bottom",
	variant = "ghost",
	size = "icon",
	...props
}: IconButtonProps) {
	return (
		<Tooltip>
			<TooltipTrigger render={<Button variant={variant} size={size} aria-label={label} {...props} />}>
				<Icon name={icon} size={iconSize} />
			</TooltipTrigger>
			<TooltipContent side={tooltipSide}>
				{label}
				{shortcut && <Kbd>{shortcut}</Kbd>}
			</TooltipContent>
		</Tooltip>
	);
}

export { IconButton, type IconButtonProps };
