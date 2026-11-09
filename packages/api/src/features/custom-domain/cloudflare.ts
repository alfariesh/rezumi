import z from "zod";
import { env } from "@rezumi/env/server";

const API = "https://api.cloudflare.com/client/v4";
const TIMEOUT_MS = 10_000;

export const isCloudflareSaasEnabled = () => Boolean(env.CLOUDFLARE_SAAS_ZONE_ID && env.CLOUDFLARE_SAAS_API_TOKEN);

/** What stops a hostname, in terms the app explains to the domain's owner. */
type CustomHostnameProblem = "dns_moved" | "blocked" | "caa" | "certificate";

export type CustomHostname = {
	id: string;
	hostname: string;
	status: string;
	sslStatus: string | null;
	problem: CustomHostnameProblem | null;
};

export type CloudflareFailure = "quota" | "auth" | "duplicate" | "rejected" | "unavailable";

/** Carries Cloudflare's numbers and never the request, so logging it can't leak the token. */
export class CloudflareSaasError extends Error {
	readonly failure: CloudflareFailure;

	constructor(failure: CloudflareFailure, status: number, code?: number) {
		super(`Cloudflare for SaaS: ${failure} (HTTP ${status}, code ${code ?? "none"})`);
		this.name = "CloudflareSaasError";
		this.failure = failure;
	}
}

const hostnameSchema = z.object({
	id: z.string(),
	hostname: z.string(),
	status: z.string().optional(),
	ssl: z
		.object({
			status: z.string().optional(),
			validation_errors: z.array(z.object({ message: z.string().optional() })).optional(),
		})
		.nullish(),
});
const QUOTA_EXCEEDED = 1405;
const DUPLICATE_HOSTNAME = 1406;

const failureOf = (status: number, code: number | undefined): CloudflareFailure => {
	if (code === QUOTA_EXCEEDED) return "quota";
	if (code === DUPLICATE_HOSTNAME || status === 409) return "duplicate";
	if (status === 401 || status === 403) return "auth";
	if (status === 429 || status >= 500) return "unavailable";
	return "rejected";
};

const FAILED_CERTIFICATE = new Set([
	"initializing_timed_out",
	"validation_timed_out",
	"issuance_timed_out",
	"deployment_timed_out",
	"deletion_timed_out",
	"expired",
	"deleted",
	"inactive",
]);

function problemOf(result: z.infer<typeof hostnameSchema>): CustomHostnameProblem | null {
	if (result.status === "moved" || result.status === "deleted" || result.status === "pending_deletion")
		return "dns_moved";
	if (result.status === "blocked" || result.status === "pending_blocked") return "blocked";
	if (result.ssl?.validation_errors?.some((error) => /\bcaa\b/i.test(error.message ?? ""))) return "caa";
	if (result.ssl?.status && FAILED_CERTIFICATE.has(result.ssl.status)) return "certificate";
	return null;
}

const toHostname = (result: z.infer<typeof hostnameSchema>): CustomHostname => ({
	id: result.id,
	hostname: result.hostname,
	status: result.status ?? "pending",
	sslStatus: result.ssl?.status ?? null,
	problem: problemOf(result),
});

/** Null for a 404 where the caller asks (the hostname is gone); every other refusal throws. */
async function call(method: string, path: string, options: { body?: unknown; missingIsNull?: boolean } = {}) {
	const response = await fetch(`${API}/zones/${env.CLOUDFLARE_SAAS_ZONE_ID}/custom_hostnames${path}`, {
		method,
		headers: {
			Authorization: `Bearer ${env.CLOUDFLARE_SAAS_API_TOKEN}`,
			...(options.body ? { "Content-Type": "application/json" } : {}),
		},
		...(options.body ? { body: JSON.stringify(options.body) } : {}),
		signal: AbortSignal.timeout(TIMEOUT_MS),
	}).catch(() => {
		// Whatever went wrong on the way (a timeout, the network), the cause can't hold anything worth more than this.
		throw new CloudflareSaasError("unavailable", 0);
	});
	if (options.missingIsNull && response.status === 404) return null;
	const payload = (await response.json().catch(() => null)) as {
		success?: boolean;
		result?: unknown;
		errors?: { code?: number }[];
	} | null;
	if (response.ok && payload?.success) return payload.result ?? {};
	throw new CloudflareSaasError(
		failureOf(response.status, payload?.errors?.[0]?.code),
		response.status,
		payload?.errors?.[0]?.code,
	);
}

function parseHostname(result: unknown): CustomHostname {
	const parsed = hostnameSchema.safeParse(result);
	if (!parsed.success) throw new CloudflareSaasError("unavailable", 200);
	return toHostname(parsed.data);
}

async function findCustomHostname(hostname: string): Promise<CustomHostname | null> {
	const result = await call("GET", `?hostname=${encodeURIComponent(hostname)}`);
	const found = (Array.isArray(result) ? result : []).map(parseHostname);
	// Exact: the id is stored against this domain, so another hostname matching the filter must not be taken for it.
	return found.find((row) => row.hostname === hostname) ?? null;
}

const SSL = { method: "http", type: "dv", settings: { min_tls_version: "1.2", http2: "on", tls_1_3: "on" } };

/** Makes the hostname, or finds the one already there: an earlier attempt, or a domain moving between accounts. */
export async function createCustomHostname(hostname: string): Promise<CustomHostname> {
	try {
		return parseHostname(await call("POST", "", { body: { hostname, ssl: SSL } }));
	} catch (error) {
		if (!(error instanceof CloudflareSaasError && error.failure === "duplicate")) throw error;
		const existing = await findCustomHostname(hostname);
		if (!existing) throw error;
		return existing;
	}
}

/** Runs the hostname's and certificate's validation again; the settings have to match the ones it was made with. */
export async function restartCustomHostnameValidation(id: string): Promise<CustomHostname | null> {
	const result = await call("PATCH", `/${encodeURIComponent(id)}`, { body: { ssl: SSL }, missingIsNull: true });
	return result === null ? null : parseHostname(result);
}

/** Null when Cloudflare no longer has it. */
export async function getCustomHostname(id: string): Promise<CustomHostname | null> {
	const result = await call("GET", `/${encodeURIComponent(id)}`, { missingIsNull: true });
	return result === null ? null : parseHostname(result);
}

/** Already gone counts as done. */
export async function deleteCustomHostname(id: string): Promise<void> {
	await call("DELETE", `/${encodeURIComponent(id)}`, { missingIsNull: true });
}
