import type { Subscription } from "./purchase";
import { Button, Spinner } from "@heroui/react";
import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "@rezumi/ui/components/toast";
import { getPlanName } from "./plan";
import { isLiveSubscription } from "./purchase";
import { useConfirm } from "@/hooks/use-confirm";
import { orpc } from "@/libs/orpc/client";

type SubscriptionActionsProps = {
	subscription: Subscription | null;
	formatDate: (date: Date) => string;
	/** Whether this session can manage billing: web sessions where plans are sold. */
	canManage: boolean;
};

/**
 * What the owner can do with a subscription: open Polar's billing portal (payment method, invoices, billing details),
 * set it to end at the period close, or keep it after all. Plan changes are on the plan cards.
 */
export function SubscriptionActions({ subscription, formatDate, canManage }: SubscriptionActionsProps) {
	const queryClient = useQueryClient();
	const confirm = useConfirm();
	const portal = useMutation(orpc.billing.portal.mutationOptions({ meta: { noInvalidate: true } }));
	const cancel = useMutation(orpc.billing.cancelSubscription.mutationOptions({ meta: { noInvalidate: true } }));
	const resume = useMutation(orpc.billing.resumeSubscription.mutationOptions({ meta: { noInvalidate: true } }));
	if (!canManage || !subscription) return null;
	const live = isLiveSubscription(subscription);
	const refresh = () => void queryClient.invalidateQueries({ queryKey: orpc.billing.key() });

	const openPortal = () =>
		portal.mutate(undefined, {
			onSuccess: ({ url }) => window.location.assign(url),
			onError: () => toast.add({ type: "error", description: t`Billing couldn't be opened. Try again in a moment.` }),
		});

	const cancelAtEnd = async () => {
		const plan = getPlanName(subscription.planId);
		const until = subscription.currentPeriodEnd ? formatDate(subscription.currentPeriodEnd) : null;
		const confirmed = await confirm(t`Cancel your subscription?`, {
			description: until
				? t`You keep ${plan} until ${until}, and nothing more is charged. Then your account is on Free; every document stays yours to open, edit and download as a PDF.`
				: t`Nothing more is charged. Your account goes back to Free at the end of the period you paid for; every document stays yours.`,
			confirmText: t`Cancel subscription`,
			cancelText: t`Keep it`,
		});
		if (!confirmed) return;
		cancel.mutate(undefined, {
			onSuccess: () => {
				refresh();
				toast.add({ type: "success", description: t`Your subscription ends at the close of this period.` });
			},
			onError: () => toast.add({ type: "error", description: t`It couldn't be cancelled. Try again in a moment.` }),
		});
	};

	const keep = () =>
		resume.mutate(undefined, {
			onSuccess: () => {
				refresh();
				toast.add({ type: "success", description: t`Your subscription continues.` });
			},
			onError: () => toast.add({ type: "error", description: t`It couldn't be resumed. Try again in a moment.` }),
		});

	return (
		<div className="flex flex-wrap gap-2">
			<Button size="sm" variant="secondary" isPending={portal.isPending} onPress={openPortal}>
				{portal.isPending && <Spinner size="sm" color="current" aria-hidden />}
				<Trans>Billing and invoices</Trans>
			</Button>
			{live &&
				(subscription.cancelAtPeriodEnd ? (
					<Button size="sm" isPending={resume.isPending} onPress={keep}>
						{resume.isPending && <Spinner size="sm" color="current" aria-hidden />}
						<Trans>Keep subscription</Trans>
					</Button>
				) : (
					subscription.status !== "past_due" && (
						<Button size="sm" variant="ghost" isPending={cancel.isPending} onPress={() => void cancelAtEnd()}>
							{cancel.isPending && <Spinner size="sm" color="current" aria-hidden />}
							<Trans>Cancel subscription</Trans>
						</Button>
					)
				))}
		</div>
	);
}
