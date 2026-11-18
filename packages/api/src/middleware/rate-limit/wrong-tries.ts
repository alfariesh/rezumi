import { getCoordination } from "@rezumi/db/coordination";
import { getRedis, redisKey } from "@rezumi/db/redis";
import { createRateLimiter } from "../../redis";

const HOUR_MS = 60 * 60 * 1000;

export type WrongTryBudget = {
	/** Whether the budget of wrong tries for this target is spent for now. A store that fails reads as not spent. */
	isSpent: (targetId: string) => Promise<boolean>;
	/** Spends one wrong try; the last one marks the budget spent for an hour. */
	spend: (targetId: string) => Promise<void>;
};

/**
 * Wrong passwords one target (a portfolio, a resume) takes per hour from everyone together, so a dictionary spread over
 * many addresses (a /48, a botnet) runs out too. Only wrong tries spend it; once it's spent, every try (a right one
 * too) is refused until the hour is over. Where no shared store is configured, the spent budget is remembered in this
 * process, like the limiters.
 */
export function createWrongTryBudget(name: string, perHour: number): WrongTryBudget {
	const limiter = createRateLimiter(name, { maxRequests: perHour, window: HOUR_MS });
	const spentInMemory = new Map<string, number>();
	const spentKey = (targetId: string) => redisKey(`${name}-spent`, targetId);

	return {
		isSpent: async (targetId) => {
			const key = spentKey(targetId);
			try {
				const redis = getRedis();
				if (redis) return (await redis.get(key)) !== null;
				const coordination = getCoordination();
				if (coordination) return (await coordination.get(key)) !== null;
			} catch {
				return false;
			}
			const until = spentInMemory.get(key);
			if (until !== undefined && until > Date.now()) return true;
			spentInMemory.delete(key);
			return false;
		},
		spend: async (targetId) => {
			const result = await limiter.limit(`${name}:${targetId}`);
			if (result.success && (result.remaining ?? 1) > 0) return;
			const key = spentKey(targetId);
			try {
				const redis = getRedis();
				if (redis) {
					await redis.set(key, "1", "PX", HOUR_MS);
					return;
				}
				const coordination = getCoordination();
				if (coordination) {
					await coordination.set(key, "1", HOUR_MS);
					return;
				}
			} catch {
				return;
			}
			if (spentInMemory.size >= 10_000) spentInMemory.clear();
			spentInMemory.set(key, Date.now() + HOUR_MS);
		},
	};
}
