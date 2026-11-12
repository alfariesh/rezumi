import type { PaymentDetail, ReturnState } from "./purchase";
import type { IconName } from "@rezumi/ui/components/icon";
import type { ReactNode } from "react";
import { Button, buttonVariants, Skeleton, Spinner, Typography } from "@heroui/react";
import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { ORPCError } from "@orpc/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { billingCurrencySchema } from "@rezumi/schema/billing";
import { Icon } from "@rezumi/ui/components/icon";
import { cn } from "@rezumi/utils/style";
import { BackToPlanLink } from "./back-link";
import { creditCount } from "./credits";
import { InvoiceButton } from "./invoice-button";
import { getPlanName } from "./plan";
import {
	formatPrice,
	getReturnState,
	hasInvoice,
	hasReceipt,
	intervalSuffix,
	isOpenPayment,
	isTrialStart,
	priceLabel,
	usePlanDates,
} from "./purchase";
import { ReceiptLink } from "./receipt-link";
import { PageHeader } from "@/components/layout/page-header";
import { orpc } from "@/libs/orpc/client";
import { renderAsH2 } from "@/libs/typography";

/** How often the page asks where an open payment stands, and for how long before it waits for a click. */
const POLL_EVERY_MS = 3000;
const POLL_FOR_MS = 2 * 60 * 1000;

type ResultCardProps = { icon: IconName; tone: string; title: ReactNode; children: ReactNode };

function ResultCard({ icon, tone, title, children }: ResultCardProps) {
	return (
		<section aria-live="polite" className="grid justify-items-start gap-4 rounded-3xl bg-surface p-6 shadow-surface">
			<span className={cn("grid size-12 place-items-center rounded-2xl", tone)}>
				<Icon name={icon} size={26} />
			</span>
			<Typography type="h4" render={renderAsH2}>
				{title}
			</Typography>
			{children}
		</section>
	);
}

type ResultProps = { payment: PaymentDetail; state: ReturnState; formatDate: (date: Date) => string };

/** A trial's $0 start: what was taken (a card, no money), and when the first charge comes. */
function TrialResult({ payment, formatDate }: Omit<ResultProps, "state">) {
	const plan = getPlanName(payment.planId);
	const price = payment.interval
		? `${priceLabel(payment.planId, payment.interval, billingCurrencySchema.catch("usd").parse(payment.currency))} ${intervalSuffix(payment.interval)}`
		: null;
	return (
		<ResultCard
			icon="check-circle"
			tone="bg-success/15 text-success"
			title={<Trans>Your free trial has started</Trans>}
		>
			<ul className="grid gap-1.5 text-sm">
				<li>
					{payment.periodEnd && price ? (
						<Trans>
							{plan} is free until {formatDate(payment.periodEnd)}. Then your card is charged {price} plus tax, unless
							you cancel before.
						</Trans>
					) : (
						<Trans>{plan} is active, free for now.</Trans>
					)}
				</li>
				<li className="text-muted">
					<Trans>Dodo Payments emails you a reminder a few days before the first charge.</Trans>
				</li>
			</ul>
			<div className="flex flex-wrap gap-2">
				<Link to="/dashboard/settings/billing" className={buttonVariants()}>
					<Trans>Go to your plan</Trans>
				</Link>
			</div>
		</ResultCard>
	);
}

/** A paid QRIS pass: when it runs (now, or after the current plan), its credits, and its receipt. */
function PassResult({ payment, formatDate }: Omit<ResultProps, "state">) {
	const plan = getPlanName(payment.planId);
	// Waiting behind the current plan: it starts in the future. (Sumopod's paid time can be a little earlier than the
	// moment the pass was granted, so it isn't the measure.) The time is read once, when the result first shows.
	const [shownAt] = useState(() => Date.now());
	const startsLater = payment.periodStart !== null && +payment.periodStart > shownAt;
	return (
		<ResultCard icon="check-circle" tone="bg-success/15 text-success" title={<Trans>Payment received</Trans>}>
			<ul className="grid gap-1.5 text-sm">
				<li>
					{payment.periodStart && payment.periodEnd && startsLater ? (
						<Trans>
							{plan} starts on {formatDate(payment.periodStart)}, after your current plan, and runs until{" "}
							{formatDate(payment.periodEnd)}.
						</Trans>
					) : payment.periodEnd ? (
						<Trans>
							{plan} is active until {formatDate(payment.periodEnd)}. It doesn't renew on its own.
						</Trans>
					) : (
						<Trans>{plan} is active.</Trans>
					)}
				</li>
				{payment.credits > 0 && (
					<li>
						<Trans>{creditCount(payment.credits)} added for Rezumi AI.</Trans>
					</li>
				)}
				<li className="text-muted">
					<Trans>We've emailed you the receipt. We'll remind you 3 days before the plan ends.</Trans>
				</li>
			</ul>
			<div className="flex flex-wrap gap-2">
				<Link to="/dashboard/settings/billing" className={buttonVariants()}>
					<Trans>Go to your plan</Trans>
				</Link>
				{hasReceipt(payment) && <ReceiptLink paymentId={payment.id} variant="secondary" />}
			</div>
		</ResultCard>
	);
}

function PaidResult({ payment, formatDate }: Omit<ResultProps, "state">) {
	const plan = getPlanName(payment.planId);
	if (isTrialStart(payment)) return <TrialResult payment={payment} formatDate={formatDate} />;
	if (payment.method === "qris") return <PassResult payment={payment} formatDate={formatDate} />;
	return (
		<ResultCard icon="check-circle" tone="bg-success/15 text-success" title={<Trans>Payment received</Trans>}>
			<ul className="grid gap-1.5 text-sm">
				<li>
					{payment.periodEnd ? (
						<Trans>
							{plan} is active. It renews on {formatDate(payment.periodEnd)} unless you cancel.
						</Trans>
					) : (
						<Trans>{plan} is active.</Trans>
					)}
				</li>
				{payment.credits > 0 && (
					<li>
						<Trans>{creditCount(payment.credits)} added for Rezumi AI.</Trans>
					</li>
				)}
				<li className="text-muted">
					<Trans>Dodo Payments emails you the receipt, and your invoices are in billing.</Trans>
				</li>
			</ul>
			<div className="flex flex-wrap gap-2">
				<Link to="/dashboard/settings/billing" className={buttonVariants()}>
					<Trans>Go to your plan</Trans>
				</Link>
				{hasInvoice(payment) && <InvoiceButton paymentId={payment.id} variant="secondary" />}
			</div>
		</ResultCard>
	);
}

type WaitingResultProps = ResultProps & { polling: boolean; onCheckAgain: () => void; checking: boolean };

function WaitingResult({ payment, state, formatDate, polling, onCheckAgain, checking }: WaitingResultProps) {
	const plan = getPlanName(payment.planId);
	const price = formatPrice(payment.totalAmount || payment.amount, payment.currency);
	const deadline = payment.expiresAt ? formatDate(payment.expiresAt) : null;
	return (
		<ResultCard
			icon="hourglass"
			tone="bg-warning/15 text-warning"
			title={state === "closed" ? <Trans>The time to pay has run out</Trans> : <Trans>Waiting for your payment</Trans>}
		>
			<div className="grid gap-1.5 text-sm">
				<p>
					{plan} · {price}
				</p>
				{state === "closed" ? (
					<p className="text-muted">
						<Trans>If you paid just now, it shows here within a few minutes. Otherwise, start again.</Trans>
					</p>
				) : (
					<p className="text-muted">
						{deadline && payment.method === "qris" ? (
							<Trans>
								If you've paid, this page updates by itself in a few seconds. The QRIS page stays open until {deadline}.
							</Trans>
						) : deadline ? (
							<Trans>
								If you've paid, this page updates by itself in a few seconds. The checkout stays open until {deadline}.
							</Trans>
						) : (
							<Trans>If you've paid, this page updates by itself in a few seconds.</Trans>
						)}
					</p>
				)}
				{polling && (
					<p role="status" className="flex items-center gap-2 text-muted">
						<Spinner size="sm" color="current" aria-hidden />
						<Trans>Checking your payment…</Trans>
					</p>
				)}
			</div>
			<div className="flex flex-wrap gap-2">
				{state === "closed" ? (
					<Link to="/dashboard/settings/billing" search={{ plan: payment.planId }} className={buttonVariants()}>
						<Trans>Try again</Trans>
					</Link>
				) : (
					payment.redirectUrl && (
						<a href={payment.redirectUrl} className={buttonVariants()}>
							{payment.method === "qris" ? <Trans>Continue paying</Trans> : <Trans>Continue checkout</Trans>}
						</a>
					)
				)}
				{!polling && (
					<Button variant="secondary" isPending={checking} onPress={onCheckAgain}>
						{checking && <Spinner size="sm" color="current" aria-hidden />}
						<Trans>Check again</Trans>
					</Button>
				)}
				<Link to="/dashboard/settings/billing" className={buttonVariants({ variant: "ghost" })}>
					<Trans>Back to your plan</Trans>
				</Link>
			</div>
		</ResultCard>
	);
}

function ClosedResult({ payment, state }: Omit<ResultProps, "formatDate">) {
	const plan = getPlanName(payment.planId);
	const refunded = state === "refunded";
	return (
		<ResultCard
			icon={refunded ? "arrow-counter-clockwise" : "x-circle"}
			tone="bg-default text-muted"
			title={
				state === "expired" ? (
					<Trans>This payment expired</Trans>
				) : refunded ? (
					<Trans>This payment was refunded</Trans>
				) : (
					<Trans>This payment didn't go through</Trans>
				)
			}
		>
			<p className="text-body-sm text-muted">
				{refunded ? (
					<Trans>
						The money went back, and any credits it brought were taken back. Your documents stay as they are.
					</Trans>
				) : (
					<Trans>Nothing was charged for it. You can start {plan} again.</Trans>
				)}
			</p>
			<div className="flex flex-wrap gap-2">
				{refunded ? (
					hasInvoice(payment) ? (
						<InvoiceButton paymentId={payment.id} variant="secondary" />
					) : (
						hasReceipt(payment) && <ReceiptLink paymentId={payment.id} variant="secondary" />
					)
				) : (
					<Link to="/dashboard/settings/billing" search={{ plan: payment.planId }} className={buttonVariants()}>
						<Trans>Try again</Trans>
					</Link>
				)}
				<Link to="/dashboard/settings/billing" className={buttonVariants({ variant: "ghost" })}>
					<Trans>Back to your plan</Trans>
				</Link>
			</div>
		</ResultCard>
	);
}

type PaymentReturnPageProps = {
	/** From the path; null when the link carries none. */
	paymentId: string | null;
};

/**
 * Where the checkout sends the customer back after paying. Getting here only says the browser was redirected, so the
 * page asks the server, which checks with Dodo Payments: every 3 seconds for up to 2 minutes while the payment is open and the tab is
 * visible, then on request. The webhook usually lands first.
 */
export function PaymentReturnPage({ paymentId }: PaymentReturnPageProps) {
	const queryClient = useQueryClient();
	const { formatDate } = usePlanDates();
	const [pollingSince, setPollingSince] = useState(() => Date.now());
	const [pollTimedOut, setPollTimedOut] = useState(false);

	const query = useQuery({
		...orpc.billing.payment.queryOptions({ input: { id: paymentId ?? "" } }),
		enabled: paymentId !== null,
		retry: (count, error) => !(error instanceof ORPCError && error.code === "NOT_FOUND") && count < 2,
		refetchInterval: (current) => {
			const payment = current.state.data;
			return payment && isOpenPayment(payment) && Date.now() - pollingSince < POLL_FOR_MS ? POLL_EVERY_MS : false;
		},
	});
	const payment = query.data;
	const state = payment ? getReturnState(payment) : null;

	useEffect(() => {
		const timer = window.setTimeout(() => setPollTimedOut(true), POLL_FOR_MS);
		return () => window.clearTimeout(timer);
	}, [pollingSince]);

	useEffect(() => {
		// The plan, its credits and the payment list changed with it.
		if (state === "paid") void queryClient.invalidateQueries({ queryKey: orpc.billing.key() });
	}, [queryClient, state]);

	const checkAgain = () => {
		setPollingSince(Date.now());
		setPollTimedOut(false);
		void query.refetch();
	};

	const notFound = paymentId === null || (query.error instanceof ORPCError && query.error.code === "NOT_FOUND");

	return (
		<>
			<PageHeader back={<BackToPlanLink />} title={<Trans>Payment</Trans>} />
			{notFound ? (
				<ResultCard icon="question" tone="bg-default text-muted" title={<Trans>We couldn't find this payment</Trans>}>
					<p className="text-body-sm text-muted">
						{paymentId === null ? (
							<Trans>This link doesn't say which payment it is. Your plan page lists every payment you started.</Trans>
						) : (
							<Trans>
								It isn't one of this account's payments. If you paid while signed in to another account, sign in to that
								one. Your plan page lists every payment you started.
							</Trans>
						)}
					</p>
					<Link to="/dashboard/settings/billing" className={buttonVariants()}>
						<Trans>Go to your plan</Trans>
					</Link>
				</ResultCard>
			) : query.isError ? (
				<ResultCard
					icon="warning-circle"
					tone="bg-danger/15 text-danger"
					title={<Trans>We couldn't check this payment</Trans>}
				>
					<p className="text-body-sm text-muted">
						<Trans>Check your connection and try again. If you paid, the payment isn't lost.</Trans>
					</p>
					<Button onPress={checkAgain}>
						<Trans>Try again</Trans>
					</Button>
				</ResultCard>
			) : !payment || !state ? (
				<Skeleton role="status" aria-label={t`Checking your payment…`} className="h-56 rounded-3xl" />
			) : state === "paid" ? (
				<PaidResult payment={payment} formatDate={formatDate} />
			) : state === "waiting" || state === "closed" ? (
				<WaitingResult
					payment={payment}
					state={state}
					formatDate={formatDate}
					polling={!pollTimedOut}
					checking={query.isFetching}
					onCheckAgain={checkAgain}
				/>
			) : (
				<ClosedResult payment={payment} state={state} />
			)}
		</>
	);
}
