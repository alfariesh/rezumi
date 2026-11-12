import { createFileRoute } from "@tanstack/react-router";
import z from "zod";
import { PORTFOLIO_REPORT_STATUSES } from "@rezumi/schema/portfolio/moderation";
import { PortfolioReviewPage } from "@/features/portfolio/admin/review-page";

export const Route = createFileRoute("/dashboard/admin/portfolios/$portfolioId")({
	// The reports list's filter, carried along so "All reports" goes back to the same list.
	validateSearch: z.object({
		from: z
			.enum([...PORTFOLIO_REPORT_STATUSES, "all"])
			.optional()
			.catch(undefined),
	}),
	component: RouteComponent,
});

function RouteComponent() {
	const { portfolioId } = Route.useParams();
	const { from } = Route.useSearch();
	return <PortfolioReviewPage portfolioId={portfolioId} from={from} />;
}
