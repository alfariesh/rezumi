import type { AIProvider } from "@rezumi/ai/types";
import { AI_PROVIDER_DEFAULT_BASE_URLS } from "@rezumi/ai/types";

type AiProviderCapabilityInput = {
	provider: AIProvider;
	baseURL?: string | null;
};

function normalizeDirectBaseUrl(baseURL: string) {
	try {
		const parsed = new URL(baseURL);
		if (parsed.search || parsed.hash || parsed.username || parsed.password) return null;
		return parsed.toString().replace(/\/+$/, "");
	} catch {
		return null;
	}
}

export function isDirectOpenAIProvider(input: Pick<AiProviderCapabilityInput, "provider" | "baseURL">) {
	return input.provider === "openai" && isDirectProvider(input);
}

// Cloudflare AI Gateway's provider endpoints pass requests through unchanged (logging, caching, analytics), so a
// gateway in front of a provider keeps that provider's own API: https://gateway.ai.cloudflare.com/v1/<account>/<gateway>/<provider>.
const CLOUDFLARE_AI_GATEWAY_PROVIDER_PATHS: Partial<Record<AIProvider, string>> = { openai: "openai" };

function isCloudflareAiGateway(baseURL: string, provider: AIProvider) {
	const providerPath = CLOUDFLARE_AI_GATEWAY_PROVIDER_PATHS[provider];
	if (!providerPath) return false;
	const parsed = new URL(baseURL);
	if (parsed.protocol !== "https:" || parsed.hostname !== "gateway.ai.cloudflare.com") return false;
	return /^\/v1\/[\w-]+\/[\w-]+\/[\w-]+$/.test(parsed.pathname) && parsed.pathname.endsWith(`/${providerPath}`);
}

function isDirectProvider(input: Pick<AiProviderCapabilityInput, "provider" | "baseURL">) {
	if (!input.baseURL?.trim()) return true;

	const baseURL = normalizeDirectBaseUrl(input.baseURL);
	if (!baseURL) return false;

	return (
		baseURL === normalizeDirectBaseUrl(AI_PROVIDER_DEFAULT_BASE_URLS[input.provider]) ||
		isCloudflareAiGateway(baseURL, input.provider)
	);
}
