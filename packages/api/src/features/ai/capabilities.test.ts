import { describe, expect, it } from "vite-plus/test";
import { isDirectOpenAIProvider } from "./capabilities";

describe("AI provider capabilities", () => {
	it("identifies direct OpenAI base URL configs", () => {
		expect(isDirectOpenAIProvider({ provider: "openai", baseURL: "" })).toBe(true);
		expect(isDirectOpenAIProvider({ provider: "openai", baseURL: "https://api.openai.com/v1/" })).toBe(true);
		expect(isDirectOpenAIProvider({ provider: "openai", baseURL: "https://example.com/v1" })).toBe(false);
		expect(isDirectOpenAIProvider({ provider: "openai", baseURL: "https://api.openai.com/v1?proxy=1" })).toBe(false);
		expect(isDirectOpenAIProvider({ provider: "openai", baseURL: "https://api.openai.com/v1#fragment" })).toBe(false);
		expect(isDirectOpenAIProvider({ provider: "openrouter", baseURL: "https://api.openai.com/v1" })).toBe(false);
	});

	it("treats a Cloudflare AI Gateway OpenAI endpoint as direct OpenAI", () => {
		const gateway = "https://gateway.ai.cloudflare.com/v1/0123abcd/rezumi/openai";
		expect(isDirectOpenAIProvider({ provider: "openai", baseURL: gateway })).toBe(true);
		expect(isDirectOpenAIProvider({ provider: "openai", baseURL: `${gateway}/` })).toBe(true);
		expect(isDirectOpenAIProvider({ provider: "openai", baseURL: `${gateway}?x=1` })).toBe(false);
		expect(
			isDirectOpenAIProvider({ provider: "openai", baseURL: "https://gateway.ai.cloudflare.com/v1/a/b/compat" }),
		).toBe(false);
		expect(
			isDirectOpenAIProvider({ provider: "openai", baseURL: "http://gateway.ai.cloudflare.com/v1/a/b/openai" }),
		).toBe(false);
		expect(isDirectOpenAIProvider({ provider: "openai", baseURL: "https://evil.example/v1/a/b/openai" })).toBe(false);
		expect(isDirectOpenAIProvider({ provider: "openrouter", baseURL: gateway })).toBe(false);
	});
});
