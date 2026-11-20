import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

const fixture = vi.hoisted(() => ({
	authentication: null as { user: { id: string } } | null,
	readListingLogo: vi.fn(),
}));
vi.mock("@rezumi/api/context", () => ({
	resolveAuthenticationFromRequestHeaders: async () => fixture.authentication,
}));
vi.mock("@rezumi/api/features/jobs/logo", () => ({ readListingLogo: fixture.readListingLogo }));

const { handleJobListingLogo } = await import("./job-logo");
const request = () => new Request("http://localhost/api/jobs/listings/listing-1/logo");

describe("handleJobListingLogo", () => {
	beforeEach(() => {
		fixture.authentication = { user: { id: "alice" } };
		fixture.readListingLogo.mockReset();
	});

	it("serves the logo to a signed-in account, privately cached and locked down", async () => {
		fixture.readListingLogo.mockResolvedValue({ bytes: new Uint8Array([1, 2, 3]), contentType: "image/png" });
		const response = await handleJobListingLogo(request(), "listing-1");
		expect(response.status).toBe(200);
		expect(response.headers.get("content-type")).toBe("image/png");
		expect(response.headers.get("cache-control")).toBe("private, max-age=86400");
		expect(response.headers.get("x-content-type-options")).toBe("nosniff");
		expect(new Uint8Array(await response.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3]));
	});

	it("refuses without an account, and answers 404 for a bad id or a listing without a logo", async () => {
		fixture.authentication = null;
		expect((await handleJobListingLogo(request(), "listing-1")).status).toBe(401);
		fixture.authentication = { user: { id: "alice" } };
		expect((await handleJobListingLogo(request(), "../etc")).status).toBe(404);
		fixture.readListingLogo.mockResolvedValue(null);
		expect((await handleJobListingLogo(request(), "listing-1")).status).toBe(404);
		expect(fixture.readListingLogo).toHaveBeenCalledOnce();
	});
});
