import type { AddResult, AddRule } from "@rezumi/db/coordination";
import { getCoordination } from "@rezumi/db/coordination";
import { getRedis, redisKey } from "@rezumi/db/redis";

/**
 * Running totals shared by every server instance: job searches a person made today, what the providers cost today,
 * and the short lock that lets one request fill a cache entry (`02-teknis.md` sections 7–8). The Workers deployment
 * keeps them in the `Coordination` Durable Object (`add`), a Node server in Redis when `REDIS_URL` is set, and otherwise
 * in this process. A store that fails falls back to this process, so a broken store never stops searching.
 */

export type JobCounters = {
	/** Adds a whole `amount` (0 reads) to the total under `key`; refused, and nothing added, past `rule.max`. */
	add: (key: string, amount: number, rule: AddRule) => Promise<AddResult>;
};

// KEYS[1] total; ARGV amount, window ms, max (-1 for none). Returns allowed (1/0), total, ms left.
const ADD_SCRIPT = `
local current = tonumber(redis.call('GET', KEYS[1]) or '0')
local amount = tonumber(ARGV[1])
local max = tonumber(ARGV[3])
if max >= 0 and current + amount > max then
	return {0, current, redis.call('PTTL', KEYS[1])}
end
if amount > 0 then
	current = redis.call('INCRBY', KEYS[1], amount)
	if redis.call('PTTL', KEYS[1]) < 0 then redis.call('PEXPIRE', KEYS[1], ARGV[2]) end
end
return {1, current, redis.call('PTTL', KEYS[1])}
`;

const MAX_MEMORY_KEYS = 10_000;

/** Totals kept in this process only. */
export function memoryCounters(now: () => number = Date.now): JobCounters {
	const totals = new Map<string, { total: number; expiresAt: number }>();
	return {
		// oxlint-disable-next-line require-await -- The counter contract is async; this store answers at once.
		add: async (key, amount, rule) => {
			const at = now();
			const stored = totals.get(key);
			const entry = stored && stored.expiresAt > at ? stored : undefined;
			const total = entry?.total ?? 0;
			const expiresAt = entry?.expiresAt ?? at + rule.window;
			if (rule.max !== undefined && total + amount > rule.max) return { allowed: false, total, reset: expiresAt };
			if (amount > 0) {
				if (!entry && totals.size >= MAX_MEMORY_KEYS) {
					for (const [stale, value] of totals) if (value.expiresAt <= at) totals.delete(stale);
					if (totals.size >= MAX_MEMORY_KEYS) totals.clear();
				}
				totals.set(key, { total: total + amount, expiresAt });
			}
			return { allowed: true, total: total + amount, reset: expiresAt };
		},
	};
}

const local = memoryCounters();

async function sharedAdd(key: string, amount: number, rule: AddRule): Promise<AddResult | undefined> {
	const redis = getRedis();
	if (redis) {
		const [allowed, total, left] = (await redis.eval(
			ADD_SCRIPT,
			1,
			redisKey("jobs", key),
			amount,
			Math.ceil(rule.window),
			rule.max ?? -1,
		)) as [number, number, number];
		return { allowed: allowed === 1, total, reset: Date.now() + (left > 0 ? left : rule.window) };
	}
	const coordination = getCoordination();
	if (coordination) return coordination.add(redisKey("jobs", key), amount, rule);
	return undefined;
}

/** The counters this server uses. */
export const jobCounters: JobCounters = {
	async add(key, amount, rule) {
		try {
			const shared = await sharedAdd(key, amount, rule);
			if (shared) return shared;
		} catch (error) {
			console.error("[jobs] Shared counter unavailable; counting in this process", error);
		}
		return local.add(key, amount, rule);
	},
};
