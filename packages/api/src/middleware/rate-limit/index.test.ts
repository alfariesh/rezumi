import { afterEach, describe, expect, it, vi } from "vite-plus/test";

const { limit, settings } = vi.hoisted(() => ({
	limit: vi.fn(),
	settings: { FLAG_DISABLE_API_RATE_LIMIT: false },
}));

vi.mock("../../redis", () => ({ createRateLimiter: () => ({ limit }) }));
vi.mock("@rezumi/env/server", () => ({ env: settings }));

afterEach(() => {
	vi.unstubAllEnvs();
	vi.resetModules();
	limit.mockReset();
});

describe("public resume rate limits", () => {
	it.each([false, true])("honors FLAG_DISABLE_API_RATE_LIMIT=%s in production", async (disabled) => {
		vi.stubEnv("NODE_ENV", "production");
		settings.FLAG_DISABLE_API_RATE_LIMIT = disabled;
		limit.mockResolvedValue({ success: false, remaining: 0, reset: Date.now() + 60_000 });
		const { consumeResumePasswordLimit } = await import("./index");
		expect(await consumeResumePasswordLimit({ resumeId: "resume-id", trustedClient: "203.0.113.9" })).toBe(disabled);
		if (disabled) expect(limit).not.toHaveBeenCalled();
		else expect(limit).toHaveBeenCalledWith("resume-password:resume-id:ip:203.0.113.9");
	});

	it("shares one password budget for the canonical resume identity", async () => {
		vi.stubEnv("NODE_ENV", "production");
		settings.FLAG_DISABLE_API_RATE_LIMIT = false;
		limit.mockResolvedValue({ success: true, remaining: 4, reset: Date.now() + 60_000 });
		const { consumeResumePasswordLimit } = await import("./index");
		await consumeResumePasswordLimit({ resumeId: "resume-id", trustedClient: "203.0.113.9" });
		await consumeResumePasswordLimit({ resumeId: "resume-id", trustedClient: "203.0.113.9" });
		expect(limit.mock.calls.map(([key]) => key)).toEqual([
			"resume-password:resume-id:ip:203.0.113.9",
			"resume-password:resume-id:ip:203.0.113.9",
		]);
	});

	it("counts an IPv6 client by its /64, so rotating addresses inside it shares one budget", async () => {
		vi.stubEnv("NODE_ENV", "production");
		settings.FLAG_DISABLE_API_RATE_LIMIT = false;
		limit.mockResolvedValue({ success: true, remaining: 4, reset: Date.now() + 60_000 });
		const { consumeResumePasswordLimit, getClientKey } = await import("./index");
		await consumeResumePasswordLimit({ resumeId: "resume-id", trustedClient: "2001:db8:1:2::a" });
		await consumeResumePasswordLimit({ resumeId: "resume-id", trustedClient: "2001:db8:1:2:ffff:1:2:3" });
		expect(limit.mock.calls.map(([key]) => key)).toEqual([
			"resume-password:resume-id:ip:2001:db8:1:2::/64",
			"resume-password:resume-id:ip:2001:db8:1:2::/64",
		]);
		expect(getClientKey("::ffff:203.0.113.9")).toBe("ip:203.0.113.9");
		expect(getClientKey(undefined)).toBe("ip:unknown");
	});

	it("refuses every password try for a resume once its wrong tries for the hour are spent", async () => {
		vi.stubEnv("NODE_ENV", "production");
		settings.FLAG_DISABLE_API_RATE_LIMIT = false;
		limit.mockResolvedValue({ success: true, remaining: 1, reset: Date.now() + 60_000 });
		const { isResumePasswordBudgetSpent, spendResumePasswordWrongTry } = await import("./index");
		await spendResumePasswordWrongTry("resume-id");
		expect(await isResumePasswordBudgetSpent("resume-id")).toBe(false);
		limit.mockResolvedValue({ success: true, remaining: 0, reset: Date.now() + 60_000 });
		await spendResumePasswordWrongTry("resume-id");
		expect(await isResumePasswordBudgetSpent("resume-id")).toBe(true);
		expect(await isResumePasswordBudgetSpent("other-resume")).toBe(false);
	});

	it.each([
		{
			name: "per user and resume",
			middleware: "resumeUpdatesRateLimit",
			expectedKey: "resume-updates:user-123:resume-456",
		},
		{
			name: "per user across resumes",
			middleware: "resumeUpdatesUserRateLimit",
			expectedKey: "resume-updates-user:user-123",
		},
	] as const)("rate limits resume updates subscription $name", async ({ middleware, expectedKey }) => {
		vi.stubEnv("NODE_ENV", "production");
		settings.FLAG_DISABLE_API_RATE_LIMIT = false;
		limit.mockResolvedValue({ success: false, remaining: 0, reset: Date.now() + 60_000 });
		const middlewares = await import("./index");
		const next = vi.fn(async () => "allowed");
		const request = middlewares[middleware](
			{ context: { user: { id: "user-123" } }, next } as never,
			{ id: "resume-456" },
			vi.fn(),
		);
		await expect(request).rejects.toMatchObject({ code: "TOO_MANY_REQUESTS" });
		expect(limit).toHaveBeenCalledWith(expectedKey);
		expect(next).not.toHaveBeenCalled();
	});
});
