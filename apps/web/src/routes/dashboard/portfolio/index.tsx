import { createFileRoute, redirect } from "@tanstack/react-router";
import { PortfolioPage } from "@/features/portfolio/portfolio-page";
import { orpc } from "@/libs/orpc/client";

/** Portfolio in the dashboard; accounts the switch (`PORTFOLIO_MODE`) leaves out go home. */
export const Route = createFileRoute("/dashboard/portfolio/")({
	component: PortfolioPage,
	loader: async ({ context }) => {
		const result = await context.queryClient.ensureQueryData(orpc.portfolio.get.queryOptions());
		if (!result.enabled) throw redirect({ to: "/dashboard", replace: true });
	},
});
