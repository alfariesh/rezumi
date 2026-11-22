// How each change a message implies reads: what it does to the application, and why a fixed one has nothing to do.
import type { ReplyItem } from "./reply-card";
import type { Application } from "@/features/applications/types";
import { useLingui } from "@lingui/react/macro";
import { formatMoney } from "../money";
import { useUserTime } from "@/features/applications/date";
import { describeNextStep, getNextStep } from "@/features/applications/next-step";
import { getStageLabel } from "@/features/applications/stages";

type Change = ReplyItem["data"]["changes"][number];

export function useDescribeChange(reply: ReplyItem, application: Application, now: Date) {
	const { t } = useLingui();
	const { when, locale, timeZone } = useUserTime();
	const current =
		application.followUpNote || describeNextStep(getNextStep(application, now), application, locale, timeZone).title;
	const from = getStageLabel(application.status);
	return (change: Change): { title: string; detail: string } => {
		switch (change.type) {
			case "stage": {
				const stage = getStageLabel(change.stage);
				if (change.stage === application.status)
					return { title: t`Stage stays ${stage}`, detail: t`No change needed. It's already at ${stage}.` };
				if (application.status === "saved")
					return { title: t`Move to ${stage}`, detail: t`Mark it as applied in Apply first.` };
				return { title: t`Move to ${stage}`, detail: t`Moves the application from ${from}.` };
			}
			// One change carries the next step and, when a reply is due, its reminder.
			case "follow-up": {
				const note = change.note;
				if (!change.at) return { title: t`Next step: ${note}`, detail: t`Replaces “${current}” on the application.` };
				const at = when(change.at);
				return {
					title: t`Follow up on ${at}`,
					detail: note
						? t`Next step: ${note}. Adds a reminder to Today.`
						: t`Adds a reminder to Today if you haven't heard back by then.`,
				};
			}
			case "offer": {
				const offer = reply.data.offer;
				const summary = offer
					? [offer.base === null ? "" : formatMoney(locale, offer.currency, offer.base), offer.location]
							.filter(Boolean)
							.join(" · ")
					: "";
				return {
					title: t`Save these offer terms to compare`,
					detail: summary ? t`${summary}. Opens in Applications → Offers.` : t`Opens in Applications → Offers.`,
				};
			}
		}
	};
}
