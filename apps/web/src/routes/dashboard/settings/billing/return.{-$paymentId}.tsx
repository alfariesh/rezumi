import { createFileRoute, redirect } from "@tanstack/react-router";
import { PaymentReturnPage } from "@/features/billing/payment-return";

/**
 * Polar's success URL: `return/<payment id>?checkout_id=…`. The page asks the server about the payment in the path and
 * reads nothing from the query, which Polar also fills with a customer portal session: the query leaves the address
 * bar and the history at once, so it isn't shared or reopened from there.
 */
export const Route = createFileRoute("/dashboard/settings/billing/return/{-$paymentId}")({
	beforeLoad: ({ location, params }) => {
		if (location.searchStr)
			throw redirect({ to: "/dashboard/settings/billing/return/{-$paymentId}", params, search: {}, replace: true });
	},
	component: RouteComponent,
});

function RouteComponent() {
	const { paymentId } = Route.useParams();
	return <PaymentReturnPage paymentId={paymentId || null} />;
}
