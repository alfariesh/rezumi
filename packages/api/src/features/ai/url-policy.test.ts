import { describe, expect, it, vi } from "vite-plus/test";

const envMock = vi.hoisted(() => ({
	FLAG_ALLOW_UNSAFE_AI_BASE_URL: false,
	AI_PROVIDER: undefined as string | undefined,
	AI_BASE_URL: undefined as string | undefined,
	AI_GATEWAY_TOKEN: undefined as string | undefined,
}));

vi.mock("@rezumi/env/server", () => ({ env: envMock }));

const { aiTransport, resolveAiBaseUrl } = await import("./url-policy");

describe("AI provider base URL policy", () => {
	it("allows public HTTPS provider URLs", () => {
		envMock.FLAG_ALLOW_UNSAFE_AI_BASE_URL = false;

		expect(resolveAiBaseUrl({ provider: "openai", baseURL: "https://api.openai.com/v1" })).toBe(
			"https://api.openai.com/v1",
		);
	});

	it("blocks private and non-HTTPS provider URLs by default", () => {
		envMock.FLAG_ALLOW_UNSAFE_AI_BASE_URL = false;

		expect(() => resolveAiBaseUrl({ provider: "openai-compatible", baseURL: "https://localhost:11434/v1" })).toThrow(
			"INVALID_AI_BASE_URL",
		);
		expect(() => resolveAiBaseUrl({ provider: "openai-compatible", baseURL: "http://example.com/v1" })).toThrow(
			"INVALID_AI_BASE_URL",
		);
	});

	it("rejects non-HTTP schemes even when unsafe provider URLs are enabled", () => {
		envMock.FLAG_ALLOW_UNSAFE_AI_BASE_URL = true;

		expect(() => resolveAiBaseUrl({ provider: "openai-compatible", baseURL: "file:///etc/passwd" })).toThrow(
			"INVALID_AI_BASE_URL",
		);
		expect(() => resolveAiBaseUrl({ provider: "openai-compatible", baseURL: "ftp://example.com/v1" })).toThrow(
			"INVALID_AI_BASE_URL",
		);
	});
});

describe("AI transport", () => {
	it("guards users' own endpoints even on a server with its own AI", () => {
		envMock.FLAG_ALLOW_UNSAFE_AI_BASE_URL = false;
		envMock.AI_PROVIDER = "openai";

		expect(aiTransport().fetch).toBeDefined();
		// The server's own AI is the operator's endpoint: plain fetch.
		expect(aiTransport(true)).toEqual({});
	});

	it("sends AI_GATEWAY_TOKEN only to the server's own Cloudflare AI Gateway address", async () => {
		const seen: Array<[string, string | null]> = [];
		vi.stubGlobal(
			"fetch",
			vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
				const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
				seen.push([url, new Headers(init?.headers).get("cf-aig-authorization")]);
				return new Response("{}");
			}),
		);
		envMock.FLAG_ALLOW_UNSAFE_AI_BASE_URL = false;
		envMock.AI_BASE_URL = "https://gateway.ai.cloudflare.com/v1/acct/rezumi/openai/";
		envMock.AI_GATEWAY_TOKEN = "gateway-token";
		try {
			const transport = aiTransport(true).fetch;
			expect(transport).toBeDefined();
			await transport?.("https://gateway.ai.cloudflare.com/v1/acct/rezumi/openai/chat/completions", {
				headers: { Authorization: "Bearer provider" },
			});
			await transport?.("https://gateway.ai.cloudflare.com/v1/acct/other/openai/chat/completions");
			await transport?.("https://gateway.ai.cloudflare.com/v1/acct/rezumi/openai-evil/chat");
			expect(seen).toEqual([
				["https://gateway.ai.cloudflare.com/v1/acct/rezumi/openai/chat/completions", "Bearer gateway-token"],
				["https://gateway.ai.cloudflare.com/v1/acct/other/openai/chat/completions", null],
				["https://gateway.ai.cloudflare.com/v1/acct/rezumi/openai-evil/chat", null],
			]);

			envMock.AI_BASE_URL = "https://api.openai.com/v1";
			expect(aiTransport(true)).toEqual({});
		} finally {
			envMock.AI_BASE_URL = undefined;
			envMock.AI_GATEWAY_TOKEN = undefined;
			vi.unstubAllGlobals();
		}
	});
});
