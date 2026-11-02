import type { PaymentReceiptEmailProps } from "./templates/billing";
import { createElement } from "react";
import { PaymentReceiptEmail } from "./templates/billing";
import { deliverEmail } from "./transport";

export type { PaymentReceiptEmailProps } from "./templates/billing";

/** Sends a payment's receipt and says what happened; see deliverEmail. */
export function deliverPaymentReceipt(input: { to: string; subject: string; receipt: PaymentReceiptEmailProps }) {
	return deliverEmail({
		to: input.to,
		subject: input.subject,
		react: createElement(PaymentReceiptEmail, input.receipt),
	});
}
