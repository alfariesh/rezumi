import type { Payment } from "./purchase";
import { Alert, Button, buttonVariants, Spinner } from "@heroui/react";
import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Icon } from "@rezumi/ui/components/icon";
import { toast } from "@rezumi/ui/components/toast";
import { cn } from "@rezumi/utils/style";
import { getPlanName } from "./plan";
import { formatPrice } from "./purchase";
import { orpc } from "@/libs/orpc/client";

type PendingPaymentBannerProps = { payment: Payment; formatDate: (date: Date) => string };

/**
 * A payment that's started and can still be paid: what it's for, until when, a way back to Midtrans' page, and a way to
 * pay with another method (the old order is closed first, so it can't be paid twice by mistake).
 */
export function PendingPaymentBanner({ payment, formatDate }: PendingPaymentBannerProps) {
	const queryClient = useQueryClient();
	const [redirecting, setRedirecting] = useState(false);
	const change = useMutation(orpc.billing.changePaymentMethod.mutationOptions({ meta: { noInvalidate: true } }));
	// Changing closes the old order on Midtrans, so a second click before the re-render must not send it again.
	const started = useRef(false);
	const plan = getPlanName(payment.planId);
	const price = formatPrice(payment.amount);
	const deadline = payment.expiresAt ? formatDate(payment.expiresAt) : null;

	useEffect(() => {
		// Back from Midtrans, the browser can restore this page as it was left: still on its way out.
		const restore = (event: PageTransitionEvent) => {
			if (!event.persisted) return;
			started.current = false;
			setRedirecting(false);
		};
		window.addEventListener("pageshow", restore);
		return () => window.removeEventListener("pageshow", restore);
	}, []);

	const changeMethod = () => {
		if (started.current) return;
		started.current = true;
		change.mutate(
			{ paymentId: payment.id },
			{
				onSuccess: ({ redirectUrl }) => {
					setRedirecting(true);
					window.location.assign(redirectUrl);
				},
				onError: async () => {
					started.current = false;
					// It may have been paid in the meantime: ask where it stands, then show the page as it is now.
					const latest = await queryClient
						.fetchQuery({ ...orpc.billing.payment.queryOptions({ input: { id: payment.id } }), staleTime: 0 })
						.catch(() => null);
					void queryClient.invalidateQueries({ queryKey: orpc.billing.key() });
					const paid = latest?.status === "paid";
					toast.add({
						type: paid ? "success" : "error",
						description: paid
							? t`This payment went through, so there's nothing to change.`
							: t`The payment method couldn't be changed. Try again in a moment.`,
					});
				},
			},
		);
	};

	return (
		<Alert status="warning">
			<Alert.Indicator>
				<Icon name="hourglass" />
			</Alert.Indicator>
			<Alert.Content className="grid gap-2">
				<Alert.Title>
					<Trans>Your {plan} payment isn't finished</Trans>
				</Alert.Title>
				<Alert.Description>
					{deadline ? (
						<Trans>
							{price}, payable until {deadline}. A bank transfer can still be paid any time before then.
						</Trans>
					) : (
						price
					)}
				</Alert.Description>
				<div className="flex flex-wrap gap-2">
					{payment.redirectUrl && (
						<a href={payment.redirectUrl} className={cn(buttonVariants({ size: "sm" }))}>
							<Trans>Continue payment</Trans>
						</a>
					)}
					<Button size="sm" variant="secondary" isPending={change.isPending || redirecting} onPress={changeMethod}>
						{(change.isPending || redirecting) && <Spinner size="sm" color="current" aria-hidden />}
						<Trans>Change payment method</Trans>
					</Button>
				</div>
			</Alert.Content>
		</Alert>
	);
}
