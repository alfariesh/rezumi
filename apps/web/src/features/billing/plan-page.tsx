import type { PlanFeature, PlanSummary } from "./plan";
import type { PaidPlanId, PlanId } from "@rezumi/schema/billing";
import type { IconName } from "@rezumi/ui/components/icon";
import type { ReactNode } from "react";
import { TextShimmer, Widget } from "@heroui-pro/react";
import { ProgressCircle, Skeleton } from "@heroui/react";
import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { useQuery } from "@tanstack/react-query";
import { useId } from "react";
import { DOCUMENT_PLAN_FEATURE_KEYS, PLAN_FEATURE_KEYS, TRIAL_CREDITS } from "@rezumi/schema/billing";
import { Icon } from "@rezumi/ui/components/icon";
import { cn } from "@rezumi/utils/style";
import { BuyPlansSection } from "./buy-plans";
import { creditCount, describeCreditEntry } from "./credits";
import { PaymentHistorySection } from "./payment-history";
import { PendingPaymentBanner } from "./pending-payment";
import { getPlanName } from "./plan";
import { isLiveSubscription, usePlanDates } from "./purchase";
import { SubscriptionActions } from "./subscription-actions";
import { PageHeader } from "@/components/layout/page-header";
import { WidgetHeading, widgetActionClass } from "@/components/layout/widget-heading";
import { SettingsRow, SettingsRows, SettingsSection } from "@/features/settings/section";
import { orpc } from "@/libs/orpc/client";

const featureCopy = (): Record<PlanFeature, { icon: IconName; label: string }> => ({
	premiumTemplates: { icon: "squares-four", label: t`Every template` },
	brandLogos: { icon: "code", label: t`Tool logos in skills` },
	wordOdtExport: { icon: "file-doc", label: t`Word and ODT downloads` },
	customStyles: { icon: "palette", label: t`Custom styles` },
	customFonts: { icon: "text-aa", label: t`Your own fonts` },
	automationApi: { icon: "plugs-connected", label: t`API and MCP for other apps` },
	premiumPortfolioThemes: { icon: "squares-four", label: t`Every portfolio theme` },
	premiumHeroEffects: { icon: "sparkle", label: t`Every portfolio intro effect` },
	hidePortfolioCredit: { icon: "seal-check", label: t`Hide the Made with Rezumi badge` },
	customDomain: { icon: "globe", label: t`Your own domain` },
	detailedPortfolioStats: { icon: "chart-line-up", label: t`Detailed portfolio statistics` },
});

type UsageRowProps = { icon: IconName; label: string; usage: PlanSummary["limits"]["activeResumes"] };

function UsageRow({ icon, label, usage }: UsageRowProps) {
	const max = usage.max ?? usage.used;
	return (
		<SettingsRow
			inline
			icon={icon}
			title={label}
			description={usage.max === null ? t`${usage.used} in use` : t`${usage.used} of ${usage.max}`}
		>
			{usage.max !== null && (
				<ProgressCircle aria-label={label} value={Math.min(usage.used, max)} maxValue={Math.max(max, 1)} size="lg">
					<ProgressCircle.Track>
						<ProgressCircle.TrackCircle />
						<ProgressCircle.FillCircle />
					</ProgressCircle.Track>
				</ProgressCircle>
			)}
		</SettingsRow>
	);
}

// Free keeps the quiet settings frame; paid plans get a coloured frame over frosted, shadowless content.
// Free keeps the quiet settings frame. Paid plans get a coloured frame and frosted, shadowless content whose text is
// white, so the colour shows through the glass.
const glass =
	"bg-black/15 text-white shadow-none ring-1 ring-white/20 backdrop-blur-xl [&_.bg-default]:bg-white/15 [&_.text-muted]:text-white/90 [&_li]:before:bg-white/20";
const planFrame: Record<PlanId, { frame: string; content: string; title: string }> = {
	free: { frame: "", content: "", title: "" },
	plus: { frame: "bg-linear-to-br from-blue-600 to-blue-800", content: glass, title: "text-white" },
	"pro-ai": {
		frame: "bg-linear-to-br from-violet-800 via-purple-700 to-blue-700",
		content: glass,
		title: "text-white",
	},
};

type PlanStretchRowProps = { icon: IconName; title: ReactNode; description: ReactNode };

/** One stretch of a paid plan, now or queued, at headline size in white on the coloured frame. */
function PlanStretchRow({ icon, title, description }: PlanStretchRowProps) {
	return (
		<div className="flex items-center gap-3">
			<span className="grid size-12 shrink-0 place-items-center rounded-xl bg-white/20 ring-1 ring-white/30">
				<Icon name={icon} size={24} />
			</span>
			<div className="grid min-w-0 gap-0.5">
				<span className="text-2xl font-semibold tracking-tight break-words text-white">{title}</span>
				<span className="text-sm break-words text-white/90">{description}</span>
			</div>
		</div>
	);
}

type YourPlanSectionProps = { plan: PlanSummary; formatDate: (date: Date) => string };

/** The plan the account has now, until when, and what comes next; paid plans in their own colours. */
function YourPlanSection({ plan, formatDate }: YourPlanSectionProps) {
	const titleId = useId();
	const style = planFrame[plan.planId];
	const paid = plan.planId !== "free";
	const subscription =
		plan.source === "subscription" && isLiveSubscription(plan.subscription) ? plan.subscription : null;
	const pending = subscription?.pendingChange;
	const activeUntil = !plan.currentPeriodEndsAt ? (
		<Trans>No end date</Trans>
	) : subscription?.status === "past_due" ? (
		<Trans>
			The last payment didn't go through. Update your payment method to keep it; access is paused until then.
		</Trans>
	) : subscription?.status === "trialing" ? (
		plan.renews ? (
			<Trans>Free trial until {formatDate(plan.currentPeriodEndsAt)}; the first charge is made then</Trans>
		) : (
			<Trans>Free trial, cancelled: ends on {formatDate(plan.currentPeriodEndsAt)} with nothing charged</Trans>
		)
	) : plan.renews ? (
		pending ? (
			<Trans>
				Changes to {getPlanName(pending.planId)} on {formatDate(plan.currentPeriodEndsAt)}
			</Trans>
		) : subscription?.interval === "year" ? (
			<Trans>Renews yearly on {formatDate(plan.currentPeriodEndsAt)}</Trans>
		) : (
			<Trans>Renews monthly on {formatDate(plan.currentPeriodEndsAt)}</Trans>
		)
	) : subscription ? (
		<Trans>Cancelled; active until {formatDate(plan.currentPeriodEndsAt)}</Trans>
	) : (
		<Trans>Active until {formatDate(plan.currentPeriodEndsAt)}</Trans>
	);

	return (
		<Widget role="region" aria-labelledby={titleId} className={cn("relative overflow-hidden", style.frame)}>
			{paid && (
				// Soft light behind the frosted content, so the glass has something to blur.
				<span
					aria-hidden
					className="pointer-events-none absolute -top-16 -right-10 size-56 rounded-full bg-fuchsia-400/30 blur-3xl"
				/>
			)}
			<WidgetHeading id={titleId} icon="seal-check" title={<Trans>Your plan</Trans>} titleClassName={style.title} />
			<Widget.Content className={cn("relative grid gap-4", style.content)}>
				{paid ? (
					<div className="grid gap-6 [&>*+*]:relative [&>*+*]:before:absolute [&>*+*]:before:inset-s-15 [&>*+*]:before:inset-e-0 [&>*+*]:before:-top-3 [&>*+*]:before:h-px [&>*+*]:before:bg-white/20">
						<PlanStretchRow
							icon={plan.planId === "pro-ai" ? "sparkle" : "seal-check"}
							title={
								// Solid white text; the sweep is a pale tint over it (TextShimmer alone fades the text to 45%).
								<TextShimmer className="text-fuchsia-200 [&>:first-child]:text-white!">
									{getPlanName(plan.planId)}
								</TextShimmer>
							}
							description={activeUntil}
						/>
						{plan.upcoming.map((next) => (
							<PlanStretchRow
								key={`${next.planId}-${next.startsAt.toISOString()}`}
								icon="calendar-blank"
								title={<Trans>Then {getPlanName(next.planId)}</Trans>}
								description={
									<Trans>
										From {formatDate(next.startsAt)} until {formatDate(next.endsAt)}
									</Trans>
								}
							/>
						))}
					</div>
				) : (
					<>
						<SettingsRow icon="seal-check" title={getPlanName(plan.planId)} description={activeUntil} />
						{plan.upcoming.length > 0 && (
							<SettingsRows>
								{plan.upcoming.map((next) => (
									<SettingsRow
										as="li"
										key={`${next.planId}-${next.startsAt.toISOString()}`}
										icon="calendar-blank"
										title={<Trans>Then {getPlanName(next.planId)}</Trans>}
										description={
											<Trans>
												From {formatDate(next.startsAt)} until {formatDate(next.endsAt)}
											</Trans>
										}
									/>
								))}
							</SettingsRows>
						)}
					</>
				)}
			</Widget.Content>
		</Widget>
	);
}

type CreditsSectionProps = {
	credits: NonNullable<PlanSummary["credits"]>;
	formatDate: (date: Date) => string;
	formatDay: (date: Date) => string;
};

/** Rezumi AI credits: the balance, the soonest expiry, the trial still to come, and the latest activity. */
function CreditsSection({ credits, formatDate, formatDay }: CreditsSectionProps) {
	const { data: history } = useQuery(orpc.billing.creditHistory.queryOptions({ input: { limit: 5 } }));
	const { nextExpiry, trial } = credits;

	return (
		<div className="grid gap-2">
			<SettingsSection icon="lightning" title={<Trans>Rezumi AI credits</Trans>}>
				<SettingsRows>
					<SettingsRow
						as="li"
						icon="sparkle"
						title={creditCount(credits.balance)}
						description={
							nextExpiry ? (
								<Trans>
									{creditCount(nextExpiry.credits)} expire on {formatDate(nextExpiry.at)}
								</Trans>
							) : (
								<Trans>No credits to spend right now</Trans>
							)
						}
					/>
					{trial.available && (
						<SettingsRow
							as="li"
							icon="star"
							title={<Trans>Trial credits</Trans>}
							description={
								<Trans>
									{creditCount(TRIAL_CREDITS.amount)} come with your first use of Rezumi AI, valid for{" "}
									{TRIAL_CREDITS.validDays} days.
								</Trans>
							}
						/>
					)}
				</SettingsRows>

				<h3 className="mt-2 text-sm font-medium">
					<Trans>Recent activity</Trans>
				</h3>
				{!history ? (
					<Skeleton className="h-12 rounded-xl" />
				) : history.items.length === 0 ? (
					<p className="text-sm text-muted">
						<Trans>No credit activity yet.</Trans>
					</p>
				) : (
					<SettingsRows>
						{history.items.map((entry) => {
							const line = describeCreditEntry(entry, formatDay);
							return (
								<SettingsRow
									as="li"
									inline
									key={entry.id}
									icon={line.icon}
									title={line.title}
									description={line.detail}
								>
									<span className="text-sm font-medium tabular-nums">{line.amount}</span>
								</SettingsRow>
							);
						})}
					</SettingsRows>
				)}
			</SettingsSection>
			<p className="px-1 text-sm text-muted">
				<Trans>
					Credits are used soonest-expiring first. They can't be moved to another account or exchanged for money. Your
					own AI connection never uses credits.
				</Trans>
			</p>
		</div>
	);
}

type PlanSettingsProps = {
	/** The plan a link asked for (`?plan=`): an upgrade prompt, the credits dialog or the landing page's pricing. */
	selectedPlan?: PaidPlanId | undefined;
};

/**
 * Plan: a checkout still to finish, what the account has now, when it renews or ends and what comes next, the plans to
 * subscribe to or change to, how much of its limits it uses, its Rezumi AI credits, what's included and its payments.
 * Subscribing happens on the web only.
 */
export function PlanSettings({ selectedPlan }: PlanSettingsProps) {
	const { data: plan, isPending } = useQuery(orpc.billing.summary.queryOptions());
	const { data: portfolioStatus } = useQuery(orpc.portfolio.status.queryOptions());
	const { formatDate, formatDay } = usePlanDates();

	if (isPending) return <Skeleton role="status" aria-label={t`Loading your plan…`} className="h-64 rounded-2xl" />;

	if (!plan?.enabled)
		return (
			<>
				<PageHeader title={<Trans>Plan</Trans>} />
				<SettingsSection icon="seal-check" title={<Trans>Your plan</Trans>}>
					<p className="text-sm text-muted">
						<Trans>Plans don't apply to your account yet, so everything is open.</Trans>
					</p>
				</SettingsSection>
			</>
		);

	const features = featureCopy();
	const listedFeatures = portfolioStatus?.enabled ? PLAN_FEATURE_KEYS : DOCUMENT_PLAN_FEATURE_KEYS;

	return (
		<>
			<PageHeader title={<Trans>Plan</Trans>} />

			{plan.pendingPayment && <PendingPaymentBanner payment={plan.pendingPayment} formatDate={formatDate} />}

			<div className="grid gap-2">
				<YourPlanSection plan={plan} formatDate={formatDate} />
				<SubscriptionActions
					subscription={plan.subscription}
					formatDate={formatDate}
					canManage={plan.purchaseBlockedBy !== "unavailable" && plan.purchaseBlockedBy !== "web_only"}
				/>
				<p className="px-1 text-sm text-muted">
					<Trans>
						When a plan ends, nothing is locked or deleted: every document stays open to edit, share and download as a
						PDF.
					</Trans>
				</p>
			</div>

			<BuyPlansSection plan={plan} selected={selectedPlan} portfolioOpen={portfolioStatus?.enabled === true} />

			<SettingsSection
				icon="file-text"
				divided
				title={<Trans>Documents</Trans>}
				description={<Trans>Documents in Trash don't count.</Trans>}
			>
				<UsageRow icon="file-text" label={t`Active resumes`} usage={plan.limits.activeResumes} />
				<UsageRow icon="envelope-simple" label={t`Active cover letters`} usage={plan.limits.activeCoverLetters} />
			</SettingsSection>

			{plan.credits && <CreditsSection credits={plan.credits} formatDate={formatDate} formatDay={formatDay} />}

			<SettingsSection
				icon="list-checks"
				title={<Trans>What's included</Trans>}
				action={
					<a href="/#pricing" className={widgetActionClass}>
						<Trans>Compare plans</Trans>
					</a>
				}
			>
				{/* Plain icons, no tiles; rules start under the text (20px icon + 12px gap). */}
				<ul className="grid gap-4 [&>*+*]:relative [&>*+*]:before:absolute [&>*+*]:before:inset-s-8 [&>*+*]:before:inset-e-0 [&>*+*]:before:-top-2 [&>*+*]:before:h-px [&>*+*]:before:bg-separator">
					{listedFeatures.map((feature) => {
						const included = plan.features[feature];
						return (
							<li key={feature} className="flex items-center gap-3 py-0.5 text-sm">
								<Icon name={features[feature].icon} size={20} className="text-muted" />
								<span className="flex-1">{features[feature].label}</span>
								<span className={included ? "text-success" : "text-muted"}>
									<Icon name={included ? "check" : "lock"} size={18} aria-hidden />
									<span className="sr-only">{included ? t`Included` : t`Not included`}</span>
								</span>
							</li>
						);
					})}
				</ul>
			</SettingsSection>

			<PaymentHistorySection formatDay={formatDay} />
		</>
	);
}
