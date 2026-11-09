import type { BillingNoticeEmailProps } from "./templates/billing";
import type { PortfolioMessageEmailProps } from "./templates/portfolio-message";
import { createElement } from "react";
import { BillingNoticeEmail } from "./templates/billing";
import { PortfolioMessageEmail, portfolioMessageSubject } from "./templates/portfolio-message";
import { deliverEmail } from "./transport";

/**
 * Tells a portfolio's owner about new messages and says what happened (see deliverEmail). One message shows in full,
 * and replying answers its sender; several are merged into a count. The visitor's words stay out of the subject and of
 * the log.
 */
export function deliverPortfolioMessageNotice(input: { to: string; notice: PortfolioMessageEmailProps }) {
	return deliverEmail({
		to: input.to,
		subject: portfolioMessageSubject(input.notice.lang, input.notice.count),
		react: createElement(PortfolioMessageEmail, input.notice),
		replyTo: input.notice.message?.email,
		privateBody: true,
	});
}

/** Tells the operator about a report on a portfolio; replying answers the reporter when they left an address. */
export function deliverPortfolioReportNotice(input: {
	to: string;
	subject: string;
	notice: BillingNoticeEmailProps;
	replyTo?: string | undefined;
}) {
	return deliverEmail({
		to: input.to,
		subject: input.subject,
		react: createElement(BillingNoticeEmail, input.notice),
		replyTo: input.replyTo,
		privateBody: true,
	});
}
