import type { PlanSummary } from "./plan";
import type { BillingInterval, PaidPlanId } from "@rezumi/schema/billing";
import { Segment, TextShimmer } from "@heroui-pro/react";
import { Alert, Button, buttonVariants, Chip } from "@heroui/react";
import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { Link, useRouteContext } from "@tanstack/react-router";
import { useEffect, useId, useRef, useState } from "react";
import { PLANS } from "@rezumi/schema/billing";
import { Icon } from "@rezumi/ui/components/icon";
import { toast } from "@rezumi/ui/components/toast";
import { cn } from "@rezumi/utils/style";
import { getPlanName } from "./plan";
import {
	getPurchaseKind,
	getPurchaseLabel,
	intervalSuffix,
	isLiveSubscription,
	monthlyOfYearly,
	priceLabel,
	yearlySaving,
} from "./purchase";
import { PurchaseDialog } from "./purchase-dialog";
import { SettingsSection } from "@/features/settings/section";
import { authClient } from "@/libs/auth/client";
import { getReadableErrorMessage } from "@/libs/error-message";

const PAID_PLANS = ["plus", "pro-ai"] as const satisfies readonly PaidPlanId[];

/** What each plan adds, in three lines; numbers come from the catalog the server enforces. */
function planHighlights(planId: PaidPlanId) {
	if (planId === "pro-ai") {
		const proCredits = PLANS["pro-ai"].creditsPerMonth;
		return [t`Everything in Plus`, t`${proCredits} Rezumi AI credits every month`, t`No API key to set up`];
	}
	const { activeResumes, activeCoverLetters } = PLANS.plus.limits;
	return [
		t`${activeResumes} active resumes and ${activeCoverLetters} cover letters`,
		t`Every template, tool logos, Word and ODT downloads`,
		t`Custom styles, your own fonts, API and MCP`,
	];
}

type PurchaseStepProps = { blocker: "guest" | "email_not_verified" | "paused" };

/** What stands between the account and subscribing, and the way past it, in place of the buttons. */
function PurchaseStep({ blocker }: PurchaseStepProps) {
	const context = useRouteContext({ strict: false });
	const smtpEnabled = context.flags?.smtpEnabled ?? false;
	const email = context.session?.user.email ?? "";

	const resend = async () => {
		const { error } = await authClient.sendVerificationEmail({ email, callbackURL: "/dashboard/settings/billing" });
		toast.add(
			error
				? { type: "error", description: getReadableErrorMessage(error, t`Couldn't send the email. Try again.`) }
				: { type: "success", description: t`We sent a new verification link to ${email}.` },
		);
	};

	return (
		<Alert status={blocker === "paused" ? "warning" : "default"} className="bg-surface-secondary">
			<Alert.Indicator />
			<Alert.Content className="grid gap-2">
				{blocker === "guest" ? (
					<>
						<Alert.Title>
							<Trans>Create an account to subscribe</Trans>
						</Alert.Title>
						<Alert.Description>
							<Trans>Plans belong to an account with an email address. Your guest work moves with you.</Trans>
						</Alert.Description>
						<Link
							to="/auth/register"
							search={{ callbackURL: "/dashboard/settings/billing" }}
							className={cn(buttonVariants({ size: "sm" }), "w-fit")}
						>
							<Trans>Create an account</Trans>
						</Link>
					</>
				) : blocker === "email_not_verified" ? (
					<>
						<Alert.Title>
							<Trans>Verify your email to subscribe</Trans>
						</Alert.Title>
						<Alert.Description>
							{smtpEnabled ? (
								<Trans>Open the link we sent to {email}. Your invoices go there too.</Trans>
							) : (
								<Trans>Email delivery isn't set up on this server, so the address can't be verified.</Trans>
							)}
						</Alert.Description>
						{smtpEnabled && (
							<Button size="sm" variant="secondary" className="w-fit" onPress={() => void resend()}>
								<Trans>Resend the link</Trans>
							</Button>
						)}
					</>
				) : (
					<>
						<Alert.Title>
							<Trans>Subscribing is paused for now</Trans>
						</Alert.Title>
						<Alert.Description>
							<Trans>Try again later. Your current plan and credits aren't affected.</Trans>
						</Alert.Description>
					</>
				)}
			</Alert.Content>
		</Alert>
	);
}

type BuyPlansSectionProps = {
	plan: PlanSummary;
	/** The plan a link asked for (`?plan=`), marked and brought into view. */
	selected: PaidPlanId | undefined;
};

/**
 * The two plans, monthly or yearly, at the visitor's price, with a button that fits where the account stands:
 * subscribe, upgrade, switch interval, or switch down from the next renewal. Without a way to subscribe here (guest,
 * unverified email, paused) it explains the step instead; where plans aren't sold at all it shows nothing.
 */
export function BuyPlansSection({ plan, selected }: BuyPlansSectionProps) {
	const labelId = useId();
	const subscription = plan.subscription;
	const live = isLiveSubscription(subscription) ? subscription : null;
	const [interval, setInterval] = useState<BillingInterval>(live?.interval ?? "month");
	const [choice, setChoice] = useState<{ planId: PaidPlanId; interval: BillingInterval } | null>(null);
	const selectedRef = useRef<HTMLDivElement>(null);
	const blocker = plan.purchaseBlockedBy;
	const currency = plan.currency;
	const saving = Math.max(...PAID_PLANS.map((id) => yearlySaving(id, currency)));

	useEffect(() => {
		selectedRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
	}, [selected]);

	if (blocker === "unavailable" || blocker === "web_only") return null;

	return (
		<SettingsSection
			icon="tag"
			title={live ? <Trans>Change your plan</Trans> : <Trans>Subscribe</Trans>}
			description={
				<Trans>
					Billed monthly or yearly until you cancel. Cancel any time; you keep access until the period ends.
				</Trans>
			}
		>
			{blocker && <PurchaseStep blocker={blocker} />}
			<div className="flex flex-wrap items-center justify-between gap-2">
				<span id={labelId} className="sr-only">
					<Trans>Billing period</Trans>
				</span>
				<Segment
					aria-labelledby={labelId}
					selectedKey={interval}
					onSelectionChange={(key) => setInterval(key === "year" ? "year" : "month")}
				>
					<Segment.Item id="month" className="px-3">
						<Trans>Monthly</Trans>
					</Segment.Item>
					<Segment.Item id="year" className="px-3">
						<Trans>Yearly</Trans>
					</Segment.Item>
				</Segment>
				{saving > 0 && (
					<span className="text-xs text-muted">
						<Trans>Yearly saves up to {saving}%</Trans>
					</span>
				)}
			</div>
			<div className="grid divide-separator max-sm:divide-y sm:grid-cols-2 sm:divide-x">
				{PAID_PLANS.map((id) => {
					const target = { planId: id, interval };
					const kind = getPurchaseKind(live, target);
					const isSelected = id === selected;
					const pending = live?.pendingChange?.planId === id && live.pendingChange.interval === interval;
					return (
						<div
							key={id}
							ref={isSelected ? selectedRef : undefined}
							className={cn(
								// Columns split by a rule, no card frame: padding only on the side facing the rule.
								"flex scroll-mt-24 flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:py-0 sm:first:pe-6 sm:last:ps-6",
							)}
						>
							<div className="grid gap-0.5">
								<div className="flex items-center justify-between gap-2">
									{id === "pro-ai" ? (
										// Pro AI in its own colour: the AI mark and a purple name with a pale sweep over it.
										<h3 className="flex items-center gap-1.5 text-base font-semibold text-violet-600 dark:text-violet-400">
											<Icon name="sparkle" size={18} />
											<TextShimmer className="text-violet-300 dark:text-violet-200 [&>:first-child]:text-violet-600! dark:[&>:first-child]:text-violet-400!">
												{getPlanName(id)}
											</TextShimmer>
										</h3>
									) : (
										<h3 className="text-base font-semibold">{getPlanName(id)}</h3>
									)}
									{kind === "current" ? (
										<Chip size="sm" variant="soft" color="success">
											<Chip.Label>
												<Trans>Current</Trans>
											</Chip.Label>
										</Chip>
									) : (
										isSelected && (
											<Chip size="sm" variant="soft" color="accent">
												<Chip.Label>
													<Trans>Selected</Trans>
												</Chip.Label>
											</Chip>
										)
									)}
								</div>
								<span className="text-2xl font-semibold tracking-tight tabular-nums">
									{priceLabel(id, interval, currency)}{" "}
									<span className="text-sm font-normal text-muted">{intervalSuffix(interval)}</span>
								</span>
								<span className="text-xs text-muted">
									{interval === "year" ? (
										<Trans>{monthlyOfYearly(id, currency)} a month, billed yearly</Trans>
									) : (
										<Trans>Renews monthly until you cancel</Trans>
									)}
								</span>
							</div>
							<ul className="grid gap-2 text-sm">
								{planHighlights(id).map((line) => (
									<li key={line} className="flex gap-2">
										<Icon name="check" size={18} className="mt-0.5 shrink-0 text-muted" />
										<span>{line}</span>
									</li>
								))}
							</ul>
							{pending && (
								<p className="text-xs text-muted">
									<Trans>Starts at your next renewal.</Trans>
								</p>
							)}
							{plan.canPurchase && kind !== "current" && !pending && (
								<Button
									fullWidth
									className="mt-auto"
									variant={isSelected || (!selected && id === "pro-ai") ? "primary" : "secondary"}
									isDisabled={live?.cancelAtPeriodEnd === true || live?.status === "past_due"}
									onPress={() => setChoice(target)}
								>
									{getPurchaseLabel(kind, target, live)}
								</Button>
							)}
						</div>
					);
				})}
			</div>
			{live?.cancelAtPeriodEnd && (
				<p className="text-xs text-muted">
					<Trans>Your subscription is set to end. Keep it first to change the plan.</Trans>
				</p>
			)}
			{live?.status === "past_due" && (
				<p className="text-xs text-muted">
					<Trans>Your last payment didn't go through. Update your payment method in billing first.</Trans>
				</p>
			)}
			<p className="text-xs text-muted">
				<Trans>The checkout shows the final amount, with any tax that applies where you live.</Trans>
			</p>
			<PurchaseDialog choice={choice} subscription={live} currency={currency} onClose={() => setChoice(null)} />
		</SettingsSection>
	);
}
