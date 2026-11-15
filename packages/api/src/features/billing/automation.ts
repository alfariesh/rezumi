import { eq } from "drizzle-orm";
import { db } from "@rezumi/db/client";
import * as schema from "@rezumi/db/schema";
import { env } from "@rezumi/env/server";
import { getBillingMode, getEntitlements } from "./entitlements";
import { planFeatureRequired } from "./limits";

type Authentication = { user: { id: string }; method: "apiKey" | "bearer" | "session"; clientId?: string | undefined };

/** The host Rezumi's own iOS and Android apps are associated with; their OAuth callback lands there for every server. */
const OFFICIAL_APP_HOST = "rezumi.app";

/**
 * The Rezumi browser extension's store ids (Chrome Web Store, Edge Add-ons). Its OAuth redirect is
 * `https://<id>.chromiumapp.org/` (`chrome.identity.getRedirectURL()`), which only that extension can receive.
 * .agents/docs/plans/plugin-browser/02-teknis.md §15.
 */
export const EXTENSION_IDS = ["fiogmglhgeiaaeajahbpmmehgmojbjjo", "jnemleffcmnbkcmmjnkbicdhidedffnd"] as const;

/**
 * The redirect URIs Rezumi's own apps register: the mobile apps (apps/mobile/src/auth/oauth.ts) use the official
 * host's `/auth/native-callback`, this server's own (the same in production), and the private-use scheme development
 * builds use against a local server; the browser extension uses its store ids' `chromiumapp.org` addresses.
 */
export function firstPartyRedirectUris(appUrl = env.APP_URL): ReadonlySet<string> {
	return new Set([
		`https://${OFFICIAL_APP_HOST}/auth/native-callback`,
		`https://${new URL(appUrl).host}/auth/native-callback`,
		"app.rezumi:/auth/native-callback",
		...EXTENSION_IDS.map((id) => `https://${id}.chromiumapp.org/`),
	]);
}

/**
 * Whether a request comes from Rezumi itself: a web session, or an OAuth client that can only send users back to
 * Rezumi's own apps (mobile callback, browser extension). Anyone could register such a client for their own account; the plan rule accepts that,
 * since it still meets the API's rate limits.
 */
export async function isFirstPartyClient(authentication: Authentication): Promise<boolean> {
	if (authentication.method === "session") return true;
	if (authentication.method !== "bearer" || !authentication.clientId) return false;
	const [client] = await db
		.select({ redirectUris: schema.oauthClient.redirectUris })
		.from(schema.oauthClient)
		.where(eq(schema.oauthClient.clientId, authentication.clientId))
		.limit(1);
	const allowed = firstPartyRedirectUris();
	return Boolean(client?.redirectUris.length) && Boolean(client?.redirectUris.every((uri) => allowed.has(uri)));
}

/**
 * API keys and third-party OAuth/MCP clients need `automationApi`. Rezumi's web sessions, mobile apps and browser
 * extension never do.
 * Reads nothing while billing is off.
 */
export async function assertAutomationAccess(authentication: Authentication | null | undefined) {
	if (!authentication || authentication.method === "session" || getBillingMode() === "off") return;
	// The mobile apps and the browser extension send most bearer requests; one lookup settles them before the plan.
	if (await isFirstPartyClient(authentication)) return;
	const entitlements = await getEntitlements(authentication.user.id);
	if (entitlements.enabled && !entitlements.features.automationApi)
		throw planFeatureRequired("automationApi", entitlements.planId);
}
