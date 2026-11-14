import { isIP } from "node:net";
import { isAbsolute, join } from "node:path";
import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";
import { aiProviderSchema } from "@rezumi/ai/types";
import { findWorkspaceRoot } from "@rezumi/utils/monorepo.node";
import { deploymentEnvironment } from "./deployment";

const workspaceRoot = process.env.CLOUDFLARE === "1" ? null : findWorkspaceRoot();

if (workspaceRoot) {
	try {
		// Native stand-in for dotenv: existing process.env still wins over file values.
		process.loadEnvFile(join(workspaceRoot, ".env"));
	} catch (error) {
		// A missing .env is expected (e.g. production with injected env); anything else is a real problem.
		if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error;
	}
}

// ioredis authenticates as `AUTH <username> <password>`; a bare "redis://value@host" (userinfo with no colon) puts
// that value in the username slot and Redis rejects the resulting auth. Password-only servers (redis-server
// --requirepass) need an empty username — "redis://:<pass>@<host>" — or the built-in ACL user,
// "redis://default:<pass>@<host>". A named user with an explicitly empty password ("redis://user:@host") stays
// valid: Redis accepts `AUTH <user> ""` for passwordless (`nopass`) ACL users.
/** A comma-separated list, trimmed and without empty entries; each entry must match `item`. Empty when unset. */
const commaList = (item: z.ZodType<string, string>) =>
	z
		.string()
		.transform((value) =>
			value
				.split(",")
				.map((entry) => entry.trim())
				.filter(Boolean),
		)
		.pipe(z.array(item))
		.default([]);

/** A Dodo Payments product id, e.g. `pdt_0NrbytD9Enu0PTffpt7KM`. */
const dodoProductId = z
	.string()
	.trim()
	.regex(/^pdt_[A-Za-z0-9]+$/, "A Dodo Payments product id starts with pdt_.");

const REDIS_URL_USERINFO_MESSAGE =
	"REDIS_URL userinfo has no password field. For password-only auth (redis --requirepass) use " +
	"redis://:<password>@<host>; for ACL users use redis://<user>:<password>@<host> (default is the built-in user; " +
	"nopass users may keep the password empty, e.g. redis://<user>:@<host>).";

function hasCompleteUserinfo(raw: string): boolean {
	// Checks run even when the earlier URL-format check has already failed, so this must never throw:
	// a malformed URL reaching `new URL()` surfaces as an unhandled parse crash instead of a validation
	// error. Format errors are the URL check's job — only classify complete, parseable URLs here.
	if (!URL.canParse(raw)) return true;

	// The URL parser normalizes an empty password away ("redis://user:@host" parses like
	// "redis://user@host"), so the colon that separates the password field must be read from the raw
	// authority. Userinfo ends at the last "@" before the authority terminator; a userinfo without a
	// colon is exactly the password-in-username-slot shape ioredis mis-authenticates.
	const schemeEnd = raw.indexOf("://");
	if (schemeEnd === -1) return true; // no authority, so no userinfo
	const authorityStart = schemeEnd + 3;
	const terminator = raw.slice(authorityStart).search(/[/?#]/);
	const authority =
		terminator === -1 ? raw.slice(authorityStart) : raw.slice(authorityStart, authorityStart + terminator);
	const userinfoEnd = authority.lastIndexOf("@");
	// `userinfoEnd === 0` is an empty userinfo ("redis://@host") — ioredis reads it exactly like no
	// userinfo and sends no AUTH, so it passes the same way a missing "@" does.
	if (userinfoEnd <= 0) return true;
	return authority.slice(0, userinfoEnd).includes(":");
}

export const env = createEnv({
	server: {
		// Application
		CLOUDFLARE: z.stringbool().default(false),
		APP_URL: z.url({ protocol: /https?/ }),
		APP_REVISION: z
			.string()
			.regex(/^[a-f0-9]{40}$/)
			.optional(),
		WEB_FONT_BASE_URL: z
			.url({ protocol: /^https?$/ })
			.refine((value) => !/[?#]/.test(value), "Font base URL must not contain a query string or fragment")
			.optional(),
		ROOT_RESUME_ID: z
			.string()
			.trim()
			.transform((value) => value || undefined)
			.optional(),
		// A second domain serving the same public pages as APP_URL (resumes, /<username>, the home page), e.g.
		// https://rx.cv. Sign-in and the editor stay on APP_URL. When set, it's the address shown and shared.
		APP_ALIAS_URL: z.url({ protocol: /^https?$/ }).optional(),
		// The host custom domains point a CNAME at, e.g. domains.rx.cv. Unset turns custom domains off.
		CUSTOM_DOMAIN_TARGET: z
			.string()
			.trim()
			.toLowerCase()
			.regex(
				/^(?=.{1,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/,
				"Use a host name such as domains.example.com",
			)
			.optional(),
		// Sent by Traefik's HTTP provider to read the custom domains' routers; at least 32 characters.
		CUSTOM_DOMAIN_PROVIDER_SECRET: z.string().min(32).optional(),
		// Cloudflare for SaaS: with both set, a verified custom domain gets its hostname and HTTPS certificate through the
		// API, and addresses that aren't connected stop showing the app. One without the other leaves it off, so the zone ID
		// can sit in wrangler.jsonc before the token exists.
		CLOUDFLARE_SAAS_ZONE_ID: z
			.string()
			.trim()
			.regex(/^[a-f0-9]{32}$/, "Use the 32-character Zone ID from the zone's Overview page")
			.optional(),
		// An API token limited to "SSL and Certificates: Edit" on that zone. A secret; never commit it.
		CLOUDFLARE_SAAS_API_TOKEN: z.string().trim().min(1).optional(),
		// OlaCV API token: with FLAG_OLACV_SUGGESTION, Share checks which .cv names are free before suggesting one.
		OLACV_API_KEY: z.string().trim().min(1).optional(),
		SERVER_PORT: z.coerce.number().int().min(1).max(65535).default(3001),
		TRUSTED_PROXIES: commaList(
			z.string().refine((range) => {
				const [address, prefix, ...rest] = range.split("/");
				const family = isIP(address ?? "");
				return (
					family > 0 &&
					rest.length === 0 &&
					(prefix === undefined || (/^\d+$/.test(prefix) && Number(prefix) <= (family === 4 ? 32 : 128)))
				);
			}, "TRUSTED_PROXIES must contain comma-separated IP addresses or CIDRs"),
		),

		// Database
		DATABASE_URL: z.url({ protocol: /postgres(ql)?/ }),
		DATABASE_MIGRATION_URL: z.url({ protocol: /postgres(ql)?/ }).optional(),
		DATABASE_POOL_MAX: z.coerce.number().int().min(1).max(100).default(10),
		STRICT_SCHEMA_CHECK: z.stringbool().default(false),

		// Authentication
		// It keys every session, auth token and signed link: production needs a random value, not a word.
		AUTH_SECRET: z
			.string()
			.min(1)
			.refine((value) => process.env.NODE_ENV !== "production" || value.length >= 32, {
				message: "AUTH_SECRET must be at least 32 characters in production. Generate one with openssl rand -hex 32.",
			}),
		BETTER_AUTH_API_KEY: z.string().min(1).optional(),
		// Domain verification token from the OpenAI plugin portal, served at /.well-known/openai-apps-challenge.
		OPENAI_APPS_CHALLENGE_TOKEN: z.string().trim().min(1).optional(),
		// Native app association files (empty lists leave the endpoints disabled).
		MOBILE_IOS_APP_IDS: commaList(z.string().regex(/^[A-Z0-9]{10}\.[A-Za-z0-9.-]+$/)),
		MOBILE_ANDROID_PACKAGES: commaList(z.string().regex(/^[A-Za-z_]\w*(?:\.[A-Za-z_]\w*)+$/)),
		MOBILE_ANDROID_CERT_SHA256: commaList(z.string().regex(/^(?:[A-Fa-f0-9]{2}:){31}[A-Fa-f0-9]{2}$/)),

		// Social Auth (Apple): client secret is a pre-signed Apple JWT.
		APPLE_CLIENT_ID: z.string().min(1).optional(),
		APPLE_CLIENT_SECRET: z.string().min(1).optional(),

		// Social Auth (Google)
		GOOGLE_CLIENT_ID: z.string().min(1).optional(),
		GOOGLE_CLIENT_SECRET: z.string().min(1).optional(),

		// Social Auth (GitHub)
		GITHUB_CLIENT_ID: z.string().min(1).optional(),
		GITHUB_CLIENT_SECRET: z.string().min(1).optional(),

		// Social Auth (LinkedIn)
		LINKEDIN_CLIENT_ID: z.string().min(1).optional(),
		LINKEDIN_CLIENT_SECRET: z.string().min(1).optional(),

		// Custom OAuth Provider
		OAUTH_PROVIDER_NAME: z.string().min(1).optional(),
		OAUTH_CLIENT_ID: z.string().min(1).optional(),
		OAUTH_CLIENT_SECRET: z.string().min(1).optional(),
		OAUTH_DISCOVERY_URL: z.url({ protocol: /https?/ }).optional(),
		OAUTH_AUTHORIZATION_URL: z.url({ protocol: /https?/ }).optional(),
		OAUTH_TOKEN_URL: z.url({ protocol: /https?/ }).optional(),
		OAUTH_USER_INFO_URL: z.url({ protocol: /https?/ }).optional(),
		OAUTH_SCOPES: z
			.string()
			.min(1)
			.transform((value) => value.split(" "))
			.default(["openid", "profile", "email"]),

		// Email (SMTP)
		SMTP_HOST: z.string().min(1).optional(),
		SMTP_PORT: z.coerce.number().int().min(1).max(65535).default(587),
		SMTP_USER: z.string().min(1).optional(),
		SMTP_PASS: z.string().min(1).optional(),
		SMTP_FROM: z.string().min(1).optional(),
		SMTP_SECURE: z.stringbool().default(false),

		// Storage (Optional)
		STORAGE_BACKEND: z.enum(["local", "s3", "blob", "r2"]),
		STORAGE_HEALTHCHECK_TIMEOUT_MS: z.coerce.number().int().positive().max(2_147_483_647).default(5_000),
		BLOB_READ_WRITE_TOKEN: z.string().min(1).optional(),
		BLOB_STORE_ID: z.string().min(1).optional(),
		DEPLOYMENT_NAMESPACE: z.string().regex(/^[a-zA-Z0-9._-]+$/),
		LOCAL_STORAGE_PATH: z.string().min(1).refine(isAbsolute, "LOCAL_STORAGE_PATH must be an absolute path").optional(),
		S3_ACCESS_KEY_ID: z.string().min(1).optional(),
		S3_SECRET_ACCESS_KEY: z.string().min(1).optional(),
		S3_REGION: z.string().default("us-east-1"),
		S3_ENDPOINT: z.url({ protocol: /https?/ }).optional(),
		S3_BUCKET: z.string().min(1).optional(),
		S3_FORCE_PATH_STYLE: z.stringbool().default(false),

		// AI Agent Workspace (optional until the agent feature is used)
		REDIS_URL: z
			.url({ protocol: /redis(s)?/ })
			.refine(hasCompleteUserinfo, REDIS_URL_USERINFO_MESSAGE)
			.optional(),
		ENCRYPTION_SECRET: z.string().min(32, "ENCRYPTION_SECRET must be at least 32 characters").optional(),
		CRON_SECRET: z.string().min(16, "CRON_SECRET must be at least 16 characters").optional(),

		// Optional search and enhanced reading; custom URLs are operator-controlled Firecrawl services.
		WEB_ACCESS_PROVIDER: z.enum(["firecrawl", "tavily", "exa"]).optional(),
		WEB_ACCESS_API_KEY: z.string().trim().min(1).optional(),
		WEB_ACCESS_API_URL: z.url({ protocol: /^https?$/ }).optional(),
		// Optional operator-controlled SearXNG that takes over web search only; reading still uses the connection above.
		WEB_SEARCH_SEARXNG_URL: z.url({ protocol: /^https?$/ }).optional(),
		// Filling the Profile from outside sources. Without an Apify token, LinkedIn profiles can't be read; the actor is
		// "owner~name" (or "owner/name"). GitHub is read without a token unless one is set (higher rate limits).
		APIFY_TOKEN: z.string().trim().min(1).optional(),
		APIFY_LINKEDIN_ACTOR: z
			.string()
			.trim()
			.regex(/^[\w.-]+[~/][\w.-]+$/, "APIFY_LINKEDIN_ACTOR must be an Actor name such as owner~actor-name.")
			.transform((value) => value.replace("/", "~"))
			.default("harvestapi~linkedin-profile-scraper"),
		GITHUB_API_TOKEN: z.string().trim().min(1).optional(),
		AI_PROVIDER: aiProviderSchema.optional(),
		AI_MODEL: z.string().trim().min(1).optional(),
		AI_API_KEY: z.string().trim().min(1).optional(),
		AI_BASE_URL: z.url({ protocol: /^https?$/ }).optional(),
		// What the server AI costs, in US dollars per million tokens, to record Rezumi AI spending. Optional.
		AI_COST_INPUT_USD_PER_MTOK: z.coerce.number().nonnegative().optional(),
		AI_COST_OUTPUT_USD_PER_MTOK: z.coerce.number().nonnegative().optional(),

		// Feature Flags
		FLAG_DISABLE_SIGNUPS: z.stringbool().default(false),
		FLAG_DISABLE_EMAIL_AUTH: z.stringbool().default(false),
		FLAG_ENABLE_GUEST_LOGIN: z.stringbool().default(false),
		FLAG_DISABLE_IMAGE_PROCESSING: z.stringbool().default(false),
		FLAG_DISABLE_API_RATE_LIMIT: z.stringbool().default(false),
		FLAG_ALLOW_UNSAFE_AI_BASE_URL: z.stringbool().default(false),
		FLAG_ALLOW_UNSAFE_OAUTH_REDIRECT_URI: z.stringbool().default(false),
		FLAG_OLACV_SUGGESTION: z.stringbool().default(false),
		// Paid plans: off (nothing changes), admins (only accounts with the admin role see and are bound by them), on.
		BILLING_MODE: z.enum(["off", "admins", "on"]).default("off"),
		// Closes new purchases for a while; passes and credits already bought keep working.
		BILLING_CHECKOUT_PAUSED: z.stringbool().default(false),
		// Where billing alerts and the daily sales summary go: the owner's address. Without it they are only kept for the
		// admin page.
		BILLING_ALERT_EMAIL: z.email().optional(),
		// The oldest browser extension version the API still serves (x.y.z). Older ones get EXTENSION_OUTDATED and ask the
		// person to update. An emergency brake for a broken release; unset serves every version.
		EXTENSION_MIN_VERSION: z
			.string()
			.trim()
			.regex(/^\d+\.\d+\.\d+$/, "Use a version like 0.2.0.")
			.optional(),
		// Dodo Payments (merchant of record) sells the subscriptions. Without the API key checkout is unavailable; without
		// the webhook key the webhook endpoint is a 404 and payments only arrive through the billing job's checks.
		DODO_PAYMENTS_ENVIRONMENT: z.enum(["test_mode", "live_mode"]).optional(),
		// An API key from the same mode (Developer → API Keys).
		DODO_PAYMENTS_API_KEY: z.string().trim().min(1).optional(),
		// The signing secret of the webhook endpoint pointed at /api/payments/dodo/webhook (Developer → Webhooks).
		DODO_PAYMENTS_WEBHOOK_KEY: z.string().trim().min(1).optional(),
		// The four products Rezumi sells, one per plan and interval; each has a USD price and a fixed IDR price.
		DODO_PAYMENTS_PRODUCT_PLUS_MONTHLY: dodoProductId.optional(),
		DODO_PAYMENTS_PRODUCT_PLUS_YEARLY: dodoProductId.optional(),
		DODO_PAYMENTS_PRODUCT_PRO_AI_MONTHLY: dodoProductId.optional(),
		DODO_PAYMENTS_PRODUCT_PRO_AI_YEARLY: dodoProductId.optional(),
		// Sumopod (sumopod.com → Managed Payment) takes QRIS payments for the prepaid passes sold in Indonesia. Without the
		// API key QRIS isn't offered; visitors from Indonesia can still pay by card. Sandbox and live keep separate keys,
		// webhook settings and API addresses.
		SUMOPOD_ENVIRONMENT: z.enum(["sandbox", "live"]).optional(),
		// The project's API key from the same mode (Managed Payment → Settings → API Key).
		SUMOPOD_API_KEY: z.string().trim().min(1).optional(),
		// The webhook signing secret (whsec_…) made when the webhook URL https://<app>/api/payments/sumopod/webhook is
		// saved (Managed Payment → Settings → Webhook). Without it the endpoint answers 404 and QRIS payments only arrive
		// through the billing job's status checks.
		SUMOPOD_WEBHOOK_SECRET: z
			.string()
			.trim()
			.regex(/^whsec_[A-Za-z0-9+/=]+$/, "Expected Sumopod's webhook signing secret (whsec_…).")
			.optional(),

		// Web portfolios at /<username>: off (nothing changes; the short link keeps opening the primary resume), admins
		// (only accounts with the admin role can build and publish one), on (every signed-up account).
		PORTFOLIO_MODE: z.enum(["off", "admins", "on"]).default("off"),
		// Cloudflare Turnstile keeps bots off the portfolio contact form; without both keys the form isn't offered.
		TURNSTILE_SITE_KEY: z.string().trim().min(1).optional(),
		TURNSTILE_SECRET_KEY: z.string().trim().min(1).optional(),
	},
	runtimeEnv: deploymentEnvironment(process.env),
	emptyStringAsUndefined: true,
});

if (
	(env.WEB_ACCESS_PROVIDER || env.WEB_ACCESS_API_KEY || env.WEB_ACCESS_API_URL) &&
	(!env.WEB_ACCESS_PROVIDER ||
		(!env.WEB_ACCESS_API_KEY && !(env.WEB_ACCESS_PROVIDER === "firecrawl" && env.WEB_ACCESS_API_URL)) ||
		(env.WEB_ACCESS_PROVIDER !== "firecrawl" && env.WEB_ACCESS_API_URL))
) {
	throw new Error(
		"Web access requires WEB_ACCESS_PROVIDER and WEB_ACCESS_API_KEY; only Firecrawl accepts WEB_ACCESS_API_URL, which may be keyless.",
	);
}

if (
	(env.AI_PROVIDER || env.AI_MODEL || env.AI_API_KEY || env.AI_BASE_URL) &&
	(!env.AI_PROVIDER || !env.AI_MODEL || (!env.AI_API_KEY && env.AI_PROVIDER !== "ollama"))
) {
	throw new Error("Server AI requires AI_PROVIDER, AI_MODEL and AI_API_KEY (the key is optional for Ollama).");
}

// `.env.example` is public, and production Compose loads it as the base `env_file`: its secrets would let anyone sign
// auth tokens or read stored provider keys.
if (process.env.NODE_ENV === "production") {
	for (const [name, value] of [
		["AUTH_SECRET", env.AUTH_SECRET],
		["ENCRYPTION_SECRET", env.ENCRYPTION_SECRET],
	] as const) {
		if (value?.startsWith("change-me-to-a-secure-"))
			throw new Error(`${name} still has the example value from .env.example. Set a random one: openssl rand -hex 32`);
	}
}

// A key without its mode, or a half-listed catalog, fails payments one by one; stop at startup instead.
if (env.DODO_PAYMENTS_API_KEY) {
	const mode = env.DODO_PAYMENTS_ENVIRONMENT;
	if (!mode) throw new Error("DODO_PAYMENTS_API_KEY needs DODO_PAYMENTS_ENVIRONMENT set to test_mode or live_mode.");
	// Keys that name their mode must match it: a test key never reaches live mode, nor the other way round.
	const keyMode = /^dodo_(test|live)_/.exec(env.DODO_PAYMENTS_API_KEY)?.[1];
	if (keyMode && `${keyMode}_mode` !== mode)
		throw new Error(`DODO_PAYMENTS_API_KEY is a ${keyMode} key, but DODO_PAYMENTS_ENVIRONMENT is ${mode}.`);
	const products = [
		env.DODO_PAYMENTS_PRODUCT_PLUS_MONTHLY,
		env.DODO_PAYMENTS_PRODUCT_PLUS_YEARLY,
		env.DODO_PAYMENTS_PRODUCT_PRO_AI_MONTHLY,
		env.DODO_PAYMENTS_PRODUCT_PRO_AI_YEARLY,
	];
	if (products.some((id) => !id))
		throw new Error(
			"DODO_PAYMENTS_API_KEY needs all four DODO_PAYMENTS_PRODUCT_* ids (plus and pro-ai, monthly and yearly) from the same mode.",
		);
	if (new Set(products).size !== products.length)
		throw new Error("Each DODO_PAYMENTS_PRODUCT_* must be a different product.");
} else if (env.DODO_PAYMENTS_WEBHOOK_KEY) {
	throw new Error("DODO_PAYMENTS_WEBHOOK_KEY is set without DODO_PAYMENTS_API_KEY.");
}

// Sumopod's sandbox and live modes answer at different addresses: a key without its mode would reach the wrong one.
if (env.SUMOPOD_API_KEY && !env.SUMOPOD_ENVIRONMENT)
	throw new Error("SUMOPOD_API_KEY needs SUMOPOD_ENVIRONMENT set to sandbox or live.");
if (env.SUMOPOD_WEBHOOK_SECRET && !env.SUMOPOD_API_KEY)
	throw new Error("SUMOPOD_WEBHOOK_SECRET is set without SUMOPOD_API_KEY.");

if (env.AI_PROVIDER === "openai-compatible" && !env.AI_BASE_URL) {
	throw new Error("The openai-compatible server AI provider requires AI_BASE_URL.");
}
