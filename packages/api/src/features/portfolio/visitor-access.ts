import type { PublicPortfolio } from "./public";
import { createHmac } from "node:crypto";
import { compare, hash } from "bcryptjs";
import { parseCookies } from "better-auth/cookies";
import { and, eq, isNotNull } from "drizzle-orm";
import { db } from "@rezumi/db/client";
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

let unusedHash: Promise<string> | undefined;
/** A hash no password matches, so a miss costs the same bcrypt work as a wrong password. */
const unusedPasswordHash = () => (unusedHash ??= hash(generateId(), 10));

/**
 * Checks a visitor's password for the portfolio at `/<username>` and, when right, sets the access cookie. 5 tries per
 * 10 minutes per address (an IPv6 address by its /64) and portfolio. An address without a portfolio, or one without a
 * password, answers `wrong` after the same bcrypt work, so timing tells nothing.
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
	if (!env.FLAG_DISABLE_API_RATE_LIMIT && !(await attemptLimiter.limit(key)).success) return "limited";
	const length = input.password.length;
	const passwordHash = portfolio?.password ?? (await unusedPasswordHash());
	const valid = length >= 6 && length <= 64 && (await compare(input.password, passwordHash));
	if (!portfolio?.password || !valid) return "wrong";
	grantPortfolioAccess(input.responseHeaders, portfolio.id, portfolio.password);
	return "ok";
}
