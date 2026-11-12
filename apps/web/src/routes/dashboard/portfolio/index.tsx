import type { PortfolioStatisticsRange } from "@rezumi/schema/portfolio/statistics";
import { createFileRoute, redirect } from "@tanstack/react-router";
import z from "zod";
import { PortfolioPage } from "@/features/portfolio/portfolio-page";
import { orpc } from "@/libs/orpc/client";

const searchSchema = z.object({
	// The statistics' range in days; 30 is the default and stays out of the address.
	range: z.coerce
		.number()
		.pipe(z.union([z.literal(7), z.literal(30), z.literal(90)]))
		.optional()
		.catch(undefined) satisfies z.ZodType<PortfolioStatisticsRange | undefined>,
});

/** Portfolio in the dashboard; accounts the switch (`PORTFOLIO_MODE`) leaves out go home. */
export const Route = createFileRoute("/dashboard/portfolio/")({
	component: PortfolioPage,
	validateSearch: searchSchema,
	loader: async ({ context }) => {
		const result = await context.queryClient.ensureQueryData(orpc.portfolio.get.queryOptions());
		if (!result.enabled) throw redirect({ to: "/dashboard", replace: true });
	},
});
