import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

const uploads = vi.hoisted(() => [] as { userId: string; contentType: string; size: number }[]);
vi.mock("../storage/service", () => ({
	uploadFile: vi.fn(async (input: { userId: string; data: Uint8Array; contentType: string }) => {
		uploads.push({ userId: input.userId, contentType: input.contentType, size: input.data.byteLength });
		return {
			key: "uploads/member/pictures/logo.png",
			url: "http://localhost:3000/api/uploads/member/pictures/logo.png",
		};
	}),
}));

const { copyCompanyLogo, logoType, MAX_LOGO_BYTES } = await import("./logo");

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const SVG = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');

/** Answers like a picture host would, without the network. */
const hop =
	(body: Uint8Array, contentType: string, status = 200) =>
	async () =>
		new Response(new Uint8Array(body), { status, headers: { "content-type": contentType } });

describe("copyCompanyLogo", () => {
	beforeEach(() => {
		uploads.length = 0;
	});

	it("stores a PNG logo under the account's uploads", async () => {
		const copied = await copyCompanyLogo("member", "https://media.example/logo.png", { hop: hop(PNG, "image/png") });
		expect(copied).toEqual({ ok: true, url: "http://localhost:3000/api/uploads/member/pictures/logo.png" });
		expect(uploads).toEqual([{ userId: "member", contentType: "image/png", size: PNG.byteLength }]);
	});

	it.each([
		["a private address", "https://127.0.0.1/logo.png"],
		["localhost", "https://localhost/logo.png"],
		["an IPv6 loopback", "https://[::1]/logo.png"],
		["plain http", "http://media.example/logo.png"],
		["another port", "https://media.example:8443/logo.png"],
		["credentials", "https://user:secret@media.example/logo.png"],
	])("refuses %s without asking", async (_, address) => {
		const ask = vi.fn(hop(PNG, "image/png"));
		expect(await copyCompanyLogo("member", address, { hop: ask })).toEqual({ ok: false, reason: "unsafe-url" });
		expect(ask).not.toHaveBeenCalled();
		expect(uploads).toEqual([]);
	});

	it("refuses an SVG, a picture that is not one, and one past the size cap", async () => {
		expect(await copyCompanyLogo("member", "https://media.example/a.svg", { hop: hop(SVG, "image/svg+xml") })).toEqual({
			ok: false,
			reason: "wrong-type",
		});
		// Says PNG, is not: the bytes decide.
		expect(await copyCompanyLogo("member", "https://media.example/b.png", { hop: hop(SVG, "image/png") })).toEqual({
			ok: false,
			reason: "wrong-type",
		});
		const huge = new Uint8Array(MAX_LOGO_BYTES + 1);
		huge.set(PNG);
		expect(await copyCompanyLogo("member", "https://media.example/c.png", { hop: hop(huge, "image/png") })).toEqual({
			ok: false,
			reason: "too-large",
		});
		expect(uploads).toEqual([]);
	});

	it("refuses a redirect to a private address", async () => {
		const redirect = async () =>
			new Response(null, { status: 302, headers: { location: "https://10.0.0.5/logo.png" } });
		expect(await copyCompanyLogo("member", "https://media.example/logo.png", { hop: redirect })).toEqual({
			ok: false,
			reason: "unsafe-url",
		});
	});

	it("reports a host that turns it away as unreachable", async () => {
		expect(
			await copyCompanyLogo("member", "https://media.example/logo.png", { hop: hop(PNG, "image/png", 403) }),
		).toEqual({ ok: false, reason: "unreachable" });
	});
});

describe("logoType", () => {
	it("knows PNG, JPEG and WebP by their bytes only", () => {
		expect(logoType(PNG)).toBe("image/png");
		expect(logoType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe("image/jpeg");
		expect(logoType(new TextEncoder().encode("RIFF\0\0\0\0WEBPVP8 "))).toBe("image/webp");
		expect(logoType(new TextEncoder().encode("GIF89a"))).toBeNull();
		expect(logoType(SVG)).toBeNull();
	});
});
