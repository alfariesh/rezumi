import { createFileRoute } from "@tanstack/react-router";
import { PaymentReceiptPage } from "@/features/billing/receipt";

/** Rezumi's own receipt for a paid QRIS pass (card payments get Dodo Payments' invoice instead). */
export const Route = createFileRoute("/dashboard/settings/billing/receipt/$paymentId")({ component: RouteComponent });

function RouteComponent() {
	const { paymentId } = Route.useParams();
	return <PaymentReceiptPage paymentId={paymentId} />;
}
