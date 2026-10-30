import type { IconName } from "@rezumi/ui/components/icon";
import type { ReactNode } from "react";
import { Widget } from "@heroui-pro/react";
import { useId } from "react";
import { Icon } from "@rezumi/ui/components/icon";
import { cn } from "@rezumi/utils/style";

type CheckWidgetProps = {
	icon: IconName;
	title: ReactNode;
	/** The header's trailing slot: a short description, a count or one small action. */
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
			<Widget.Header>
				<span className="flex min-w-0 items-center gap-2">
					<Icon name={icon} size={16} className="shrink-0 text-muted" />
					<Widget.Title id={titleId} className="truncate">
						{title}
					</Widget.Title>
				</span>
				{trailing}
			</Widget.Header>
			<Widget.Content className={cn("grid gap-4", contentClassName)}>{children}</Widget.Content>
		</Widget>
	);
}
