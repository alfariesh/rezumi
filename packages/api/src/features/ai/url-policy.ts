import type { AIProvider } from "@rezumi/ai/types";
import { AI_PROVIDER_DEFAULT_BASE_URLS } from "@rezumi/ai/types";
import { env } from "@rezumi/env/server";
import { fetchPublic, isPrivateOrLoopbackHost, parseUrl } from "@rezumi/utils/url-security.node";

type ResolveAiBaseUrlInput = {
	provider: AIProvider;
	baseURL?: string | null;
};

function assertSafeUrl(input: string, errorCode: string, options?: { allowUnsafe?: boolean }) {
	const parsed = parseUrl(input);
	if (!parsed) throw new Error(errorCode);
	if (parsed.username || parsed.password) throw new Error(errorCode);
	if (parsed.protocol !== "http:" && parsed.protocol !== "https:") throw new Error(errorCode);

	if (!options?.allowUnsafe) {
		if (parsed.protocol !== "https:") throw new Error(errorCode);
		if (isPrivateOrLoopbackHost(parsed.hostname)) throw new Error(errorCode);
	}

	parsed.hash = "";
	return parsed.toString();
}

export function resolveAiBaseUrl(input: ResolveAiBaseUrlInput) {
	const baseURL = input.baseURL?.trim() || AI_PROVIDER_DEFAULT_BASE_URLS[input.provider];
	if (!baseURL) throw new Error("INVALID_AI_BASE_URL");

	return assertSafeUrl(baseURL, "INVALID_AI_BASE_URL", { allowUnsafe: env.FLAG_ALLOW_UNSAFE_AI_BASE_URL });
}

/**
 * Where a user chooses the endpoint, requests may only reach public addresses, checked when each connection opens, and
 * never follow redirects. The server's own AI (`AI_PROVIDER`, `serverAi`) and the unsafe flag are operator choices, so
 * they use plain fetch. Users' own connections stay guarded even on a server with its own AI, since accounts that
 * choose Rezumi AI can add them too.
 */
export function aiTransport(serverAi = false): { fetch?: typeof fetch } {
	const transport = serverAi || env.FLAG_ALLOW_UNSAFE_AI_BASE_URL ? undefined : fetchPublic;
	// The gateway token is the operator's: only the server's own AI carries it. A user's own connection pointed at the
	// same gateway address would otherwise run on the operator's gateway (and any keys or billing stored there).
	const gateway = serverAi ? aiGatewayFetch(transport ?? ((input, init) => fetch(input, init))) : undefined;
	if (gateway) return { fetch: gateway };
	return transport ? { fetch: transport } : {};
}

const requestUrl = (input: RequestInfo | URL) =>
	typeof input === "string" ? input : input instanceof URL ? input.href : input.url;

/**
 * Cloudflare AI Gateway (new gateways require authentication): requests under the server's own `AI_BASE_URL`, when it
 * is a gateway endpoint, carry `AI_GATEWAY_TOKEN` in `cf-aig-authorization`. Only that address gets it, so a user's own
 * connection can't send the token to another gateway on the account (the token may run every gateway there).
 */
function aiGatewayFetch(next: typeof fetch): typeof fetch | undefined {
	const token = env.AI_GATEWAY_TOKEN;
	const base = env.AI_BASE_URL?.replace(/\/+$/, "");
	if (!token || !base) return undefined;
	const parsed = parseUrl(base);
	if (parsed?.protocol !== "https:" || parsed.hostname !== "gateway.ai.cloudflare.com") return undefined;
	const gatewayFetch = (input: RequestInfo | URL, init?: RequestInit) => {
		const url = requestUrl(input);
		if (url !== base && !url.startsWith(`${base}/`)) return next(input, init);
		const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
		headers.set("cf-aig-authorization", `Bearer ${token}`);
		return next(input, { ...init, headers });
	};
	return gatewayFetch as typeof fetch;
}
