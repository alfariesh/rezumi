import { env } from "@rezumi/env/server";
import { createRateLimiter } from "../../../redis";
import { sourceErrors } from "./errors";

const DAY = 24 * 60 * 60 * 1000;

/**
 * Reads per account per day. They bound what one account costs (each LinkedIn read is paid on the operator's Apify
 * account) and what it asks of GitHub, so unlike the request throttles they also count outside production; only
 * `FLAG_DISABLE_API_RATE_LIMIT` (isolated test installations) turns them off.
 */
export const SOURCE_DAILY_LIMITS = { linkedin: 3, github: 10 } as const;

type LimitedSource = keyof typeof SOURCE_DAILY_LIMITS;

const limiters = {
	linkedin: createRateLimiter("profileSourceLinkedin", { maxRequests: SOURCE_DAILY_LIMITS.linkedin, window: DAY }),
	github: createRateLimiter("profileSourceGithub", { maxRequests: SOURCE_DAILY_LIMITS.github, window: DAY }),
};

/** Counts one read; SOURCE_LIMIT once the account used the day's reads. Call it right before the outbound request. */
export async function consumeSourceLimit(source: LimitedSource, userId: string) {
	if (env.FLAG_DISABLE_API_RATE_LIMIT) return;
	const { success } = await limiters[source].limit(`${source}:${userId}`);
	if (!success)
		throw sourceErrors.limit(
			`This account read ${SOURCE_DAILY_LIMITS[source]} ${source === "linkedin" ? "LinkedIn profiles" : "GitHub accounts"} today, the most a day allows. Try again tomorrow, or upload a file instead.`,
		);
}
