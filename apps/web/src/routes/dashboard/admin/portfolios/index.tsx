import { createFileRoute } from "@tanstack/react-router";
import z from "zod";
import { PORTFOLIO_REPORT_STATUSES } from "@rezumi/schema/portfolio/moderation";
import { PortfolioReportsPage } from "@/features/portfolio/admin/reports-page";

export const Route = createFileRoute("/dashboard/admin/portfolios/")({
	validateSearch: z.object({
		status: z
			.enum([...PORTFOLIO_REPORT_STATUSES, "all"])
			.optional()
			.catch(undefined),
	}),
	component: RouteComponent,
});

function RouteComponent() {
	const { status } = Route.useSearch();
	return <PortfolioReportsPage status={status ?? "open"} />;
}
