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
	return serverAi || env.FLAG_ALLOW_UNSAFE_AI_BASE_URL ? {} : { fetch: fetchPublic };
}
