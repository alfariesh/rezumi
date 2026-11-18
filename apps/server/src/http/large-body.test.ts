import { describe, expect, it, vi } from "vite-plus/test";
import { ORPCError } from "@orpc/server";

vi.mock("@rezumi/api/context", () => ({ resolveAuthenticationFromRequestHeaders: vi.fn(async () => null) }));

const { ANONYMOUS_BODY_LIMIT, guardLargeBody } = await import("./large-body");

const request = (path: string, headers: Record<string, string>, method = "POST") =>
	new Request(`https://rezumi.app${path}`, { method, headers });

const signedIn = vi.fn(async () => ({ user: { id: "u1" } }) as never);
const anonymous = vi.fn(async () => null);

describe("guardLargeBody", () => {
	it("lets small bodies and reads through without checking credentials", async () => {
		const small = request("/api/rpc/resume/getBySlug", { "content-length": String(ANONYMOUS_BODY_LIMIT) });
		expect(await guardLargeBody(small, anonymous)).toBeNull();
		expect(await guardLargeBody(request("/api/rpc/flags/get", {}, "GET"), anonymous)).toBeNull();
		expect(anonymous).not.toHaveBeenCalled();
	});

	it("refuses a large body from an anonymous sender before it is read", async () => {
		for (const path of ["/api/rpc/resume/getBySlug", "/api/openapi/resumes/import"]) {
			const big = request(path, { "content-length": String(40 * 1024 * 1024), "content-type": "application/json" });
			const response = await guardLargeBody(big, anonymous);
			expect(response?.status, path).toBe(401);
			expect(big.bodyUsed).toBe(false);
		}
	});

	it("treats a body that doesn't state its length as large", async () => {
		expect((await guardLargeBody(request("/api/rpc/resume/getBySlug", {}), anonymous))?.status).toBe(401);
	});

	it("reads a large body once its sender is signed in", async () => {
		const big = request("/api/rpc/resume/import", { "content-length": String(8 * 1024 * 1024) });
		expect(await guardLargeBody(big, signedIn)).toBeNull();
	});

	it("keeps the public ATS check's PDF upload open, but only as multipart and up to its size", async () => {
		const upload = (type: string, size: number) =>
			request("/api/openapi/pdf-checks", { "content-length": String(size), "content-type": type });
		expect(await guardLargeBody(upload("multipart/form-data; boundary=x", 25_500_000), anonymous)).toBeNull();
		expect((await guardLargeBody(upload("application/json", 25_500_000), anonymous))?.status).toBe(401);
		expect((await guardLargeBody(upload("multipart/form-data; boundary=x", 30_000_000), anonymous))?.status).toBe(401);
	});

	it("answers 403 for a cookie sent from another site", async () => {
		const crossSite = vi.fn(async () => {
			throw new ORPCError("FORBIDDEN", { message: "This request came from another site." });
		});
		const big = request("/api/rpc/resume/import", { "content-length": String(8 * 1024 * 1024) });
		expect((await guardLargeBody(big, crossSite))?.status).toBe(403);
	});
});
