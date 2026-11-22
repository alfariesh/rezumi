import type { ApplicationSummary } from "./types";
import type { NextStep } from "@rezumi/career/applications";
import type { IconName } from "@rezumi/ui/components/icon";
import { plural, t } from "@lingui/core/macro";
import { interviewKindOf } from "@rezumi/career/applications";
import { getClosedReasonLabel } from "./stages";

export { daysInStage, getNextStep } from "@rezumi/career/applications";
export type { NextStep } from "@rezumi/career/applications";

export type NextStepText = { icon: IconName; title: string; sub: string; tone: "normal" | "warn" | "muted" };

const formatWhen = (date: Date, locale: string, withTime: boolean) =>
	date.toLocaleString(locale, {
		weekday: "short",
		day: "numeric",
		month: "short",
		...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
	});

/** How a next step reads in the list, on cards and in the detail sheet. */
export function describeNextStep(
	step: NextStep,
	application: Pick<ApplicationSummary, "status" | "closedReason">,
	locale: string,
): NextStepText {
	switch (step.kind) {
		case "interview": {
			const kind = interviewKindOf(step.interview.kind)?.label ?? step.interview.kind;
			const where = step.interview.location ? ` · ${step.interview.location}` : "";
			return {
				icon: "calendar-dot",
				title: t`${kind} interview`,
				sub: `${formatWhen(step.at, locale, true)}${where}`,
				tone: "normal",
			};
		}
		case "follow-up":
			return {
				icon: step.overdue ? "clock" : "calendar-dot",
				title: step.note || t`Follow up`,
				sub: formatWhen(step.at, locale, false),
				tone: step.overdue ? "warn" : "normal",
			};
		case "no-reply":
			return {
				icon: "clock",
				title: plural(step.days, { one: "No reply in # day", other: "No reply in # days" }),
				sub: t`A short follow-up is usually fine now`,
				tone: "warn",
			};
		case "waiting":
			return application.status === "applied"
				? {
						icon: "hourglass",
						title:
							step.days === 0
								? t`Applied today`
								: plural(step.days, { one: "Applied # day ago", other: "Applied # days ago" }),
						sub: "",
						tone: "normal",
					}
				: {
						icon: "hourglass",
						title: t`Waiting to hear back`,
						sub: plural(step.days, { one: "For # day", other: "For # days" }),
						tone: "normal",
					};
		case "not-applied":
			return { icon: "bookmark-simple", title: t`Not applied yet`, sub: "", tone: "muted" };
		case "closed":
			return {
				icon: "check",
				title: application.closedReason ? getClosedReasonLabel(application.closedReason) : t`Closed`,
				sub: "",
				tone: "muted",
			};
	}
}
