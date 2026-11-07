import { useQuery } from "@tanstack/react-query";
import { PORTFOLIO_LIMITS } from "@rezumi/schema/portfolio/limits";
import { orpc } from "@/libs/orpc/client";

export type PortfolioAccountLimits = {
	/** How many works the portfolio may hold. */
	works: number;
	/** Bytes of pictures and PDFs the account may store; null when the server sets no quota. */
	storageBytes: number | null;
};

/**
 * The account's portfolio limits as `portfolio.get` reported them (the editor's route loads it): from Phase 07 a plan
 * may allow fewer works or less storage than the technical limits, which apply until the answer is in.
 */
export function usePortfolioLimits(): PortfolioAccountLimits {
	const { data } = useQuery(orpc.portfolio.get.queryOptions({ select: (result) => result.limits }));
	return { works: data?.works ?? PORTFOLIO_LIMITS.works, storageBytes: data?.storageBytes ?? null };
}
