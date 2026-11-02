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
 * The redirect URIs Rezumi's mobile apps register (apps/mobile/src/auth/oauth.ts): the official host's
 * `/auth/native-callback`, this server's own (the same in production), and the private-use scheme development builds
 * use against a local server.
 */
export function firstPartyRedirectUris(appUrl = env.APP_URL): ReadonlySet<string> {
	return new Set([
		`https://${OFFICIAL_APP_HOST}/auth/native-callback`,
		`https://${new URL(appUrl).host}/auth/native-callback`,
		"app.rezumi:/auth/native-callback",
	]);
}

/**
 * Whether a request comes from Rezumi itself: a web session, or an OAuth client that can only send users back to
 * the mobile apps' callback. Anyone could register such a client for their own account; the plan rule accepts that,
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
 * API keys and third-party OAuth/MCP clients need `automationApi`. Rezumi's web sessions and mobile apps never do.
 * Reads nothing while billing is off.
 */
export async function assertAutomationAccess(authentication: Authentication | null | undefined) {
	if (!authentication || authentication.method === "session" || getBillingMode() === "off") return;
	// The mobile apps send most bearer requests; one lookup settles them before reading the plan.
	if (await isFirstPartyClient(authentication)) return;
	const entitlements = await getEntitlements(authentication.user.id);
	if (entitlements.enabled && !entitlements.features.automationApi)
		throw planFeatureRequired("automationApi", entitlements.planId);
}
