import type { PlanSummary } from "./plan";
import { useLingui } from "@lingui/react/macro";
import { useState } from "react";
import { getPlanName } from "./plan";
import { ListRow, ListSection } from "@/ui";

type PlanCardData = Pick<
	PlanSummary,
	"planId" | "currentPeriodEndsAt" | "source" | "renews" | "paymentMethod" | "qrisPass" | "upcoming"
> & {
	subscription: Pick<NonNullable<PlanSummary["subscription"]>, "status" | "currentPeriodEnd"> | null;
};
type PlanCardProps = { plan: PlanCardData; formatDate: (date: Date) => string };

export function PlanCard({ plan, formatDate }: PlanCardProps) {
	const { t } = useLingui();
	const [openedAt] = useState(Date.now);
	const end = plan.currentPeriodEndsAt;
	const qris = plan.qrisPass === undefined ? plan.paymentMethod === "qris" : plan.qrisPass?.active;
	const source =
		plan.source === "subscription"
			? t`Card subscription`
			: qris
				? t`QRIS pass`
				: plan.source === "period"
					? t`Granted access`
					: undefined;
	const lastSubscription = plan.planId === "free" ? plan.subscription : null;
	const subscriptionEnd =
		lastSubscription?.status === "expired" || lastSubscription?.status === "cancelled"
			? lastSubscription.currentPeriodEnd
			: null;

	const passEnd = plan.planId === "free" ? plan.qrisPass?.lastEndedAt : null;
	const previousPass = passEnd && (!subscriptionEnd || passEnd > subscriptionEnd);
	const expiredAt = previousPass ? passEnd : subscriptionEnd;

	return (
		<ListSection
			title={t`Your plan`}
			footer={t`When a plan ends, nothing is locked or deleted: every document stays open to edit, share and download as a PDF.`}
		>
			<ListRow
				title={getPlanName(plan.planId)}
				icon={plan.planId === "pro-ai" ? "sparkle" : "seal-check"}
				description={
					end ? (plan.renews ? t`Renews on ${formatDate(end)}` : t`Active until ${formatDate(end)}`) : t`No end date`
				}
			/>
			{source ? (
				<ListRow title={source} icon={plan.source === "subscription" ? "seal-check" : "calendar-blank"} />
			) : null}
			{expiredAt && expiredAt.getTime() <= openedAt ? (
				<ListRow
					title={previousPass ? t`Previous QRIS pass` : t`Previous card subscription`}
					description={t`Ended on ${formatDate(expiredAt)}`}
					icon="clock"
				/>
			) : null}
			{plan.upcoming.map((next) => (
				<ListRow
					key={`${next.planId}-${next.startsAt.toISOString()}`}
					title={t`Then ${getPlanName(next.planId)}`}
					description={t`From ${formatDate(next.startsAt)} until ${formatDate(next.endsAt)}`}
					icon="calendar-blank"
				/>
			))}
		</ListSection>
	);
}
