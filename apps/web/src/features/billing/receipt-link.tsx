import { buttonVariants } from "@heroui/react";
import { Trans } from "@lingui/react/macro";
import { Link } from "@tanstack/react-router";

type ReceiptLinkProps = { paymentId: string; variant?: "ghost" | "secondary" };

/** Opens Rezumi's own receipt for a paid QRIS pass, to keep or print; card payments get Dodo's invoice instead. */
export function ReceiptLink({ paymentId, variant = "ghost" }: ReceiptLinkProps) {
	return (
		<Link
			to="/dashboard/settings/billing/receipt/$paymentId"
			params={{ paymentId }}
			className={buttonVariants({ size: "sm", variant })}
		>
			<Trans>Receipt</Trans>
		</Link>
	);
}
