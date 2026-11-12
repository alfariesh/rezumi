import type { IconName } from "@rezumi/ui/components/icon";
import type { ReactNode } from "react";
import { Typography } from "@heroui/react";
import { useId } from "react";
import { Icon } from "@rezumi/ui/components/icon";
import { cn } from "@rezumi/utils/style";
import { renderAsH2 } from "@/libs/typography";

// The editors' panels are plain: a section is a heading (an icon and an `h6` title) and its editor right under it on
// the panel's own background, with no card or widget around it. Fields on it take the white `primary` variant.

type PanelHeadingProps = {
	/** The title's id, for the section's `aria-labelledby`. */
	id?: string;
	icon: IconName;
	title: ReactNode;
	/** A short note or one action at the end of the row. */
	action?: ReactNode;
	className?: string;
};

/** The icon (muted, 20px) and the title as an `h6` that reads as a level-2 heading. */
export function PanelHeading({ id, icon, title, action, className }: PanelHeadingProps) {
	return (
		<div className={cn("flex min-h-8 min-w-0 items-center gap-2", className)}>
			<Icon name={icon} size={20} className="shrink-0 text-muted [&_*]:stroke-2" />
			<Typography
				type="h6"
				render={renderAsH2}
				{...(id && { id })}
				className="min-w-0 flex-1 truncate text-sm leading-5"
			>
				{title}
			</Typography>
			{action}
		</div>
	);
}

type PanelSectionProps = {
	icon: IconName;
	title: ReactNode;
	/** The heading row's end slot: a note, a count or one action. */
	action?: ReactNode;
	/** Anchor id, e.g. for scrolling the section into view. */
	id?: string;
	className?: string;
	/** Classes for the editor under the heading. */
	contentClassName?: string;
	children: ReactNode;
};

/** A titled group of the panel: the heading, then its editor on the panel's background. */
export function PanelSection({ icon, title, action, id, className, contentClassName, children }: PanelSectionProps) {
	const titleId = useId();

	return (
		<section {...(id && { id })} aria-labelledby={titleId} className={cn("grid min-w-0 gap-3", className)}>
			<PanelHeading id={titleId} icon={icon} title={title} action={action} className="px-1" />
			<div className={cn("@container grid min-w-0 gap-3", contentClassName)}>{children}</div>
		</section>
	);
}
