import { createFileRoute } from "@tanstack/react-router";
import z from "zod";
import { BillingAdminPage } from "@/features/billing/admin/overview";

export const Route = createFileRoute("/dashboard/admin/billing/")({
	// An email address or order number to look up; alert emails link here with one.
	validateSearch: z.object({ query: z.string().trim().max(200).optional().catch(undefined) }),
	component: RouteComponent,
});

function RouteComponent() {
	const { query } = Route.useSearch();
	return <BillingAdminPage query={query ?? ""} />;
}
