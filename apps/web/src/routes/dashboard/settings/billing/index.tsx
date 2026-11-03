import { createFileRoute } from "@tanstack/react-router";
import z from "zod";
import { paidPlanIdSchema } from "@rezumi/schema/billing";
import { PlanSettings } from "@/features/billing/plan-page";

export const Route = createFileRoute("/dashboard/settings/billing/")({
	// The plan an upgrade prompt or the landing page's pricing asked for, marked on the page.
	validateSearch: z.object({ plan: paidPlanIdSchema.optional().catch(undefined) }),
	component: RouteComponent,
});

function RouteComponent() {
	const { plan } = Route.useSearch();
	return <PlanSettings selectedPlan={plan} />;
}
