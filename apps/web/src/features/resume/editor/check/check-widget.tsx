import type { IconName } from "@rezumi/ui/components/icon";
import type { ReactNode } from "react";
import { PanelSection } from "../chrome/panel-section";

type CheckWidgetProps = {
	icon: IconName;
	title: ReactNode;
	/** The heading row's trailing slot: a short note, a count or one `WidgetAction`. */
	trailing?: ReactNode | undefined;
	contentClassName?: string | undefined;
	children: ReactNode;
};

/**
 * One group of the Check panel: its heading (an icon and an `h6` title), then the content on the panel's own
 * background. Nested blocks inside the content use `rounded-xl bg-surface-secondary`.
 */
export function CheckWidget({ icon, title, trailing, contentClassName, children }: CheckWidgetProps) {
	return (
		<PanelSection icon={icon} title={title} action={trailing} contentClassName={contentClassName ?? ""}>
			{children}
		</PanelSection>
	);
}
