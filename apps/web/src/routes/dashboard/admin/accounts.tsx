import { createFileRoute } from "@tanstack/react-router";
import z from "zod";
import { AccountsAdminPage } from "@/features/billing/admin/accounts";

export const Route = createFileRoute("/dashboard/admin/accounts")({
	validateSearch: z.object({
		query: z.string().trim().max(200).optional().catch(undefined),
		plan: z.enum(["free", "plus", "pro-ai"]).optional().catch(undefined),
	}),
	component: RouteComponent,
});

function RouteComponent() {
	const { query, plan } = Route.useSearch();
	return <AccountsAdminPage query={query ?? ""} plan={plan ?? "all"} />;
}
