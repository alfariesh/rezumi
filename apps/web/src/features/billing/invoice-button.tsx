import { Button, Spinner } from "@heroui/react";
import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { useMutation } from "@tanstack/react-query";
import { toast } from "@rezumi/ui/components/toast";
import { orpc } from "@/libs/orpc/client";

/** How long Polar takes to make an invoice the first time it is asked for, before asking again. */
const GENERATING_RETRY_MS = 3000;

type InvoiceButtonProps = { paymentId: string; variant?: "ghost" | "secondary" };

/**
 * Opens a paid order's invoice from Polar, the seller, in a new tab. Polar makes an invoice the first time it is
 * asked for, so the first click may wait a few seconds; when there is none to give, the billing portal has them all.
 */
export function InvoiceButton({ paymentId, variant = "ghost" }: InvoiceButtonProps) {
	const invoice = useMutation(orpc.billing.invoice.mutationOptions({ meta: { noInvalidate: true } }));

	const open = async () => {
		// Opened on the click itself, so the browser doesn't block it as a pop-up; the address follows.
		const tab = window.open("about:blank", "_blank");
		const ask = () => invoice.mutateAsync({ id: paymentId });
		try {
			let result = await ask();
			if (result.status === "generating") {
				await new Promise((resolve) => setTimeout(resolve, GENERATING_RETRY_MS));
				result = await ask();
			}
			if (result.status === "ready") {
				if (tab) tab.location.href = result.url;
				else window.location.assign(result.url);
				return;
			}
			tab?.close();
			toast.add({
				type: "info",
				description:
					result.status === "generating"
						? t`Your invoice is still being made. Try again in a moment.`
						: t`This invoice isn't available here. Open billing to find all your invoices.`,
			});
		} catch {
			tab?.close();
			toast.add({ type: "error", description: t`The invoice couldn't be opened. Try again in a moment.` });
		}
	};

	return (
		<Button size="sm" variant={variant} isPending={invoice.isPending} onPress={() => void open()}>
			{invoice.isPending && <Spinner size="sm" color="current" aria-hidden />}
			<Trans>Invoice</Trans>
		</Button>
	);
}
