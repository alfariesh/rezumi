import { t } from "@lingui/core/macro";

type PortfolioState = {
	enabled: boolean;
	portfolio: { isPublic: boolean; suspendedAt: Date | string | null } | null;
} | null;

/**
 * Whether the account's published portfolio holds the short link (`/<username>`) and custom domain, the way the
 * server decides it (`portfolioOwnsProfilePath`): portfolios are open to the account, and its portfolio is published
 * and not taken down. While portfolios are switched off this is always false, and Share reads as it always has.
 */
export function portfolioHoldsShortLink(state: PortfolioState | undefined): boolean {
	return Boolean(state?.enabled && state.portfolio?.isPublic && !state.portfolio.suspendedAt);
}

type PrimaryResumeState = {
	portfolioHolds: boolean;
	isPrimary: boolean;
	isPublic: boolean;
	/** Another resume that is primary now. */
	current: { name: string } | null;
};

/** What the Primary resume switch says the short link and custom domain open. */
export function primaryResumeDescription({ portfolioHolds, isPrimary, isPublic, current }: PrimaryResumeState): string {
	if (portfolioHolds)
		return isPrimary
			? t`Your published portfolio opens at your short link and custom domain. This resume opens there again if you unpublish the portfolio.`
			: t`Your published portfolio opens at your short link and custom domain. Your primary resume opens there again if you unpublish the portfolio.`;
	if (isPrimary)
		return isPublic
			? t`Your short link and custom domain open this resume.`
			: t`Your short link and custom domain say this resume isn't shared until you publish it again.`;
	return current
		? t`Your short link and custom domain open “${current.name}”.`
		: t`Publish this resume to open it at your short link and custom domain.`;
}

/** The note under the short link, when it opens something other than the primary resume. */
export function shortLinkDescription(portfolioHolds: boolean): string | undefined {
	return portfolioHolds ? t`Opens your portfolio.` : undefined;
}
