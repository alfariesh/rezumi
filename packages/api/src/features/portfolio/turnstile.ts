import { env } from "@rezumi/env/server";

const SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const TOKEN_MAX_LENGTH = 2048;

/** Cloudflare's published test secrets; they always answer with the hostname `example.com`. */
const TEST_SECRET = /^[123]x0+/;

/** Whether the contact form can work here: both Turnstile keys are set. */
export const isContactFormConfigured = () => Boolean(env.TURNSTILE_SITE_KEY && env.TURNSTILE_SECRET_KEY);

const appHosts = () =>
	new Set([env.APP_URL, env.APP_ALIAS_URL].flatMap((address) => (address ? [new URL(address).hostname] : [])));

/**
 * Asks Turnstile whether a token is genuine, for this site, and unused. False for anything else, a timeout included: a
 * form that can't be checked isn't sent. Neither the token nor the secret ever goes to a log.
 */
export async function verifyTurnstileToken(token: string, remoteIp?: string): Promise<boolean> {
	const secret = env.TURNSTILE_SECRET_KEY;
	if (!secret || !token || token.length > TOKEN_MAX_LENGTH) return false;
	const body = new URLSearchParams({ secret, response: token, ...(remoteIp ? { remoteip: remoteIp } : {}) });
	try {
		const response = await fetch(SITEVERIFY_URL, {
			method: "POST",
			headers: { "Content-Type": "application/x-www-form-urlencoded" },
			body,
			signal: AbortSignal.timeout(10_000),
		});
		if (!response.ok) return false;
		const result = (await response.json()) as { success?: unknown; hostname?: unknown };
		if (result.success !== true) return false;
		if (TEST_SECRET.test(secret)) return true;
		return typeof result.hostname === "string" && appHosts().has(result.hostname);
	} catch {
		console.error("[portfolio] The Turnstile check could not be completed.");
		return false;
	}
}
