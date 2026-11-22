import type { IconName } from "./icon";
// Buttons: HeroUI's Button as shipped (primary for the one main action, secondary for the rest, ghost/outline for
// supporting actions, tertiary for quiet ones, danger-soft for destructive ones that are not the main action, danger
// for the confirmation). IconButton is the only addition: an icon-only control with a required label and a 44 pt
// target, like the web's IconButton.
import type { ButtonRootProps } from "heroui-native";
import { Button } from "heroui-native";
import { cx } from "./cx";
import { Icon } from "./icon";
import { size as sizes } from "./tokens";

export { Button, LinkButton, CloseButton } from "heroui-native";

export type IconButtonProps = {
	icon: IconName;
	onPress?: ButtonRootProps["onPress"];
	onLongPress?: ButtonRootProps["onLongPress"];
	variant?: ButtonRootProps["variant"];
	size?: ButtonRootProps["size"];
	isDisabled?: boolean | undefined;
	accessibilityHint?: string | undefined;
	className?: string | undefined;
	testID?: string | undefined;
	/** Read by screen readers; icon-only controls must say what they do. */
	label: string;
	/** The selected state of a toggle (draws the duotone glyph). */
	isSelected?: boolean | undefined;
};

export function IconButton({
	icon,
	label,
	isSelected,
	variant = "ghost",
	size = "md",
	isDisabled = false,
	className,
	...props
}: IconButtonProps) {
	const iconSize = size === "sm" ? sizes.icon.sm : sizes.icon.md;
	const tone =
		variant === "primary" || variant === "danger"
			? "accent-foreground"
			: variant === "danger-soft"
				? "danger"
				: "foreground";
	return (
		<Button
			{...props}
			variant={variant}
			size={size}
			isDisabled={isDisabled}
			isIconOnly
			accessibilityLabel={label}
			accessibilityState={isSelected === undefined ? undefined : { selected: isSelected }}
			hitSlop={size === "sm" ? 8 : 2}
			className={cx(className)}
		>
			<Icon name={icon} size={iconSize} variant={isSelected ? "duotone" : "stroke"} tone={tone} />
		</Button>
	);
}
