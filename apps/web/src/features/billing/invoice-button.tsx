import { Button, Spinner } from "@heroui/react";
import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { useMutation } from "@tanstack/react-query";
import { toast } from "@rezumi/ui/components/toast";
import { orpc } from "@/libs/orpc/client";

/** How long the opened invoice's address stays valid in the new tab before it is let go. */
const REVOKE_AFTER_MS = 60_000;

type InvoiceButtonProps = { paymentId: string; variant?: "ghost" | "secondary" };

/**
 * Opens a paid payment's invoice in a new tab: the PDF Dodo Payments (the seller) issues, fetched through the server so
 * no Dodo key ever reaches the browser. When there is none to give, the billing portal has them all.
 */
export function InvoiceButton({ paymentId, variant = "ghost" }: InvoiceButtonProps) {
	const invoice = useMutation(orpc.billing.invoice.mutationOptions({ meta: { noInvalidate: true } }));

	const open = async () => {
		// Opened on the click itself, so the browser doesn't block it as a pop-up; the document follows.
		const tab = window.open("about:blank", "_blank");
		try {
			const result = await invoice.mutateAsync({ id: paymentId });
			if (result.status === "ready") {
				const url = URL.createObjectURL(result.file);
				if (tab) tab.location.href = url;
				else window.location.assign(url);
				setTimeout(() => URL.revokeObjectURL(url), REVOKE_AFTER_MS);
				return;
			}
			tab?.close();
			toast.add({
				type: "info",
				description: t`This invoice isn't available here. Open billing to find all your invoices.`,
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
