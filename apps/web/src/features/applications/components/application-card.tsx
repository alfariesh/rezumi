import type { ApplicationSummary } from "../types";
import { Kanban } from "@heroui-pro/react";
import { t } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import { Icon } from "@rezumi/ui/components/icon";
import { cn } from "@rezumi/utils/style";
import { describeNextStep, getNextStep } from "../next-step";
import { ApplicationActionsMenu } from "./application-actions-menu";

type ApplicationCardProps = { application: ApplicationSummary };

/**
 * A board card's content, rendered inside `Kanban.Card` (which gives the surface): the company's initial, role and
 * company, the keyboard drag handle, the ⋯ menu, and the next step (warning tone when it's overdue).
 */
export function ApplicationCard({ application }: ApplicationCardProps) {
	const { i18n } = useLingui();
	const next = describeNextStep(getNextStep(application), application, i18n.locale);

	return (
		<>
			<div className="flex items-start gap-2.5">
				<span
					aria-hidden="true"
					className="grid size-7 shrink-0 place-items-center rounded-lg bg-default text-xs font-semibold text-muted"
				>
					{application.company.slice(0, 1).toUpperCase()}
				</span>
				<div className="grid min-w-0 flex-1">
					<span className="truncate font-semibold text-foreground">{application.role}</span>
					<span className="truncate text-xs text-muted">{application.company}</span>
				</div>
				{/* Screen-reader only until the card has keyboard focus; Enter on it starts a keyboard drag. */}
				<Kanban.DragHandle
					aria-label={t`Drag ${application.role} at ${application.company}`}
					className="mt-1 rounded-md"
				>
					<Icon name="dots-six-vertical" size={16} />
				</Kanban.DragHandle>
				<ApplicationActionsMenu application={application} className="-me-1.5 -mt-1.5" />
			</div>
			<span
				className={cn(
					"flex items-center gap-1.5 text-xs",
					next.tone === "warn" ? "text-warning-soft-foreground" : "text-muted",
				)}
			>
				<Icon name={next.icon} size={15} className="shrink-0" />
				<span className="truncate">{next.title}</span>
			</span>
		</>
	);
}
