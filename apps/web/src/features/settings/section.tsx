import type { IconName } from "@rezumi/ui/components/icon";
import type { ReactNode } from "react";
import { Widget } from "@heroui-pro/react";
import { useId } from "react";
import { Icon } from "@rezumi/ui/components/icon";
import { cn } from "@rezumi/utils/style";
import { RowIcon } from "@/components/layout/icon-row";

/**
 * Rows split by a hairline that starts under the text: past the 40px icon tile and the 12px gap (52px). The line is
 * drawn in the middle of the gap above each row after the first.
 */
const DIVIDED =
	"gap-6 [&>*+*]:relative [&>*+*]:before:absolute [&>*+*]:before:inset-s-row-indent [&>*+*]:before:inset-e-0 [&>*+*]:before:-top-3 [&>*+*]:before:h-px [&>*+*]:before:bg-separator";

type SettingsSectionProps = {
	/** The anchor other pages link to, e.g. `ai-providers`. */
	id?: string;
	title: ReactNode;
	/** A short line under the title, in the header. */
	description?: ReactNode;
	/** Sits at the right of the header, e.g. "New key". */
	action?: ReactNode;
	children: ReactNode;
	/** A quiet note under the content, in the widget's footer. */
	footer?: ReactNode;
	/** Split the children, usually `SettingsRow`s, by a rule. */
	divided?: boolean;
};

/**
 * A settings group: the Pro `Widget` shell the builder panels and Career pages use, a quiet frame with the title,
 * its description and an action in the header over a white content area. The title labels the region. Rows inside
 * are split by a rule (`divided`), never wrapped in another card.
 */
export function SettingsSection({
	id,
	title,
	description,
	action,
	children,
	footer,
	divided = false,
}: SettingsSectionProps) {
	const titleId = useId();

	return (
		<Widget id={id} role="region" aria-labelledby={titleId} className="scroll-mt-16">
			<Widget.Header className="flex-wrap items-start gap-x-3 gap-y-2">
				<div className="grid min-w-0 flex-1 basis-60 gap-0.5">
					<Widget.Title id={titleId} role="heading" aria-level={2}>
						{title}
					</Widget.Title>
					{description && <Widget.Description className="text-xs text-muted">{description}</Widget.Description>}
				</div>
				{action}
			</Widget.Header>
			<Widget.Content className={cn("grid gap-3", divided && DIVIDED)}>{children}</Widget.Content>
			{footer && <Widget.Footer>{footer}</Widget.Footer>}
		</Widget>
	);
}

type SettingsRowsProps = { children: ReactNode };

/** A list of `SettingsRow as="li"` inside a section that also holds other content, split like a `divided` section. */
export function SettingsRows({ children }: SettingsRowsProps) {
	return <ul className={cn("grid", DIVIDED)}>{children}</ul>;
}

type SettingsRowProps = {
	/** `li` inside `SettingsRows as="ul"`. */
	as?: "div" | "li";
	icon: IconName;
	title: ReactNode;
	description?: ReactNode;
	/** Keep a small control, like a switch, at the end of the row on phones instead of under the text. */
	inline?: boolean;
	children?: ReactNode;
};

/** One setting: its icon, what it is, then its control at the end. Phones put the control under the text. */
export function SettingsRow({
	as: Root = "div",
	icon,
	title,
	description,
	inline = false,
	children,
}: SettingsRowProps) {
	return (
		<Root className="flex flex-wrap items-center gap-x-3 gap-y-2">
			<div className="flex min-w-0 flex-1 basis-56 items-center gap-3">
				<RowIcon>
					<Icon name={icon} size={20} />
				</RowIcon>
				<div className="grid min-w-0 gap-0.5">
					<span className="text-sm font-medium break-words">{title}</span>
					{description && <span className="text-sm break-words text-muted">{description}</span>}
				</div>
			</div>
			{children &&
				(inline ? (
					children
				) : (
					<div className="contents max-sm:block max-sm:basis-full max-sm:ps-row-indent">{children}</div>
				))}
		</Root>
	);
}
