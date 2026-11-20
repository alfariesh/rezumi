import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

vi.mock("@rezumi/utils/monorepo.node", () => ({ findWorkspaceRoot: () => null }));

beforeEach(() => {
	vi.resetModules();
	for (const name of [
		"APP_REVISION",
		"CLOUDFLARE_BROWSER_TOKEN",
		"CLOUDFLARE_ACCOUNT_ID",
		"APIFY_TOKEN",
		"APIFY_LINKEDIN_ACTOR",
		"GITHUB_API_TOKEN",
		"AI_PROVIDER",
		"AI_MODEL",
		"AI_API_KEY",
		"AI_BASE_URL",
		"REDIS_URL",
		"WEB_FONT_BASE_URL",
		"STORAGE_HEALTHCHECK_TIMEOUT_MS",
		"DODO_PAYMENTS_ENVIRONMENT",
		"DODO_PAYMENTS_API_KEY",
		"DODO_PAYMENTS_WEBHOOK_KEY",
		"DODO_PAYMENTS_PRODUCT_PLUS_MONTHLY",
		"DODO_PAYMENTS_PRODUCT_PLUS_YEARLY",
		"DODO_PAYMENTS_PRODUCT_PRO_AI_MONTHLY",
		"DODO_PAYMENTS_PRODUCT_PRO_AI_YEARLY",
		"SUMOPOD_ENVIRONMENT",
		"SUMOPOD_API_KEY",
		"SUMOPOD_WEBHOOK_SECRET",
		"BILLING_CHECKOUT_PAUSED",
		"BILLING_ALERT_EMAIL",
		"EXTENSION_MIN_VERSION",
	])
		vi.stubEnv(name, undefined);
});

describe("application revision", () => {
	it.each([undefined, "", "a".repeat(40)])("accepts an unset or full Git commit SHA (%s)", async (revision) => {
		vi.stubEnv("APP_REVISION", revision);
		expect((await import("./server")).env.APP_REVISION).toBe(revision || undefined);
	});

	it.each(["abc1234", "g".repeat(40)])("rejects invalid revision %s", async (revision) => {
		vi.stubEnv("APP_REVISION", revision);
		vi.spyOn(console, "error").mockImplementation(() => {});
		await expect(import("./server")).rejects.toThrow("Invalid environment variables");
	});
});
afterEach(() => {
	vi.unstubAllEnvs();
	vi.restoreAllMocks();
});

describe("web font mirror configuration", () => {
	it.each([undefined, "", "https://fonts.example.com", "https://fonts.example.com/cm/", "http://localhost:8080"])(
		"accepts %s",
		async (value) => {
			vi.stubEnv("WEB_FONT_BASE_URL", value);
			expect((await import("./server")).env.WEB_FONT_BASE_URL).toBe(value || undefined);
		},
	);

	it.each([
		"not a url",
		"/fonts",
		"ftp://fonts.example.com",
		"https://fonts.example.com?key=value",
		"https://fonts.example.com#fonts",
	])("rejects %s", async (value) => {
		vi.stubEnv("WEB_FONT_BASE_URL", value);
		vi.spyOn(console, "error").mockImplementation(() => {});
		await expect(import("./server")).rejects.toThrow("Invalid environment variables");
	});
});

describe("Browser Run configuration", () => {
	it("leaves the browser reader off by default", async () => {
		const { env } = await import("./server");
		expect(env.CLOUDFLARE_BROWSER_TOKEN).toBeUndefined();
		expect(env.CLOUDFLARE_ACCOUNT_ID).toBeUndefined();
	});

	it("reads the token and account id", async () => {
		vi.stubEnv("CLOUDFLARE_BROWSER_TOKEN", "test-browser-token");
		vi.stubEnv("CLOUDFLARE_ACCOUNT_ID", "0123456789abcdef0123456789abcdef");
		const { env } = await import("./server");
		expect(env.CLOUDFLARE_BROWSER_TOKEN).toBe("test-browser-token");
		expect(env.CLOUDFLARE_ACCOUNT_ID).toBe("0123456789abcdef0123456789abcdef");
	});

	it("rejects an account id that isn't one", async () => {
		vi.stubEnv("CLOUDFLARE_ACCOUNT_ID", "my-account");
		await expect(import("./server")).rejects.toThrow();
	});
});

describe("Profile source configuration", () => {
	it("leaves the tokens unset and names the default LinkedIn actor", async () => {
		const { env } = await import("./server");
		expect(env.APIFY_TOKEN).toBeUndefined();
		expect(env.GITHUB_API_TOKEN).toBeUndefined();
		expect(env.APIFY_LINKEDIN_ACTOR).toBe("harvestapi~linkedin-profile-scraper");
	});

	it("reads the tokens and an actor written with a slash", async () => {
		vi.stubEnv("APIFY_TOKEN", " apify_api_test ");
		vi.stubEnv("APIFY_LINKEDIN_ACTOR", "someone/profile-reader");
		vi.stubEnv("GITHUB_API_TOKEN", "github_pat_test");
		const { env } = await import("./server");
		expect(env.APIFY_TOKEN).toBe("apify_api_test");
		expect(env.APIFY_LINKEDIN_ACTOR).toBe("someone~profile-reader");
		expect(env.GITHUB_API_TOKEN).toBe("github_pat_test");
	});

	it.each(["https://apify.com/someone/actor", "no-owner"])("rejects the actor %s", async (actor) => {
		vi.stubEnv("APIFY_LINKEDIN_ACTOR", actor);
		vi.spyOn(console, "error").mockImplementation(() => {});
		await expect(import("./server")).rejects.toThrow("Invalid environment variables");
	});
});

describe("unknown variables", () => {
	it("ignores a variable the schema does not declare", async () => {
		vi.stubEnv("RR_UNKNOWN_SETTING", "x");
		const { env } = await import("./server");
		expect(env).not.toHaveProperty("RR_UNKNOWN_SETTING");
	});
});

describe("storage health check timeout", () => {
	it.each([undefined, ""])("defaults to 5000 ms when unset or blank (%s)", async (value) => {
		vi.stubEnv("STORAGE_HEALTHCHECK_TIMEOUT_MS", value);
		expect((await import("./server")).env.STORAGE_HEALTHCHECK_TIMEOUT_MS).toBe(5_000);
	});

	it("accepts a custom timeout in milliseconds", async () => {
		vi.stubEnv("STORAGE_HEALTHCHECK_TIMEOUT_MS", "7000");
		expect((await import("./server")).env.STORAGE_HEALTHCHECK_TIMEOUT_MS).toBe(7_000);
	});

	it.each(["0", "-1", "1.5", "not-a-number", "2147483648"])("rejects invalid timer duration %s", async (value) => {
		vi.stubEnv("STORAGE_HEALTHCHECK_TIMEOUT_MS", value);
		vi.spyOn(console, "error").mockImplementation(() => {});
		await expect(import("./server")).rejects.toThrow("Invalid environment variables");
	});
});

describe("redis url userinfo", () => {
	it.each([
		"redis://localhost:6379",
		"rediss://localhost:6379/0",
		"redis://:password@localhost:6379",
		"redis://default:password@localhost:6379/0",
		"redis://acl-user:password@localhost:6379",
	])("accepts %s", async (url) => {
		vi.stubEnv("REDIS_URL", url);
		expect((await import("./server")).env.REDIS_URL).toBe(url);
	});

	it.each([
		"redis://acl-user:@localhost:6379", // named ACL user with an empty password (nopass) — AUTH <user> "" is valid
		"redis://@localhost:6379", // empty userinfo — ioredis treats it like no userinfo and sends no AUTH
	])("accepts %s", async (url) => {
		vi.stubEnv("REDIS_URL", url);
		expect((await import("./server")).env.REDIS_URL).toBe(url);
	});

	it.each([
		"redis://password@localhost:6379", // password in the username slot (userinfo with no colon)
	])("rejects %s", async (url) => {
		vi.stubEnv("REDIS_URL", url);
		const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
		await expect(import("./server")).rejects.toThrow("Invalid environment variables");
		expect(consoleError).toHaveBeenCalledWith(
			expect.any(String),
			expect.arrayContaining([
				expect.objectContaining({ message: expect.stringContaining("userinfo has no password field") }),
			]),
		);
	});

	it("rejects a malformed URL as a normal validation failure, not a parse crash", async () => {
		vi.stubEnv("REDIS_URL", "not a url");
		const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
		await expect(import("./server")).rejects.toThrow("Invalid environment variables");
		expect(consoleError).toHaveBeenCalledWith(
			expect.any(String),
			expect.arrayContaining([expect.objectContaining({ code: "invalid_format", format: "url" })]),
		);
	});
});

describe("billing alert address", () => {
	it.each([undefined, "", "owner@example.com"])("accepts an unset or valid address (%s)", async (value) => {
		vi.stubEnv("BILLING_ALERT_EMAIL", value);
		expect((await import("./server")).env.BILLING_ALERT_EMAIL).toBe(value || undefined);
	});

	it("rejects something that isn't an email address", async () => {
		vi.stubEnv("BILLING_ALERT_EMAIL", "owner");
		vi.spyOn(console, "error").mockImplementation(() => {});
		await expect(import("./server")).rejects.toThrow("Invalid environment variables");
	});
});

describe("Dodo Payments configuration", () => {
	const products = {
		DODO_PAYMENTS_PRODUCT_PLUS_MONTHLY: "pdt_0NrbytD9Enu0PTffpt7KM",
		DODO_PAYMENTS_PRODUCT_PLUS_YEARLY: "pdt_0NrbytGSj7f6FeVzY3YT1",
		DODO_PAYMENTS_PRODUCT_PRO_AI_MONTHLY: "pdt_0NrbytKkgbAgXP4kJQEtp",
		DODO_PAYMENTS_PRODUCT_PRO_AI_YEARLY: "pdt_0NrbytOIWHFnsqvo3Vzu1",
	};

	it("leaves Dodo Payments off and checkout open by default", async () => {
		const { env } = await import("./server");
		expect(env.DODO_PAYMENTS_API_KEY).toBeUndefined();
		expect(env.DODO_PAYMENTS_ENVIRONMENT).toBeUndefined();
		expect(env.BILLING_CHECKOUT_PAUSED).toBe(false);
	});

	it("accepts a key with its mode and all four products", async () => {
		for (const [name, value] of Object.entries(products)) vi.stubEnv(name, value);
		vi.stubEnv("DODO_PAYMENTS_ENVIRONMENT", "test_mode");
		vi.stubEnv("DODO_PAYMENTS_API_KEY", "test-key");
		vi.stubEnv("DODO_PAYMENTS_WEBHOOK_KEY", "whsec_test");
		const { env } = await import("./server");
		expect(env.DODO_PAYMENTS_ENVIRONMENT).toBe("test_mode");
		expect(env.DODO_PAYMENTS_PRODUCT_PRO_AI_YEARLY).toBe(products.DODO_PAYMENTS_PRODUCT_PRO_AI_YEARLY);
	});

	it("rejects a product id that isn't one of Dodo's", async () => {
		vi.stubEnv("DODO_PAYMENTS_PRODUCT_PLUS_MONTHLY", "plus-monthly");
		vi.spyOn(console, "error").mockImplementation(() => {});
		await expect(import("./server")).rejects.toThrow("Invalid environment variables");
	});

	it.each([
		[{ DODO_PAYMENTS_API_KEY: "test-key", ...products }, "needs DODO_PAYMENTS_ENVIRONMENT"],
		[
			{ DODO_PAYMENTS_API_KEY: "dodo_test_abc", DODO_PAYMENTS_ENVIRONMENT: "live_mode", ...products },
			"is a test key, but DODO_PAYMENTS_ENVIRONMENT is live_mode",
		],
		[
			{
				DODO_PAYMENTS_API_KEY: "test-key",
				DODO_PAYMENTS_ENVIRONMENT: "test_mode",
				...products,
				DODO_PAYMENTS_PRODUCT_PRO_AI_YEARLY: "",
			},
			"needs all four DODO_PAYMENTS_PRODUCT_*",
		],
		[
			{
				DODO_PAYMENTS_API_KEY: "live-key",
				DODO_PAYMENTS_ENVIRONMENT: "live_mode",
				...products,
				DODO_PAYMENTS_PRODUCT_PLUS_YEARLY: products.DODO_PAYMENTS_PRODUCT_PLUS_MONTHLY,
			},
			"must be a different product",
		],
		[{ DODO_PAYMENTS_WEBHOOK_KEY: "whsec_test" }, "without DODO_PAYMENTS_API_KEY"],
	])("refuses to start with an incomplete setup: %j", async (settings, message) => {
		for (const [name, value] of Object.entries(settings)) vi.stubEnv(name, value);
		await expect(import("./server")).rejects.toThrow(message);
	});
});

describe("Sumopod configuration", () => {
	it("leaves QRIS off by default", async () => {
		const { env } = await import("./server");
		expect(env.SUMOPOD_API_KEY).toBeUndefined();
		expect(env.SUMOPOD_ENVIRONMENT).toBeUndefined();
		expect(env.SUMOPOD_WEBHOOK_SECRET).toBeUndefined();
	});

	it("accepts a key with its mode and a webhook signing secret", async () => {
		vi.stubEnv("SUMOPOD_ENVIRONMENT", "sandbox");
		vi.stubEnv("SUMOPOD_API_KEY", "sandbox-key");
		vi.stubEnv("SUMOPOD_WEBHOOK_SECRET", "whsec_dGVzdC1zZWNyZXQ=");
		const { env } = await import("./server");
		expect(env.SUMOPOD_ENVIRONMENT).toBe("sandbox");
		expect(env.SUMOPOD_WEBHOOK_SECRET).toBe("whsec_dGVzdC1zZWNyZXQ=");
	});

	it.each(["sandbox-mode", "production"])("rejects the mode %s", async (mode) => {
		vi.stubEnv("SUMOPOD_ENVIRONMENT", mode);
		vi.spyOn(console, "error").mockImplementation(() => {});
		await expect(import("./server")).rejects.toThrow("Invalid environment variables");
	});

	it("rejects a webhook token where the signing secret belongs", async () => {
		vi.stubEnv("SUMOPOD_API_KEY", "sandbox-key");
		vi.stubEnv("SUMOPOD_ENVIRONMENT", "sandbox");
		vi.stubEnv("SUMOPOD_WEBHOOK_SECRET", "whtok_abc");
		vi.spyOn(console, "error").mockImplementation(() => {});
		await expect(import("./server")).rejects.toThrow("Invalid environment variables");
	});

	it.each([
		[{ SUMOPOD_API_KEY: "sandbox-key" }, "needs SUMOPOD_ENVIRONMENT"],
		[{ SUMOPOD_WEBHOOK_SECRET: "whsec_dGVzdA==" }, "without SUMOPOD_API_KEY"],
	])("refuses to start with an incomplete setup: %j", async (settings, message) => {
		for (const [name, value] of Object.entries(settings)) vi.stubEnv(name, value);
		await expect(import("./server")).rejects.toThrow(message);
	});
});

describe("extension minimum version", () => {
	it.each([undefined, "", "0.2.0"])("accepts an unset or x.y.z version (%s)", async (value) => {
		vi.stubEnv("EXTENSION_MIN_VERSION", value);
		expect((await import("./server")).env.EXTENSION_MIN_VERSION).toBe(value || undefined);
	});

	it.each(["v1", "1.2", "1.2.3-beta"])("rejects %s", async (value) => {
		vi.stubEnv("EXTENSION_MIN_VERSION", value);
		vi.spyOn(console, "error").mockImplementation(() => {});
		await expect(import("./server")).rejects.toThrow("Invalid environment variables");
	});
});
