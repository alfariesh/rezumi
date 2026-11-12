import { useQuery } from "@tanstack/react-query";
import { portfolioHoldsShortLink } from "@/features/resume/share/short-link";
import { useShareOrigin } from "@/features/resume/share/use-share-origin";
import { orpc } from "@/libs/orpc/client";

/**
 * The address visitors should use for the portfolio: the person's own domain while it's connected and opens the
 * portfolio, else `/<username>` on the app. The business card's QR leads there.
 */
export function usePortfolioPageUrl(username: string): string {
	const origin = useShareOrigin();
	// Refused while custom domains aren't open to the account: then there's none, and nothing to retry.
	const { data: domain } = useQuery({ ...orpc.customDomain.get.queryOptions(), retry: false });
	const { data: status } = useQuery(orpc.portfolio.status.queryOptions());
	const domainOpensPortfolio =
		domain?.stage === "active" && domain.plan.state !== "redirecting" && portfolioHoldsShortLink(status);
	return domainOpensPortfolio ? `https://${domain.hostname}` : `${origin}/${encodeURIComponent(username)}`;
}
