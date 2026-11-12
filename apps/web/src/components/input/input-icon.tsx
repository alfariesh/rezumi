import type { IconName } from "@rezumi/ui/components/icon";
import type { ReactNode } from "react";
import { Icon } from "@rezumi/ui/components/icon";
import { cn } from "@rezumi/utils/style";

/** The room an `Input` leaves at its start for an {@link InputIcon}: pair it with `className` on the input. */
export const INPUT_WITH_ICON = "ps-9";

type InputIconProps = {
	name: IconName;
	className?: string;
};

/** A muted icon at the start of a field, drawn over the input (which takes {@link INPUT_WITH_ICON}). */
function InputIcon({ name, className }: InputIconProps) {
	return (
		<Icon
			name={name}
			size={18}
			className={cn("pointer-events-none absolute start-2.5 top-1/2 z-10 -translate-y-1/2 text-muted", className)}
		/>
	);
}

type WithInputIconProps = {
	icon: IconName | undefined;
	className?: string;
	children: ReactNode;
};

/** Wraps one `Input` so an icon sits at its start; with no icon the input renders as it is. */
export function WithInputIcon({ icon, className, children }: WithInputIconProps) {
	if (!icon) return children;
	return (
		<div className={cn("relative min-w-0", className)}>
			<InputIcon name={icon} />
			{children}
		</div>
	);
}
