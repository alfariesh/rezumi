import type { PaymentDetail } from "./purchase";
import type { ReactNode } from "react";
import { Button, buttonVariants, Skeleton, Typography } from "@heroui/react";
import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { useQuery } from "@tanstack/react-query";
import { Link, useRouteContext } from "@tanstack/react-router";
import { BILLING_SELLER, PASS_DAYS, PLANS } from "@rezumi/schema/billing";
import { Icon } from "@rezumi/ui/components/icon";
import { BackToPlanLink } from "./back-link";
import { creditCount } from "./credits";
import { getPlanName } from "./plan";
import { formatPrice, getPaymentStatusLabel, hasReceipt, usePlanDates } from "./purchase";
import { PageHeader } from "@/components/layout/page-header";
import { orpc } from "@/libs/orpc/client";
import { renderAsH2 } from "@/libs/typography";

type ReceiptRowProps = { label: ReactNode; children: ReactNode };

function ReceiptRow({ label, children }: ReceiptRowProps) {
	return (
		<div className="grid gap-0.5 py-2.5 sm:grid-cols-[12rem_1fr] sm:gap-4">
			<dt className="text-muted print:text-neutral-600">{label}</dt>
			<dd className="font-medium break-words">{children}</dd>
		</div>
	);
}

type ReceiptProps = {
	payment: PaymentDetail;
	buyer: { name: string; email: string };
	formatDate: (date: Date) => string;
};

/**
 * The receipt for a QRIS pass, which Rezumi's owner sells directly: seller, buyer, order number, when it was paid, the
 * plan and its access, how it was paid, the status and the amount. The seller isn't VAT-registered, so it is proof of
 * payment and never a tax invoice.
 */
function Receipt({ payment, buyer, formatDate }: ReceiptProps) {
	const paidAt = payment.paidAt ?? payment.createdAt;
	const refunded = payment.refundedAmount > 0;
	const days = payment.durationDays ?? PASS_DAYS[payment.interval ?? "month"];
	const perMonth = PLANS[payment.planId].creditsPerMonth;
	return (
		<article
			data-print-only
			aria-labelledby="receipt-title"
			className="grid gap-6 rounded-3xl bg-surface p-6 text-sm shadow-surface sm:p-8 print:rounded-none print:bg-white print:p-0 print:text-black print:shadow-none"
		>
			<header className="flex flex-wrap items-start justify-between gap-4">
				<div className="grid gap-1">
					<p className="text-base font-semibold">{BILLING_SELLER.brand}</p>
					<Typography id="receipt-title" type="h3" render={renderAsH2}>
						<Trans>Payment receipt</Trans>
					</Typography>
				</div>
				<div className="grid gap-0.5 text-end">
					<span className="text-muted print:text-neutral-600">
						<Trans>Order number</Trans>
					</span>
					<span className="font-mono font-medium">RZ-{payment.id}</span>
				</div>
			</header>

			<div className="grid gap-4 sm:grid-cols-2">
				<div className="grid gap-0.5">
					<span className="text-muted print:text-neutral-600">
						<Trans>Seller</Trans>
					</span>
					<span className="font-medium">
						{BILLING_SELLER.name} ({BILLING_SELLER.brand})
					</span>
					<span>{BILLING_SELLER.mailingAddress}</span>
					<span>{BILLING_SELLER.supportEmail}</span>
				</div>
				<div className="grid content-start gap-0.5">
					<span className="text-muted print:text-neutral-600">
						<Trans>Paid by</Trans>
					</span>
					<span className="font-medium">{buyer.name}</span>
					<span>{buyer.email}</span>
				</div>
			</div>

			<dl className="divide-y divide-separator border-y border-separator print:divide-neutral-300 print:border-neutral-300">
				<ReceiptRow label={<Trans>Paid on</Trans>}>{formatDate(paidAt)}</ReceiptRow>
				<ReceiptRow label={<Trans>Item</Trans>}>
					<Trans>
						Rezumi {getPlanName(payment.planId)}, {days} days of access
					</Trans>
				</ReceiptRow>
				{payment.periodStart && payment.periodEnd && (
					<ReceiptRow label={<Trans>Access period</Trans>}>
						<Trans>
							{formatDate(payment.periodStart)} until {formatDate(payment.periodEnd)}
						</Trans>
					</ReceiptRow>
				)}
				{perMonth > 0 && (
					<ReceiptRow label={<Trans>Rezumi AI credits</Trans>}>
						<Trans>{creditCount(perMonth)} for each month of access</Trans>
					</ReceiptRow>
				)}
				<ReceiptRow label={<Trans>Payment method</Trans>}>
					<Trans>QRIS, processed by {BILLING_SELLER.qrisProcessor}</Trans>
				</ReceiptRow>
				<ReceiptRow label={<Trans>Status</Trans>}>{getPaymentStatusLabel(payment.status)}</ReceiptRow>
				{refunded && (
					<ReceiptRow label={<Trans>Refunded</Trans>}>
						{formatPrice(payment.refundedAmount, payment.currency)}
					</ReceiptRow>
				)}
				<ReceiptRow label={<Trans>Total paid</Trans>}>
					<span className="text-base font-semibold tabular-nums">
						{formatPrice(payment.totalAmount || payment.amount, payment.currency)}
					</span>
				</ReceiptRow>
			</dl>

			<p className="text-body-xs text-muted print:text-neutral-600">
				<Trans>
					The price is final. The seller isn't registered for VAT, so no VAT is charged and this receipt is not a tax
					invoice.
				</Trans>
			</p>
		</article>
	);
}

type PaymentReceiptPageProps = { paymentId: string };

/** A paid QRIS pass's receipt, to keep or print on its own; dates in the account's time zone. */
export function PaymentReceiptPage({ paymentId }: PaymentReceiptPageProps) {
	const { session } = useRouteContext({ from: "/dashboard" });
	const { formatDate } = usePlanDates();
	const {
		data: payment,
		isPending,
		isError,
	} = useQuery(orpc.billing.payment.queryOptions({ input: { id: paymentId } }));
	return (
		<>
			<div className="print:hidden">
				<PageHeader
					back={<BackToPlanLink />}
					title={<Trans>Receipt</Trans>}
					actions={
						payment && hasReceipt(payment) ? (
							<Button variant="secondary" onPress={() => window.print()}>
								<Icon name="printer" size={18} />
								<Trans>Print or save as PDF</Trans>
							</Button>
						) : undefined
					}
				/>
			</div>
			{isPending ? (
				<Skeleton role="status" aria-label={t`Loading the receipt…`} className="h-96 rounded-3xl" />
			) : isError || !payment || !hasReceipt(payment) ? (
				<div className="grid justify-items-start gap-3 text-sm">
					<p className="text-muted">
						{isError ? (
							<Trans>This receipt isn't available. It may belong to another account.</Trans>
						) : (
							<Trans>There's no receipt here: this payment isn't a paid QRIS plan.</Trans>
						)}
					</p>
					<Link to="/dashboard/settings/billing" className={buttonVariants({ variant: "secondary" })}>
						<Trans>Back to your plan</Trans>
					</Link>
				</div>
			) : (
				<Receipt
					payment={payment}
					buyer={{ name: session.user.name, email: session.user.email }}
					formatDate={formatDate}
				/>
			)}
		</>
	);
}
