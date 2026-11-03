import { createFileRoute } from "@tanstack/react-router";
import { CustomerBillingPage } from "@/features/billing/admin/customer";

export const Route = createFileRoute("/dashboard/admin/billing/$userId")({ component: RouteComponent });

function RouteComponent() {
	const { userId } = Route.useParams();
	return <CustomerBillingPage userId={userId} />;
}
