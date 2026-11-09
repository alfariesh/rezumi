import { createFileRoute } from "@tanstack/react-router";
import { PortfolioReviewPage } from "@/features/portfolio/admin/review-page";

export const Route = createFileRoute("/dashboard/admin/portfolios/$portfolioId")({
	component: RouteComponent,
});

function RouteComponent() {
	const { portfolioId } = Route.useParams();
	return <PortfolioReviewPage portfolioId={portfolioId} />;
}
