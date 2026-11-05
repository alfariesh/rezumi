import type { Subscription } from "./purchase";
import type { BillingCurrency, BillingInterval, PaidPlanId } from "@rezumi/schema/billing";
import type { ReactNode } from "react";
import { Alert, Button, Drawer, Spinner } from "@heroui/react";
import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { ORPCError } from "@orpc/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useId, useRef, useState } from "react";
import { BILLING_SELLER, LEGAL_URLS, PLANS } from "@rezumi/schema/billing";
import { Icon } from "@rezumi/ui/components/icon";
import { toast } from "@rezumi/ui/components/toast";
import { useBreakpoint } from "@rezumi/ui/hooks/use-breakpoint";
import { creditCount } from "./credits";
import { getPlanName } from "./plan";
import { getPurchaseKind, getPurchaseLabel, intervalSuffix, priceLabel, trialDaysFor, usePlanDates } from "./purchase";
import { orpc } from "@/libs/orpc/client";

/** Why a checkout or plan change didn't go through, in the user's words; the server's messages aren't translated. */
function purchaseErrorMessage(error: unknown) {
	const code = error instanceof ORPCError ? error.code : null;
	if (code === "EMAIL_NOT_VERIFIED") return t`Verify your email address first, then try again.`;
	if (code === "BILLING_UNAVAILABLE") return t`Subscribing isn't available right now. Try again later.`;
	if (code === "TOO_MANY_REQUESTS") return t`Too many tries in a row. Wait a few minutes, then try again.`;
	if (code === "PAYMENT_FAILED")
		return t`The payment for this change didn't go through. Update your payment method in billing and try again.`;
	if (code === "CONFLICT") return t`Your plan changed in the meantime. Reload the page and try again.`;
	return t`The checkout couldn't be opened. Try again in a moment.`;
}

type LegalLinkProps = { href: string; children: ReactNode };

function LegalLink({ href, children }: LegalLinkProps) {
	return (
		<a
			href={href}
			target="_blank"
			rel="noopener noreferrer"
			className="underline underline-offset-2 hover:text-foreground"
		>
			{children}
		</a>
	);
}

type PurchaseDialogProps = {
	/** The plan and interval chosen; null keeps the dialog closed. */
	choice: { planId: PaidPlanId; interval: BillingInterval } | null;
	/** The account's live subscription: present, a choice changes it instead of starting a new one. */
	subscription: Subscription | null;
	currency: BillingCurrency;
	/** Whether a new subscription starts with its plan's free trial (`summary.trialAvailable`). */
	trialAvailable: boolean;
	onClose: () => void;
};

/**
 * Confirms a subscription or a plan change, in a drawer (right on desktop, from the bottom on phones): the plan, its
 * price and how often it renews, what changes when, the refund policy in brief and the terms it agrees to. A new
 * subscription continues on Polar's checkout page; a change is made here at once.
 */
export function PurchaseDialog({ choice, subscription, currency, trialAvailable, onClose }: PurchaseDialogProps) {
	const queryClient = useQueryClient();
	const { formatDate } = usePlanDates();
	const descriptionId = useId();
	const breakpoint = useBreakpoint();
	const target = choice ?? { planId: "plus" as const, interval: "month" as const };
	const kind = getPurchaseKind(subscription, target);
	// The same plan, billed monthly instead of yearly or the other way round.
	const billingOnly = subscription?.planId === target.planId;
	const trialDays = kind === "subscribe" ? trialDaysFor(target.planId, trialAvailable) : null;
	// An upgrade ends a running free trial: the new plan has none (Polar starts its billing at once).
	const endsTrial = kind === "upgrade" && subscription?.status === "trialing";
	// One key per attempt: a double click or a retried request returns the same checkout instead of a second one.
	const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());
	const [redirecting, setRedirecting] = useState(false);
	const checkout = useMutation(orpc.billing.checkout.mutationOptions({ meta: { noInvalidate: true } }));
	const change = useMutation(orpc.billing.changePlan.mutationOptions({ meta: { noInvalidate: true } }));
	const busy = checkout.isPending || change.isPending || redirecting;
	const error = checkout.error ?? change.error;
	// A second click can land before the button re-renders as busy; this stops it from sending a second request.
	const started = useRef(false);

	useEffect(() => {
		// Back from Polar, the browser can restore this page as it was left: still on its way out.
		const restore = (event: PageTransitionEvent) => {
			if (!event.persisted) return;
			started.current = false;
			setRedirecting(false);
		};
		window.addEventListener("pageshow", restore);
		return () => window.removeEventListener("pageshow", restore);
	}, []);

	const reset = () => {
		started.current = false;
		checkout.reset();
		change.reset();
		setIdempotencyKey(crypto.randomUUID());
	};

	const confirm = () => {
		if (started.current) return;
		started.current = true;
		if (kind === "subscribe") {
			checkout.mutate(
				{ planId: target.planId, interval: target.interval, idempotencyKey },
				{
					onSuccess: ({ redirectUrl }) => {
						setRedirecting(true);
						window.location.assign(redirectUrl);
					},
					onError: () => {
						started.current = false;
						setIdempotencyKey(crypto.randomUUID());
					},
				},
			);
			return;
		}
		change.mutate(
			{ planId: target.planId, interval: target.interval },
			{
				onSuccess: ({ effective }) => {
					void queryClient.invalidateQueries({ queryKey: orpc.billing.key() });
					toast.add({
						type: "success",
						description:
							effective !== "now"
								? t`Your plan changes at your next renewal.`
								: billingOnly
									? t`You're now billed yearly.`
									: t`Your plan is now ${getPlanName(target.planId)}.`,
					});
					reset();
					onClose();
				},
				onError: () => {
					started.current = false;
				},
			},
		);
	};

	const close = () => {
		if (busy) return;
		reset();
		onClose();
	};

	const name = getPlanName(target.planId);
	const currentName = subscription ? getPlanName(subscription.planId) : name;
	const price = priceLabel(target.planId, target.interval, currency);
	const credits = PLANS[target.planId].creditsPerMonth;
	const renewal = subscription?.currentPeriodEnd ? formatDate(subscription.currentPeriodEnd) : null;
	// Desktop slides in from the right; phones and tablets get a bottom sheet.
	const placement = breakpoint === "mobile" || breakpoint === "tablet" ? "bottom" : "right";

	return (
		<Drawer.Backdrop isOpen={choice !== null} onOpenChange={(open) => !open && close()}>
			<Drawer.Content placement={placement}>
				<Drawer.Dialog aria-describedby={descriptionId}>
					{placement === "bottom" && <Drawer.Handle />}
					<Drawer.CloseTrigger aria-label={t`Close`} />
					<Drawer.Header>
						<Drawer.Heading>{getPurchaseLabel(kind, target, subscription, trialDays)}</Drawer.Heading>
					</Drawer.Header>
					<Drawer.Body className="grid content-start gap-5 text-sm">
						<div id={descriptionId} className="grid gap-1">
							<p className="flex items-baseline justify-between gap-3">
								<span className="font-medium">
									{name} · {target.interval === "year" ? <Trans>Yearly</Trans> : <Trans>Monthly</Trans>}
								</span>
								<span className="text-2xl font-semibold tracking-tight tabular-nums">
									{price} <span className="text-sm font-normal text-muted">{intervalSuffix(target.interval)}</span>
								</span>
							</p>
							<p className="text-muted">
								{trialDays ? (
									target.interval === "year" ? (
										<Trans>Free for {trialDays} days, then renews every year until you cancel.</Trans>
									) : (
										<Trans>Free for {trialDays} days, then renews every month until you cancel.</Trans>
									)
								) : target.interval === "year" ? (
									<Trans>Renews every year until you cancel.</Trans>
								) : (
									<Trans>Renews every month until you cancel.</Trans>
								)}
							</p>
							<p className="text-xs text-muted">
								<Trans>Prices are before tax: Polar adds the tax that applies where you live.</Trans>
							</p>
						</div>

						<ul className="grid gap-2">
							{kind === "subscribe" && trialDays ? (
								<li className="flex gap-2">
									<Icon name="calendar-blank" size={18} className="mt-0.5 shrink-0 text-muted" />
									<span>
										<Trans>
											Add a card, Apple Pay or Google Pay on Polar's secure checkout. Nothing is charged today: the
											first charge comes after {trialDays} days, and cancelling before then costs nothing.
										</Trans>
									</span>
								</li>
							) : kind === "subscribe" ? (
								<li className="flex gap-2">
									<Icon name="lock" size={18} className="mt-0.5 shrink-0 text-muted" />
									<span>
										<Trans>
											Pay on Polar's secure checkout with a card, Apple Pay or Google Pay. {name} starts as soon as the
											payment goes through.
										</Trans>
									</span>
								</li>
							) : kind === "upgrade" ? (
								<li className="flex gap-2">
									<Icon name="lightning" size={18} className="mt-0.5 shrink-0 text-muted" />
									<span>
										{endsTrial ? (
											billingOnly ? (
												<Trans>
													Your free trial ends now. Your saved payment method is charged today for this month, then the
													difference for yearly billing; after that, the yearly price at each renewal.
												</Trans>
											) : (
												<Trans>
													Your free trial ends now. Your saved payment method is charged today for this month of{" "}
													{currentName}, then the difference for {name}; after that, {name}'s price at each renewal.
												</Trans>
											)
										) : billingOnly ? (
											<Trans>
												Yearly billing starts now. You're charged the difference for the rest of this period with your
												saved payment method, then the yearly price at each renewal.
											</Trans>
										) : (
											<Trans>
												{name} starts now. You're charged the difference for the rest of this period with your saved
												payment method, then the new price at each renewal.
											</Trans>
										)}
									</span>
								</li>
							) : billingOnly ? (
								<li className="flex gap-2">
									<Icon name="calendar-blank" size={18} className="mt-0.5 shrink-0 text-muted" />
									<span>
										{renewal ? (
											<Trans>
												Yearly billing stays until {renewal}; monthly billing starts then. Nothing is charged now.
											</Trans>
										) : (
											<Trans>
												Yearly billing stays until your next renewal; monthly billing starts then. Nothing is charged
												now.
											</Trans>
										)}
									</span>
								</li>
							) : (
								<li className="flex gap-2">
									<Icon name="calendar-blank" size={18} className="mt-0.5 shrink-0 text-muted" />
									<span>
										{renewal ? (
											<Trans>
												Your current plan stays until {renewal}; {name} starts then, at the new price. Nothing is
												charged now.
											</Trans>
										) : (
											<Trans>
												Your current plan stays until your next renewal; {name} starts then. Nothing is charged now.
											</Trans>
										)}
									</span>
								</li>
							)}
							{credits > 0 && (
								<li className="flex gap-2">
									<Icon name="sparkle" size={18} className="mt-0.5 shrink-0 text-muted" />
									<span>
										<Trans>
											{creditCount(credits)} for Rezumi AI every month. Credits left at the end of a month don't carry
											over.
										</Trans>
									</span>
								</li>
							)}
							<li className="flex gap-2">
								<Icon name="x-circle" size={18} className="mt-0.5 shrink-0 text-muted" />
								<span>
									<Trans>
										Cancel any time from your plan page. You keep access until the end of the period you paid for.
									</Trans>
								</span>
							</li>
						</ul>

						<p className="text-muted">
							<Trans>
								Within 7 days of your first charge you can ask for a full refund if you used no more than 10 Rezumi AI
								credits from it. Double payments and technical problems are always sorted out.
							</Trans>
						</p>

						{error && (
							<Alert status="danger">
								<Alert.Indicator>
									<Icon name="warning-circle" />
								</Alert.Indicator>
								<Alert.Content>
									<Alert.Description>{purchaseErrorMessage(error)}</Alert.Description>
								</Alert.Content>
							</Alert>
						)}

						<p className="text-xs text-muted">
							<Trans>
								{BILLING_SELLER.merchantOfRecord} sells the subscription as the merchant of record and handles payment,
								invoices and tax. By continuing, you agree to the{" "}
								<LegalLink href={LEGAL_URLS.terms}>Terms of service</LegalLink> and the{" "}
								<LegalLink href={LEGAL_URLS.refund}>Refund policy</LegalLink>.
							</Trans>
						</p>
					</Drawer.Body>
					<Drawer.Footer>
						<Button variant="tertiary" isDisabled={busy} onPress={close}>
							<Trans>Cancel</Trans>
						</Button>
						<Button className="flex-1" isPending={busy} onPress={confirm}>
							{busy && <Spinner size="sm" color="current" aria-hidden />}
							{kind === "subscribe" && trialDays ? (
								<Trans>Start free trial</Trans>
							) : kind === "subscribe" ? (
								<Trans>Continue to checkout</Trans>
							) : kind === "upgrade" ? (
								<Trans>Upgrade now</Trans>
							) : (
								<Trans>Change at renewal</Trans>
							)}
						</Button>
					</Drawer.Footer>
				</Drawer.Dialog>
			</Drawer.Content>
		</Drawer.Backdrop>
	);
}
