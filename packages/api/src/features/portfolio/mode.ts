import { env } from "@rezumi/env/server";

export type PortfolioMode = "off" | "admins" | "on";

export function getPortfolioMode(): PortfolioMode {
	// The env schema defaults it; a missing value (a partial env in tests) still means off.
	return env.PORTFOLIO_MODE ?? "off";
}

/**
 * Whether an account can build and publish a portfolio: every signed-up account when on, only admins while testing,
 * nobody when off. Guest (anonymous) accounts never can. Publishing also needs a verified email (`setPublic`).
 */
export function isPortfolioEnabledFor(
	account: { role?: string | null | undefined; isAnonymous?: boolean | null | undefined },
	mode = getPortfolioMode(),
): boolean {
	if (account.isAnonymous) return false;
	if (mode === "on") return true;
	if (mode === "admins") return account.role === "admin";
	return false;
}
