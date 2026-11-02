import { describe, expect, it, vi } from "vite-plus/test";

const envMock = vi.hoisted(() => ({
	FLAG_ALLOW_UNSAFE_AI_BASE_URL: false,
	AI_PROVIDER: undefined as string | undefined,
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
});
