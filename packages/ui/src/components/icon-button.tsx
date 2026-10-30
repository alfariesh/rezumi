import type { ButtonProps } from "@heroui/react";
import type { IconName } from "@rezumi/ui/components/icon";
import { Button, Kbd, Spinner, Tooltip } from "@heroui/react";
import { Icon } from "@rezumi/ui/components/icon";

type IconButtonProps = Omit<ButtonProps, "children" | "aria-label" | "isIconOnly"> & {
	icon: IconName;
	/** Accessible name, also shown in the tooltip. */
	label: string;
	/** Keyboard shortcut shown in the tooltip, e.g. "⌘Z". */
	shortcut?: string | undefined;
	iconSize?: number | undefined;
	tooltipPlacement?: "top" | "bottom" | "left" | "right" | undefined;
};

/** Icon-only buttons (back, close, more, undo, history, assistant, zoom) always carry a name and a tooltip. */
function IconButton({
	icon,
	label,
	shortcut,
	iconSize,
	tooltipPlacement = "bottom",
	variant = "ghost",
	isPending,
	...props
}: IconButtonProps) {
	return (
		<Tooltip>
			<Button isIconOnly variant={variant} aria-label={label} isPending={Boolean(isPending)} {...props}>
				{isPending ? <Spinner size="sm" color="current" aria-hidden /> : <Icon name={icon} size={iconSize} />}
			</Button>
			<Tooltip.Content placement={tooltipPlacement} className="flex items-center gap-1.5">
				{label}
				{shortcut && <Kbd>{shortcut}</Kbd>}
			</Tooltip.Content>
		</Tooltip>
	);
}

export { IconButton, type IconButtonProps };
