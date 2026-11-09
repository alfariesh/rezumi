import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

const TOKEN = "secret-token-value";

vi.mock("@rezumi/env/server", () => ({
	env: { CLOUDFLARE_SAAS_ZONE_ID: "a".repeat(32), CLOUDFLARE_SAAS_API_TOKEN: "secret-token-value" },
}));

const {
	CloudflareSaasError,
	createCustomHostname,
	deleteCustomHostname,
	getCustomHostname,
	isCloudflareSaasEnabled,
	restartCustomHostnameValidation,
} = await import("./cloudflare");

const fetchMock = vi.fn<typeof fetch>();

const reply = (status: number, body: unknown) =>
	new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const success = (result: unknown, status = 200) => reply(status, { success: true, result, errors: [] });
const failure = (status: number, code: number) =>
	reply(status, { success: false, result: null, errors: [{ code, message: "Refused" }] });

const hostname = (fields: object = {}) => ({
	id: "cf-1",
	hostname: "www.example.com",
	status: "pending",
	ssl: { status: "pending_validation" },
	...fields,
});

beforeEach(() => {
	fetchMock.mockReset();
	vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe("Cloudflare for SaaS client", () => {
	it("is on only with both settings", () => {
		expect(isCloudflareSaasEnabled()).toBe(true);
	});

	it("creates a hostname that validates over HTTP, and reports it waiting", async () => {
		fetchMock.mockResolvedValue(success(hostname(), 201));
		await expect(createCustomHostname("www.example.com")).resolves.toEqual({
			id: "cf-1",
			hostname: "www.example.com",
			status: "pending",
			sslStatus: "pending_validation",
			problem: null,
		});
		const [url, init] = fetchMock.mock.calls[0] ?? [];
		expect(url).toBe(`https://api.cloudflare.com/client/v4/zones/${"a".repeat(32)}/custom_hostnames`);
		expect(init?.method).toBe("POST");
		expect(new Headers(init?.headers).get("authorization")).toBe(`Bearer ${TOKEN}`);
		expect(JSON.parse(String(init?.body))).toMatchObject({
			hostname: "www.example.com",
			ssl: { method: "http", type: "dv" },
		});
	});

	it("reports a hostname that's fully active", async () => {
		fetchMock.mockResolvedValue(success(hostname({ status: "active", ssl: { status: "active" } })));
		await expect(getCustomHostname("cf-1")).resolves.toMatchObject({
			status: "active",
			sslStatus: "active",
			problem: null,
		});
	});

	it.each([
		[{ status: "moved", ssl: { status: "active" } }, "dns_moved"],
		[{ status: "blocked", ssl: {} }, "blocked"],
		[
			{
				status: "active",
				ssl: { status: "pending_validation", validation_errors: [{ message: "CAA record prevents issuance" }] },
			},
			"caa",
		],
		[{ status: "active", ssl: { status: "validation_timed_out" } }, "certificate"],
	])("names the problem in %j", async (fields, problem) => {
		fetchMock.mockResolvedValue(success(hostname(fields)));
		await expect(getCustomHostname("cf-1")).resolves.toMatchObject({ problem });
	});

	it("finds the existing hostname when one is already there", async () => {
		fetchMock
			.mockResolvedValueOnce(failure(409, 1406))
			.mockResolvedValueOnce(success([hostname({ id: "cf-existing", status: "active" })]));
		await expect(createCustomHostname("www.example.com")).resolves.toMatchObject({ id: "cf-existing" });
		expect(String(fetchMock.mock.calls[1]?.[0])).toContain("?hostname=www.example.com");
	});

	it("doesn't take a different hostname that matched the filter for this one", async () => {
		fetchMock
			.mockResolvedValueOnce(failure(409, 1406))
			.mockResolvedValueOnce(success([hostname({ id: "other-account", hostname: "app.www.example.com" })]));
		const error = await createCustomHostname("www.example.com").catch((caught: unknown) => caught);
		expect((error as InstanceType<typeof CloudflareSaasError>).failure).toBe("duplicate");
	});

	it("restarts validation with the settings the hostname was made with", async () => {
		fetchMock.mockResolvedValueOnce(success(hostname(), 201)).mockResolvedValueOnce(success(hostname(), 202));
		await createCustomHostname("www.example.com");
		await expect(restartCustomHostnameValidation("cf-1")).resolves.toMatchObject({ id: "cf-1" });
		const [created, patched] = fetchMock.mock.calls;
		expect(patched?.[1]?.method).toBe("PATCH");
		expect(JSON.parse(String(patched?.[1]?.body)).ssl).toEqual(JSON.parse(String(created?.[1]?.body)).ssl);
	});

	it.each([
		["a full quota", failure(403, 1405), "quota"],
		["a bad token", failure(403, 9109), "auth"],
		["an expired token", failure(401, 10000), "auth"],
		["a name Cloudflare refuses", failure(400, 1409), "rejected"],
		["rate limiting", failure(429, 10013), "unavailable"],
		["an outage", failure(500, 1500), "unavailable"],
	])("classifies %s", async (_name, response, kind) => {
		fetchMock.mockResolvedValue(response);
		const error = await createCustomHostname("www.example.com").catch((caught: unknown) => caught);
		expect(error).toBeInstanceOf(CloudflareSaasError);
		expect((error as InstanceType<typeof CloudflareSaasError>).failure).toBe(kind);
	});

	it("treats a network failure as unavailable, and never puts the token in the error", async () => {
		fetchMock.mockRejectedValue(new Error(`socket hang up with Bearer ${TOKEN}`));
		const error = await getCustomHostname("cf-1").catch((caught: unknown) => caught);
		expect((error as InstanceType<typeof CloudflareSaasError>).failure).toBe("unavailable");
		expect(String(error)).not.toContain(TOKEN);
		expect(JSON.stringify(error)).not.toContain(TOKEN);
	});

	it("keeps the token out of a refusal's message too", async () => {
		fetchMock.mockResolvedValue(failure(403, 9109));
		const error = await getCustomHostname("cf-1").catch((caught: unknown) => caught);
		expect(String(error)).not.toContain(TOKEN);
	});

	it("reads a hostname Cloudflare no longer has as gone, and deleting it as done", async () => {
		fetchMock.mockImplementation(() => Promise.resolve(failure(404, 1436)));
		await expect(getCustomHostname("cf-1")).resolves.toBeNull();
		await expect(deleteCustomHostname("cf-1")).resolves.toBeUndefined();
	});
});
