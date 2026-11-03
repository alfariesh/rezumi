import type { IconName } from "@rezumi/ui/components/icon";
import type { ReactNode } from "react";
import { Widget } from "@heroui-pro/react";
import { useId } from "react";
import { cn } from "@rezumi/utils/style";
import { WidgetHeading } from "@/components/layout/widget-heading";

type CheckWidgetProps = {
	icon: IconName;
	title: ReactNode;
	/** The header's trailing slot: a short description, a count or one `WidgetAction`. */
	trailing?: ReactNode | undefined;
	contentClassName?: string | undefined;
	children: ReactNode;
};

/**
 * One group of the Check panel on the editor background: a titled widget shell around a white content area. Nested
 * blocks inside the content use `rounded-xl bg-surface-secondary`.
 */
export function CheckWidget({ icon, title, trailing, contentClassName, children }: CheckWidgetProps) {
	const titleId = useId();

	return (
		<Widget role="region" aria-labelledby={titleId}>
			<WidgetHeading id={titleId} icon={icon} title={title} action={trailing} />
			<Widget.Content className={cn("grid gap-4", contentClassName)}>{children}</Widget.Content>
		</Widget>
	);
}
