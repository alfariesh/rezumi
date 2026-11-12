import type { PlanSummary } from "./plan";
import type { BillingInterval, PaidPlanId, PaymentMethod } from "@rezumi/schema/billing";
import { Segment, TextShimmer } from "@heroui-pro/react";
import { Alert, Button, buttonVariants, Chip } from "@heroui/react";
import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { Link, useRouteContext } from "@tanstack/react-router";
import { useEffect, useId, useRef, useState } from "react";
import { PAYMENT_METHOD_CURRENCY, PLANS } from "@rezumi/schema/billing";
import { Icon } from "@rezumi/ui/components/icon";
import { toast } from "@rezumi/ui/components/toast";
import { cn } from "@rezumi/utils/style";
import { getPlanName } from "./plan";
import {
	getPassKind,
	getPassLabel,
	getPurchaseKind,
	getPurchaseLabel,
	intervalSuffix,
	isLiveSubscription,
	isPaymentFailed,
	monthlyOfYearly,
	passSuffix,
	priceLabel,
	trialDaysFor,
	yearlySaving,
} from "./purchase";
import { PurchaseDialog } from "./purchase-dialog";
import { SettingsSection } from "@/features/settings/section";
import { authClient } from "@/libs/auth/client";
import { getReadableErrorMessage } from "@/libs/error-message";

const PAID_PLANS = ["plus", "pro-ai"] as const satisfies readonly PaidPlanId[];

/** What each plan adds, in three lines; numbers come from the catalog the server enforces. */
function planHighlights(planId: PaidPlanId, portfolioOpen: boolean) {
	if (planId === "pro-ai") {
		const proCredits = PLANS["pro-ai"].creditsPerMonth;
		return [t`Everything in Plus`, t`${proCredits} Rezumi AI credits every month`, t`No API key to set up`];
	}
	const { activeResumes, activeCoverLetters } = PLANS.plus.limits;
	return [
		t`${activeResumes} active resumes and ${activeCoverLetters} cover letters`,
		t`Every template, tool logos, Word and ODT downloads`,
		t`Custom styles, your own fonts, API and MCP`,
		...(portfolioOpen ? [t`Every portfolio theme, your own domain, no Rezumi badge`] : []),
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
	/** Whether portfolios are open to the account: only then do plans sell portfolio features. */
	portfolioOpen?: boolean;
};

type PaymentMethodSwitchProps = { method: PaymentMethod; onChange: (method: PaymentMethod) => void };

/** The other way to pay, for visitors from Indonesia: a card in US dollars instead of QRIS in Rupiah, or back. */
function PaymentMethodSwitch({ method, onChange }: PaymentMethodSwitchProps) {
	return (
		<p className="text-body-xs text-muted">
			{method === "qris" ? (
				<Trans>
					No QRIS app, or want it to renew on its own?{" "}
					<button
						type="button"
						className="font-medium text-foreground underline underline-offset-2"
						onClick={() => onChange("card")}
					>
						Pay by card in US dollars
					</button>
				</Trans>
			) : (
				<Trans>
					In Indonesia?{" "}
					<button
						type="button"
						className="font-medium text-foreground underline underline-offset-2"
						onClick={() => onChange("qris")}
					>
						Pay with QRIS in Rupiah
					</button>
				</Trans>
			)}
		</p>
	);
}

/**
 * The two plans at the visitor's price, with a button that fits where the account stands. By card (Dodo Payments,
 * US dollars): monthly or yearly subscriptions to subscribe to, upgrade, switch interval, or switch down from the next
 * renewal. By QRIS (Indonesia, Rupiah): 30-day or yearly passes to buy, add time to, or move up with. Visitors from
 * Indonesia see QRIS first and may switch to a card. Without a way to buy here (guest, unverified email, paused) it
 * explains the step instead; where plans aren't sold at all it shows nothing.
 */
export function BuyPlansSection({ plan, selected, portfolioOpen = false }: BuyPlansSectionProps) {
	const labelId = useId();
	const subscription = plan.subscription;
	const live = isLiveSubscription(subscription) ? subscription : null;
	const [interval, setInterval] = useState<BillingInterval>(live?.interval ?? "month");
	const [choice, setChoice] = useState<{ planId: PaidPlanId; interval: BillingInterval } | null>(null);
	const [picked, setPicked] = useState<PaymentMethod | null>(null);
	const selectedRef = useRef<HTMLDivElement>(null);
	const blocker = plan.purchaseBlockedBy;
	const methods = plan.paymentMethods;
	// The way the visitor picked while it is still offered; else the default.
	const method: PaymentMethod = picked && methods.includes(picked) ? picked : (methods[0] ?? "card");
	const qris = method === "qris";
	const currency = PAYMENT_METHOD_CURRENCY[method];
	const saving = Math.max(...PAID_PLANS.map((id) => yearlySaving(id, currency)));

	useEffect(() => {
		selectedRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
	}, [selected]);

	if (blocker === "unavailable" || blocker === "web_only") return null;

	return (
		<SettingsSection
			icon="tag"
			title={
				qris ? (
					plan.planId === "free" ? (
						<Trans>Get a plan</Trans>
					) : (
						<Trans>Add time or upgrade</Trans>
					)
				) : live ? (
					<Trans>Change your plan</Trans>
				) : (
					<Trans>Subscribe</Trans>
				)
			}
			description={
				qris ? (
					<Trans>
						Pay once with QRIS from any bank or e-wallet app. A plan lasts 30 days or a year and doesn't renew on its
						own: pay again whenever you like, and the time is added after your current plan.
					</Trans>
				) : (
					<Trans>
						Billed monthly or yearly until you cancel. Cancel any time; you keep access until the period ends.
					</Trans>
				)
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
						{qris ? <Trans>30 days</Trans> : <Trans>Monthly</Trans>}
					</Segment.Item>
					<Segment.Item id="year" className="px-3">
						{qris ? <Trans>1 year</Trans> : <Trans>Yearly</Trans>}
					</Segment.Item>
				</Segment>
				{saving > 0 && (
					<span className="text-body-xs text-muted">
						<Trans>Yearly saves up to {saving}%</Trans>
					</span>
				)}
			</div>
			<div className="grid divide-separator max-sm:divide-y sm:grid-cols-2 sm:divide-x">
				{PAID_PLANS.map((id) => {
					const target = { planId: id, interval };
					const kind = getPurchaseKind(live, target);
					const passKind = getPassKind(plan.planId, id);
					const current = qris ? plan.planId === id : kind === "current";
					const isSelected = id === selected;
					const pending = !qris && live?.pendingChange?.planId === id && live.pendingChange.interval === interval;
					const trialDays = !qris && kind === "subscribe" ? trialDaysFor(id, plan.trialAvailable) : null;
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
									{current ? (
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
									<span className="text-sm font-normal text-muted">
										{qris ? passSuffix(interval) : intervalSuffix(interval)}
									</span>
								</span>
								<span className="text-xs text-muted">
									{qris ? (
										interval === "year" ? (
											<Trans>{monthlyOfYearly(id, currency)} a month, paid once for 365 days</Trans>
										) : (
											<Trans>Paid once; doesn't renew on its own</Trans>
										)
									) : interval === "year" ? (
										<Trans>{monthlyOfYearly(id, currency)} a month, billed yearly</Trans>
									) : (
										<Trans>Renews monthly until you cancel</Trans>
									)}
								</span>
								{trialDays && (
									<span className="text-xs font-medium text-success">
										<Trans>First {trialDays} days free</Trans>
									</span>
								)}
							</div>
							<ul className="grid gap-2 text-sm">
								{planHighlights(id, portfolioOpen).map((line) => (
									<li key={line} className="flex gap-2">
										<Icon name="check" size={18} className="mt-0.5 shrink-0 text-muted" />
										<span>{line}</span>
									</li>
								))}
							</ul>
							{pending && (
								<p className="text-body-xs text-muted">
									<Trans>Starts at your next renewal.</Trans>
								</p>
							)}
							{plan.canPurchase && qris && (
								<Button
									fullWidth
									className="mt-auto"
									variant={isSelected || (!selected && id === "pro-ai") ? "primary" : "secondary"}
									onPress={() => setChoice(target)}
								>
									{getPassLabel(passKind, target)}
								</Button>
							)}
							{plan.canPurchase && !qris && kind !== "current" && !pending && (
								<Button
									fullWidth
									className="mt-auto"
									variant={isSelected || (!selected && id === "pro-ai") ? "primary" : "secondary"}
									isDisabled={live?.cancelAtPeriodEnd === true || isPaymentFailed(live)}
									onPress={() => setChoice(target)}
								>
									{getPurchaseLabel(kind, target, live, trialDays)}
								</Button>
							)}
						</div>
					);
				})}
			</div>
			{!qris && live?.cancelAtPeriodEnd && (
				<p className="text-body-xs text-muted">
					<Trans>Your subscription is set to end. Keep it first to change the plan.</Trans>
				</p>
			)}
			{!qris && isPaymentFailed(live) && (
				<p className="text-body-xs text-muted">
					<Trans>Your last payment didn't go through. Update your payment method in billing first.</Trans>
				</p>
			)}
			<p className="text-body-xs text-muted">
				{qris ? (
					<Trans>Prices are final: no tax is added.</Trans>
				) : (
					<Trans>Prices are before tax: the checkout adds the tax that applies where you live.</Trans>
				)}
			</p>
			{methods.length > 1 && <PaymentMethodSwitch method={method} onChange={setPicked} />}
			<PurchaseDialog
				choice={choice}
				method={method}
				currentPlanId={plan.planId}
				subscription={live}
				currency={currency}
				trialAvailable={plan.trialAvailable}
				onClose={() => setChoice(null)}
			/>
		</SettingsSection>
	);
}
