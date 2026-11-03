import type { ButtonProps } from "@heroui/react";
import type { IconName } from "@rezumi/ui/components/icon";
import type { ReactNode } from "react";
import { Widget } from "@heroui-pro/react";
import { Button, buttonVariants, Chip } from "@heroui/react";
import { Icon } from "@rezumi/ui/components/icon";
import { cn } from "@rezumi/utils/style";

/**
 * Icon beside a widget title: 20px on the title's 24px line, drawn with a 2px stroke (the set's 1.5px reads thin next
 * to a semibold title).
 */
const ICON_SIZE = 20;

type WidgetHeadingProps = {
	/** The title's id, for the widget's `aria-labelledby`. */
	id: string;
	/** The icon before the title; every widget has one. It stays muted so the title carries the meaning. */
	icon: IconName;
	title: ReactNode;
	/** A count shown as a quiet chip after the title. */
	count?: number | undefined;
	/** One muted line under the title; with an icon it lines up under the title's text. */
	description?: ReactNode;
	/** The header's end slot: one `WidgetAction`, a chip or a short note. */
	action?: ReactNode;
	className?: string | undefined;
	/** Extra classes for the title, e.g. a color on a tinted widget. */
	titleClassName?: string | undefined;
};

/**
 * The header of a Widget, the same in every widget (the spacing and type are in `globals.css` under `.widget__header`):
 * an icon, the title as a level-2 heading, an optional count and description, and the action at the end. The
 * header is as tall with an action as without one, so widgets side by side line up.
 */
export function WidgetHeading({
	id,
	icon,
	title,
	count,
	description,
	action,
	className,
	titleClassName,
}: WidgetHeadingProps) {
	return (
		<Widget.Header className={className}>
			<div className="grid min-w-0 flex-1">
				<span className="flex min-w-0 items-center gap-2">
					<Icon name={icon} size={ICON_SIZE} className="shrink-0 text-muted [&_*]:stroke-2" />
					<Widget.Title id={id} role="heading" aria-level={2} className={cn("truncate", titleClassName)}>
						{title}
					</Widget.Title>
					{count !== undefined && (
						<Chip size="sm" variant="soft" className="shrink-0 tabular-nums">
							{count}
						</Chip>
					)}
				</span>
				{description && <Widget.Description className="ps-7 text-pretty">{description}</Widget.Description>}
			</div>
			{action && <div className="flex shrink-0 items-center gap-3">{action}</div>}
		</Widget.Header>
	);
}

/**
 * A text button for a widget's header: accent text, no background or padding, so its text ends where the header's 16px
 * padding does. It is 32px tall like every icon button there. Use it on a `Link` or an `a` too, with
 * `className={widgetActionClass}`.
 */
export const widgetActionClass = buttonVariants({
	variant: "ghost",
	size: "sm",
	className:
		"touch-target h-8 gap-1.5 rounded-md px-0 underline-offset-4 [--button-bg-hover:transparent] [--button-bg-pressed:transparent] [--button-fg:var(--accent)] hover:underline aria-[current=page]:underline",
});

type WidgetActionProps = Omit<ButtonProps, "variant" | "size" | "className"> & { className?: string };

/** The one action a widget's header offers, as a link-style button: "Add a story", "New key". */
export function WidgetAction({ className, ...props }: WidgetActionProps) {
	return <Button variant="ghost" size="sm" className={cn(widgetActionClass, className)} {...props} />;
}
