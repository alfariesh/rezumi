import { isPortfolioLive } from "@/features/portfolio/status";

type PortfolioState = {
	enabled: boolean;
	portfolio: { isPublic: boolean; suspendedAt: Date | string | null } | null;
} | null;

/**
 * Whether the account's published portfolio holds the short link (`/<username>`) and custom domain, the way the
 * server decides it (`portfolioOwnsProfilePath`): portfolios are open to the account, and its portfolio is live
 * (published and not taken down). While portfolios are switched off this is always false, and Share reads as it
 * always has.
 */
export function portfolioHoldsShortLink(state: PortfolioState | undefined): boolean {
	return Boolean(state?.enabled && isPortfolioLive(state.portfolio));
}
