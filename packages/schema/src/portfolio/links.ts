import z from "zod";
import { PORTFOLIO_LIMITS } from "./limits";

const ALLOWED_PROTOCOLS = new Set(["https:", "http:", "mailto:"]);

/** Whether a link may appear on a portfolio: absolute http(s) or mailto addresses only. */
export function isAllowedPortfolioUrl(value: string, protocols: ReadonlySet<string> = ALLOWED_PROTOCOLS): boolean {
	if (value.length > PORTFOLIO_LIMITS.text.url || /\s/.test(value)) return false;
	try {
		const url = new URL(value);
		if (!protocols.has(url.protocol)) return false;
		return url.protocol === "mailto:" ? url.pathname.length > 0 : Boolean(url.hostname);
	} catch {
		return false;
	}
}

const WEB_PROTOCOLS = new Set(["https:", "http:"]);

export const portfolioUrlSchema = z
	.string()
	.refine((value) => isAllowedPortfolioUrl(value), "Use a full address starting with https://, http:// or mailto:.")
	.describe("An absolute https://, http:// or mailto: address.");

export const webUrlSchema = z
	.string()
	.refine((value) => isAllowedPortfolioUrl(value, WEB_PROTOCOLS), "Use a full address starting with https://.")
	.describe("An absolute https:// or http:// address.");
