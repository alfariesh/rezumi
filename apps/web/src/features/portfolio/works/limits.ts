import { useQuery } from "@tanstack/react-query";
import { PORTFOLIO_LIMITS } from "@rezumi/schema/portfolio/limits";
import { orpc } from "@/libs/orpc/client";

/**
 * How many works the portfolio may hold, as `portfolio.get` reported it (the editor's route loads it): a plan may allow
 * fewer than the technical limit, which applies until the answer is in.
 */
export function usePortfolioLimits() {
	const { data } = useQuery(orpc.portfolio.get.queryOptions({ select: (result) => result.limits.works }));
	return { works: data ?? PORTFOLIO_LIMITS.works };
}
