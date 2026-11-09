import { MemoryRatelimiter } from "@orpc/experimental-ratelimit/memory";
import { env } from "@rezumi/env/server";
import { rateLimitConfig } from "@rezumi/utils/rate-limit";
import { getPortfolioMode } from "./mode";

type PublicLimiter = { limit: (options: { key: string }) => Promise<{ success: boolean }> };

let readBinding: (() => PublicLimiter | undefined) | undefined;

/** Workers passes its rate limiting binding, which answers inside the colo without a network call. */
export function configurePortfolioPublicLimiter(read: () => PublicLimiter | undefined): void {
	readBinding = read;
}

// Elsewhere (Node) the limit holds per process, which is enough to stop one address flooding it.
const memory = new MemoryRatelimiter(rateLimitConfig.portfolioPublic.requests);

/**
 * Whether one address may make another public portfolio request (`02-teknis.md` section 39): the page, its link preview,
 * files, the sitemap and the form posts, counted before anything reads the database. The limit stops floods, not
 * visitors, and a limiter that fails lets the request through. Nothing is counted while portfolios are off.
 */
export async function publicPortfolioRequestAllowed(client: string | undefined): Promise<boolean> {
	if (getPortfolioMode() === "off" || env.FLAG_DISABLE_API_RATE_LIMIT) return true;
	const address = client?.trim();
	// Without an address, everyone would share one bucket.
	if (!address || address === "unknown") return true;
	try {
		const binding = readBinding?.();
		const { success } = binding ? await binding.limit({ key: address }) : await memory.limit(address);
		return success;
	} catch {
		return true;
	}
}

/** The answer when `publicPortfolioRequestAllowed` says no. */
export const tooManyPortfolioRequests = () =>
	new Response("Too Many Requests", { status: 429, headers: { "Cache-Control": "no-store", "Retry-After": "60" } });
