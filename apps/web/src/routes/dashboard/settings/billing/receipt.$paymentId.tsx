import { createFileRoute } from "@tanstack/react-router";
import { PaymentReceiptPage } from "@/features/billing/receipt";

export const Route = createFileRoute("/dashboard/settings/billing/receipt/$paymentId")({ component: RouteComponent });

function RouteComponent() {
	const { paymentId } = Route.useParams();
	return <PaymentReceiptPage paymentId={paymentId} />;
}
