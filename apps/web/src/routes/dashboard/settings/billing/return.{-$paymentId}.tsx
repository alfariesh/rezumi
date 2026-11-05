import { createFileRoute } from "@tanstack/react-router";
import { PaymentReturnPage } from "@/features/billing/payment-return";

/**
 * Polar's success URL: `return/<payment id>?checkout_id=…`. The query only says which checkout Polar finished; the page
 * asks the server about the payment in the path.
 */
export const Route = createFileRoute("/dashboard/settings/billing/return/{-$paymentId}")({
	component: RouteComponent,
});

function RouteComponent() {
	const { paymentId } = Route.useParams();
	return <PaymentReturnPage paymentId={paymentId || null} />;
}
