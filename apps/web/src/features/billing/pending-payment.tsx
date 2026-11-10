import type { Payment } from "./purchase";
import { Alert, buttonVariants } from "@heroui/react";
import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { Icon } from "@rezumi/ui/components/icon";
import { cn } from "@rezumi/utils/style";
import { getPlanName } from "./plan";
import { formatPrice } from "./purchase";

type PendingPaymentBannerProps = { payment: Payment; formatDate: (date: Date) => string };

/** A checkout that's started and can still be paid: what it's for, until when, and the way back to its page. */
export function PendingPaymentBanner({ payment, formatDate }: PendingPaymentBannerProps) {
	const plan = getPlanName(payment.planId);
	// A trial checkout charges nothing today; say so rather than the price it renews at.
	const price = payment.trialDays
		? t`${payment.trialDays} days free`
		: formatPrice(payment.totalAmount || payment.amount, payment.currency);
	const deadline = payment.expiresAt ? formatDate(payment.expiresAt) : null;

	return (
		<Alert status="warning">
			<Alert.Indicator>
				<Icon name="hourglass" />
			</Alert.Indicator>
			<Alert.Content className="grid gap-2">
				<Alert.Title>
					<Trans>Your {plan} checkout isn't finished</Trans>
				</Alert.Title>
				<Alert.Description>
					{deadline ? (
						<Trans>
							{price}, open until {deadline}.
						</Trans>
					) : (
						price
					)}
				</Alert.Description>
				{payment.redirectUrl && (
					<div className="flex flex-wrap gap-2">
						<a href={payment.redirectUrl} className={cn(buttonVariants({ size: "sm" }))}>
							<Trans>Continue checkout</Trans>
						</a>
					</div>
				)}
			</Alert.Content>
		</Alert>
	);
}
