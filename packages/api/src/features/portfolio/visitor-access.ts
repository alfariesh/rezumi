import type { PublicPortfolio } from "./public";
import { createHmac } from "node:crypto";
import { compare, hash } from "bcryptjs";
import { parseCookies } from "better-auth/cookies";
import { and, eq, isNotNull } from "drizzle-orm";
import { db } from "@rezumi/db/client";
import { getCoordination } from "@rezumi/db/coordination";
import { getRedis, redisKey } from "@rezumi/db/redis";
import * as schema from "@rezumi/db/schema";
import { env } from "@rezumi/env/server";
import { rateLimitConfig } from "@rezumi/utils/rate-limit";
import { generateId } from "@rezumi/utils/string";
import { createRateLimiter } from "../../redis";
import { safeEquals } from "../resume/access";
import { ownerIsNotBanned } from "../resume/access-policy";
import { rateLimitAddress } from "./client-address";
import { isPortfolioOwner, portfolioOwnsProfilePath } from "./public";

/**
 * Visitors of a portfolio with a password (Phase 13, B16), like a resume with one: a correct password grants a signed
 * cookie for 12 hours, per browser and per host (no `Domain`, so a custom domain has its own). The cookie is bound to
 * the password's hash, so a new password takes every visitor's access away. Neither the password nor its hash is ever
 * logged or sent anywhere.
 */

export const PORTFOLIO_ACCESS_TTL_SECONDS = 12 * 60 * 60;

const cookieName = (portfolioId: string) => `portfolio_access_${portfolioId}`;

/** A key of this purpose's own, derived from AUTH_SECRET, so these tokens can't stand in for another use of it. */
const sign = (parts: unknown[]) =>
	createHmac("sha256", createHmac("sha256", env.AUTH_SECRET).update("rezumi:portfolio-access:v1").digest())
		.update(JSON.stringify(parts))
		.digest("hex");

const token = (portfolioId: string, passwordHash: string, expires: number) =>
	`${expires}.${sign([portfolioId, passwordHash, expires])}`;

/** Whether the request carries a valid, unexpired access cookie for this portfolio and its current password. */
export function hasPortfolioAccess(headers: Headers, portfolioId: string, passwordHash: string | null): boolean {
	if (!passwordHash) return false;
	const value = parseCookies(headers.get("cookie") ?? "").get(cookieName(portfolioId));
	if (!value) return false;
	const match = /^(\d+)\.([\da-f]{64})$/.exec(value);
	if (!match) return false;
	const expires = Number(match[1]);
	if (!Number.isSafeInteger(expires) || expires <= Date.now()) return false;
	return safeEquals(value, token(portfolioId, passwordHash, expires));
}

/** Sets the access cookie on a response, for 12 hours, on this host only. */
export function grantPortfolioAccess(responseHeaders: Headers, portfolioId: string, passwordHash: string): void {
	const expires = Date.now() + PORTFOLIO_ACCESS_TTL_SECONDS * 1000;
	const secure = env.APP_URL.startsWith("https") ? "; Secure" : "";
	responseHeaders.append(
		"Set-Cookie",
		`${cookieName(portfolioId)}=${token(portfolioId, passwordHash, expires)}; Path=/; Max-Age=${PORTFOLIO_ACCESS_TTL_SECONDS}; SameSite=Lax; HttpOnly${secure}`,
	);
}

/**
 * Whether a visitor may see the portfolio: `open` without a password, for its signed-in owner (on the app's domain;
 * a custom domain has no session), or with a valid access cookie; `locked` otherwise.
 */
export async function portfolioAccess(
	portfolio: Pick<PublicPortfolio, "id" | "userId" | "passwordHash">,
	headers: Headers,
): Promise<"open" | "locked"> {
	if (!portfolio.passwordHash) return "open";
	if (hasPortfolioAccess(headers, portfolio.id, portfolio.passwordHash)) return "open";
	return (await isPortfolioOwner(portfolio, headers)) ? "open" : "locked";
}

const attemptLimiter = createRateLimiter("portfolioPasswordAttempts", rateLimitConfig.orpc.resumePassword);

/**
 * Wrong passwords one portfolio takes per hour from everyone together, so a dictionary spread over many addresses (a
 * /48, a botnet) runs out too. Only wrong tries spend it; once it's spent, every try (a right one too) is `limited`
 * until the hour is over.
 */
export const PORTFOLIO_PASSWORD_FAILURES_PER_HOUR = 100;
const HOUR_MS = 60 * 60 * 1000;
const failureLimiter = createRateLimiter("portfolioPasswordFailures", {
	maxRequests: PORTFOLIO_PASSWORD_FAILURES_PER_HOUR,
	window: HOUR_MS,
});

// Where no shared store is configured, the spent budget is remembered in this process, like the limiters.
const spentInMemory = new Map<string, number>();

const spentKey = (portfolioId: string) => redisKey("portfolio-password-spent", portfolioId);

/** Whether the portfolio's budget of wrong tries is spent for now. A store that fails reads as not spent. */
async function isBudgetSpent(portfolioId: string): Promise<boolean> {
	const key = spentKey(portfolioId);
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
}

/** Spends one of the portfolio's wrong tries; the 100th marks the budget spent for an hour. */
async function spendWrongTry(portfolioId: string): Promise<void> {
	const result = await failureLimiter.limit(`portfolio-password-failures:${portfolioId}`);
	if (result.success && (result.remaining ?? 1) > 0) return;
	const key = spentKey(portfolioId);
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
}

let unusedHash: Promise<string> | undefined;
/** A hash no password matches, so a miss costs the same bcrypt work as a wrong password. */
const unusedPasswordHash = () => (unusedHash ??= hash(generateId(), 10));

/**
 * Checks a visitor's password for the portfolio at `/<username>` and, when right, sets the access cookie. Two budgets:
 * 5 tries per 10 minutes per address (an IPv6 address by its /64) and portfolio, and 100 wrong tries per hour per
 * portfolio from all addresses together (`PORTFOLIO_PASSWORD_FAILURES_PER_HOUR`); either one spent answers `limited`. An
 * address without a portfolio, or one without a password, answers `wrong` after the same bcrypt work, so timing tells
 * nothing.
 */
export async function verifyPortfolioPassword(input: {
	username: string;
	password: string;
	trustedClient?: string | undefined;
	responseHeaders: Headers;
}): Promise<"ok" | "wrong" | "limited"> {
	const [portfolio] = await db
		.select({ id: schema.portfolio.id, password: schema.portfolio.password })
		.from(schema.portfolio)
		.innerJoin(schema.user, eq(schema.portfolio.userId, schema.user.id))
		.where(
			and(
				eq(schema.user.username, input.username.toLowerCase()),
				portfolioOwnsProfilePath(schema.user.id),
				ownerIsNotBanned(),
				isNotNull(schema.portfolio.password),
			),
		)
		.limit(1);
	const client = rateLimitAddress(input.trustedClient) ?? "unknown";
	const key = `portfolio-password:${portfolio?.id ?? "missing"}:ip:${client}`;
	const limits = !env.FLAG_DISABLE_API_RATE_LIMIT;
	if (limits && !(await attemptLimiter.limit(key)).success) return "limited";
	if (limits && portfolio && (await isBudgetSpent(portfolio.id))) return "limited";
	const length = input.password.length;
	const passwordHash = portfolio?.password ?? (await unusedPasswordHash());
	const valid = length >= 6 && length <= 64 && (await compare(input.password, passwordHash));
	if (!portfolio?.password) return "wrong";
	if (!valid) {
		if (limits) await spendWrongTry(portfolio.id);
		return "wrong";
	}
	grantPortfolioAccess(input.responseHeaders, portfolio.id, portfolio.password);
	return "ok";
}

/**
 * How long a file address handed to a visitor of a locked portfolio works (Phase 13, B16 security review): the end of
 * the next 12-hour window, so between 12 and 24 hours, in line with the 12-hour access cookie, and the same address
 * for everyone within a window (rendered pages stay cacheable in the server's own memory).
 */
const FILE_TOKEN_WINDOW_MS = PORTFOLIO_ACCESS_TTL_SECONDS * 1000;

const signFile = (key: string, passwordHash: string, expires: number) =>
	createHmac("sha256", createHmac("sha256", env.AUTH_SECRET).update("rezumi:portfolio-file:v1").digest())
		.update(JSON.stringify([key, passwordHash, expires]))
		.digest("hex");

/**
 * A token for one of a locked portfolio's files, for a visitor who opened it: `<expires>.<hmac>` over the file's key,
 * the password's hash and the expiry. A new password, or another file, makes it worthless.
 */
export function portfolioFileToken(key: string, passwordHash: string, now = Date.now()): string {
	const expires = (Math.floor(now / FILE_TOKEN_WINDOW_MS) + 2) * FILE_TOKEN_WINDOW_MS;
	return `${expires}.${signFile(key, passwordHash, expires)}`;
}

/** Whether a file token is valid for this file and the portfolio's current password, and not expired. */
export function isValidPortfolioFileToken(
	key: string,
	passwordHash: string,
	value: string | null,
	now = Date.now(),
): boolean {
	const match = value ? /^(\d+)\.([\da-f]{64})$/.exec(value) : null;
	if (!match || !value) return false;
	const expires = Number(match[1]);
	if (!Number.isSafeInteger(expires) || expires <= now) return false;
	return safeEquals(value, `${expires}.${signFile(key, passwordHash, expires)}`);
}

/** The query parameter a locked portfolio's file address carries its token in. */
export const PORTFOLIO_FILE_TOKEN_PARAM = "access";
