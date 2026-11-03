import type { BillingNoticeEmailProps, PaymentReceiptEmailProps } from "./templates/billing";
import { createElement } from "react";
import { BillingNoticeEmail, PaymentReceiptEmail } from "./templates/billing";
import { deliverEmail } from "./transport";

export type { BillingNoticeEmailProps, PaymentReceiptEmailProps } from "./templates/billing";

/** Sends a payment's receipt and says what happened; see deliverEmail. */
export function deliverPaymentReceipt(input: { to: string; subject: string; receipt: PaymentReceiptEmailProps }) {
	return deliverEmail({
		to: input.to,
		subject: input.subject,
		react: createElement(PaymentReceiptEmail, input.receipt),
	});
}

/** Sends a billing alert, the daily summary or a pass reminder and says what happened; see deliverEmail. */
export function deliverBillingNotice(input: { to: string; subject: string; notice: BillingNoticeEmailProps }) {
	return deliverEmail({
		to: input.to,
		subject: input.subject,
		react: createElement(BillingNoticeEmail, input.notice),
	});
}
