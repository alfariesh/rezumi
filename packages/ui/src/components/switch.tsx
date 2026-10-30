import type { SwitchProps } from "@heroui/react";
import type * as React from "react";
import { Description, Switch } from "@heroui/react";
import { cn } from "@rezumi/utils/style";

type SwitchRowProps = Omit<SwitchProps, "children"> & {
	label: React.ReactNode;
	description?: React.ReactNode;
};

/**
 * A settings row that is one HeroUI Switch: the label on the start side, the switch on the end, and an optional
 * description under the label (HeroUI wires it as the switch's description). The whole row toggles, so the label is
 * part of the target.
 */
function SwitchRow({ className, label, description, ...props }: SwitchRowProps) {
	return (
		<Switch data-slot="switch-row" className={cn("w-full flex-col items-stretch gap-0.5 py-2", className)} {...props}>
			<Switch.Content className="w-full justify-between gap-4 text-start">
				<span className="min-w-0 text-sm">{label}</span>
				<Switch.Control>
					<Switch.Thumb />
				</Switch.Control>
			</Switch.Content>
			{description && <Description className="ps-0 pe-14">{description}</Description>}
		</Switch>
	);
}

export { SwitchRow, type SwitchRowProps };
