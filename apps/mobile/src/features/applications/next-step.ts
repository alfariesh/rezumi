// How an application's next step reads in the app (list rows, cards, the detail sheet, the workspace). What the next
// step is comes from `@rezumi/career/applications`.
import type { ApplicationSummary as Application } from "./types";
import type { IconName } from "@/ui";
import type { NextStep } from "@rezumi/career/applications";
import { plural, t } from "@lingui/core/macro";
import { getClosedReasonLabel, getInterviewKindLabel } from "./stages";

export { getNextStep } from "@rezumi/career/applications";
export type { NextStep } from "@rezumi/career/applications";

export type NextStepText = { icon: IconName; title: string; sub: string; tone: "normal" | "warn" | "muted" };

const formatWhen = (date: Date, locale: string, timeZone: string, withTime: boolean) =>
	date.toLocaleString(locale, {
		timeZone,
		weekday: "short",
		day: "numeric",
		month: "short",
		...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
	});

/** How a next step reads in the list, on cards and in the detail sheet, on the user's clock (`useUserTime`). */
export function describeNextStep(
	step: NextStep,
	application: Pick<Application, "status" | "closedReason">,
	locale: string,
	timeZone: string,
): NextStepText {
	switch (step.kind) {
		case "interview": {
			const kind = getInterviewKindLabel(step.interview.kind);
			const where = step.interview.location ? ` · ${step.interview.location}` : "";
			return {
				icon: "calendar-dot",
				title: t`${kind} interview`,
				sub: `${formatWhen(step.at, locale, timeZone, true)}${where}`,
				tone: "normal",
			};
		}
		case "follow-up":
			return {
				icon: step.overdue ? "clock" : "calendar-dot",
				title: step.note || t`Follow up`,
				sub: formatWhen(step.at, locale, timeZone, false),
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
						sub: step.days === 0 ? t`Since today` : plural(step.days, { one: "For # day", other: "For # days" }),
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
