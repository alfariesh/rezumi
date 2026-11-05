import type { BillingNoticeEmailProps } from "./templates/billing";
import { createElement } from "react";
import { BillingNoticeEmail } from "./templates/billing";
import { deliverEmail } from "./transport";

export type { BillingNoticeEmailProps } from "./templates/billing";

/**
 * Sends a billing alert, the daily summary or a plan reminder and says what happened; see deliverEmail. Receipts and
 * invoices come from Polar, the merchant of record.
 */
export function deliverBillingNotice(input: { to: string; subject: string; notice: BillingNoticeEmailProps }) {
	return deliverEmail({
		to: input.to,
		subject: input.subject,
		react: createElement(BillingNoticeEmail, input.notice),
	});
}
