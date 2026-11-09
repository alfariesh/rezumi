import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vite-plus/test";

const envMock = vi.hoisted(() => ({
	APP_URL: "https://resume.example.com",
	STORAGE_BACKEND: "local",
	LOCAL_STORAGE_PATH: "",
}));
const state = vi.hoisted(() => ({
	banned: new Set<string>(),
	/** Keys a published portfolio uses: what `isPublicPortfolioFile` answers from the database. */
	publicFiles: new Set<string>(),
	lookups: 0,
}));
vi.mock("@rezumi/env/server", () => ({ env: envMock }));
vi.mock("@rezumi/api/features/storage", async (original) => ({
	...(await original<typeof import("@rezumi/api/features/storage")>()),
	isPublicUploadOwner: async (userId: string) => !state.banned.has(userId),
}));
vi.mock("@rezumi/api/features/portfolio/public", () => ({
	isPublicPortfolioFile: async (key: string) => {
		state.lookups++;
		return state.publicFiles.has(key);
	},
}));
// Visitors have no session; `x-test-user` stands in for a signed-in account's cookie.
vi.mock("@rezumi/api/context", () => ({
	resolveAuthenticationFromRequestHeaders: async (headers: Headers) => {
		const id = headers.get("x-test-user");
		return id ? { user: { id }, permissions: ["read"] } : null;
	},
}));

vi.mock("@rezumi/api/features/auth/admin-session", () => ({
	assertAdminSession: async (authentication: { user: { id: string } }) => {
		if (authentication.user.id !== "admin-1") throw new Error("FORBIDDEN");
	},
}));

let storage: ReturnType<typeof import("@rezumi/api/features/storage").getStorageService>;
let handleUpload: typeof import("./uploads").handleUpload;
beforeAll(async () => {
	envMock.LOCAL_STORAGE_PATH = await mkdtemp(join(tmpdir(), "portfolio-upload-"));
	storage = (await import("@rezumi/api/features/storage")).getStorageService();
	({ handleUpload } = await import("./uploads"));
});
afterAll(async () => {
	await rm(envMock.LOCAL_STORAGE_PATH, { recursive: true, force: true });
});
beforeEach(() => {
	state.banned.clear();
	state.publicFiles.clear();
	state.lookups = 0;
});

const pdfKey = "uploads/user-1/documents/portfolio/3f0a8c1e-7b2d-4c5e-9f10-123456789abc.pdf";
const pictureKey = "uploads/user-1/pictures/portfolio/9a8b7c6d-5e4f-4a3b-9c2d-1e0f9a8b7c6d.webp";
const pdfBytes = new TextEncoder().encode("%PDF-1.7\n1 0 obj << >> endobj\n%%EOF");
const webpBytes = new Uint8Array([0x52, 0x49, 0x46, 0x46]);
const get = (key: string, headers: HeadersInit = {}) =>
	handleUpload(new Request(`${envMock.APP_URL}/${key}`, { headers }));
const owner = { "x-test-user": "user-1" };
const administrator = { "x-test-user": "admin-1" };
const stranger = { "x-test-user": "someone-else" };

describe("portfolio files a published portfolio uses", () => {
	it("are public PDFs, shown inline by the PDF viewer and locked down, loadable from any site", async () => {
		await storage.write({ key: pdfKey, data: pdfBytes, contentType: "application/pdf" });
		state.publicFiles.add(pdfKey);
		const response = await get(pdfKey);
		expect(response.status).toBe(200);
		expect(Object.fromEntries(response.headers)).toMatchObject({
			"content-type": "application/pdf",
			"content-disposition": 'inline; filename="document.pdf"',
			"x-content-type-options": "nosniff",
			"content-security-policy": "sandbox",
			"cache-control": "public, max-age=3600",
			"cross-origin-resource-policy": "cross-origin",
			"content-length": String(pdfBytes.byteLength),
		});
		expect(response.headers.get("etag")).toBeTruthy();
		expect(new Uint8Array(await response.arrayBuffer())).toEqual(pdfBytes);

		const cached = await get(pdfKey, { "If-None-Match": response.headers.get("etag") ?? "" });
		expect(cached.status).toBe(304);
		expect(cached.headers.get("cache-control")).toBe("public, max-age=3600");
		// The /api/uploads spelling serves the same.
		expect((await get(`api/${pdfKey}`)).headers.get("content-security-policy")).toBe("sandbox");
	});

	it("are public pictures, loadable from the alias domain and custom domains", async () => {
		await storage.write({ key: pictureKey, data: webpBytes, contentType: "image/webp" });
		state.publicFiles.add(pictureKey);
		const response = await get(pictureKey);
		expect(response.status).toBe(200);
		expect(Object.fromEntries(response.headers)).toMatchObject({
			"content-type": "image/webp",
			"cache-control": "public, max-age=3600",
			"cross-origin-resource-policy": "cross-origin",
			"x-content-type-options": "nosniff",
		});
		expect(response.headers.get("content-disposition")).toBeNull();
		expect(response.headers.get("content-security-policy")).toBeNull();
	});
});

describe("portfolio files nobody may see yet, or anymore", () => {
	// Not saved yet, unused, unpublished, suspended, switched off, or a banned owner: the lookup says no to all of them.
	it("are not found for visitors, never from a cache, and never answer 304", async () => {
		await storage.write({ key: pictureKey, data: webpBytes, contentType: "image/webp" });
		await storage.write({ key: pdfKey, data: pdfBytes, contentType: "application/pdf" });
		const read = vi.spyOn(storage, "read");
		for (const key of [pictureKey, pdfKey, `api/${pictureKey}`]) {
			const response = await get(key, { "If-None-Match": "*" });
			expect(response.status, key).toBe(404);
			expect(response.headers.get("cache-control")).toBe("no-store");
		}
		expect(read).not.toHaveBeenCalled();
		read.mockRestore();
		// Someone else's account is a visitor too.
		expect((await get(pictureKey, { "x-test-user": "user-2" })).status).toBe(404);
		// Another spelling of the folder is still the portfolio's (a case-insensitive disk reads the same file).
		expect((await get(pictureKey.replace("/portfolio/", "/Portfolio/"))).status).toBe(404);
	});

	it("stay readable by their owner, for the editor and its preview, kept only in the owner's browser", async () => {
		await storage.write({ key: pictureKey, data: webpBytes, contentType: "image/webp" });
		await storage.write({ key: pdfKey, data: pdfBytes, contentType: "application/pdf" });
		const picture = await get(pictureKey, owner);
		expect(picture.status).toBe(200);
		expect(Object.fromEntries(picture.headers)).toMatchObject({
			"content-type": "image/webp",
			"cache-control": "private, max-age=3600",
			"cross-origin-resource-policy": "same-site",
		});
		const pdf = await get(pdfKey, owner);
		expect(Object.fromEntries(pdf.headers)).toMatchObject({
			"content-type": "application/pdf",
			"content-security-policy": "sandbox",
			"cache-control": "private, max-age=3600",
		});
		const cached = await get(pictureKey, { ...owner, "If-None-Match": picture.headers.get("etag") ?? "" });
		expect(cached.status).toBe(304);
		expect(cached.headers.get("cache-control")).toBe("private, max-age=3600");
	});

	it("are readable by an administrator reviewing a taken-down portfolio, in private copies only", async () => {
		await storage.write({ key: pictureKey, data: webpBytes, contentType: "image/webp" });
		const picture = await get(pictureKey, administrator);
		expect(picture.status).toBe(200);
		expect(picture.headers.get("cache-control")).toBe("private, max-age=3600");
		expect((await get(pictureKey, stranger)).status).toBe(404);
		expect((await get(pictureKey)).status).toBe(404);
	});

	it("are looked up once per request, and not at all when the address can't be a portfolio file", async () => {
		await storage.write({ key: pictureKey, data: webpBytes, contentType: "image/webp" });
		await get(pictureKey);
		expect(state.lookups).toBe(1);
		const other = "uploads/user-1/documents/portfolio/notes.txt";
		await storage.write({ key: other, data: new TextEncoder().encode("private"), contentType: "text/plain" });
		expect((await get(other)).status).toBe(404);
		expect(state.lookups).toBe(1);
	});
});

describe("portfolio files stored as something else", () => {
	it("are never served as anything but what their address says", async () => {
		// Local storage names the type after the file: HTML bytes under a .pdf name still go out as a sandboxed PDF.
		const htmlKey = "uploads/user-1/documents/portfolio/0d9b6a2c-1e3f-4a5b-8c7d-6e5f4a3b2c1d.pdf";
		await storage.write({
			key: htmlKey,
			data: new TextEncoder().encode("<script>1</script>"),
			contentType: "text/html",
		});
		state.publicFiles.add(htmlKey);
		const local = await get(htmlKey);
		expect(local.headers.get("content-type")).toBe("application/pdf");
		expect(local.headers.get("content-security-policy")).toBe("sandbox");
		expect(local.headers.get("x-content-type-options")).toBe("nosniff");
		// S3 and R2 keep the type it was written with: anything but a PDF stays private, a download for its owner.
		const html = { data: new TextEncoder().encode("<script>1</script>"), size: 18, contentType: "text/html" };
		const read = vi.spyOn(storage, "read").mockResolvedValue(html);
		expect((await get(htmlKey)).status).toBe(404);
		const download = await get(htmlKey, owner);
		expect(Object.fromEntries(download.headers)).toMatchObject({
			"content-type": "application/octet-stream",
			"cache-control": "private, no-store",
			"cross-origin-resource-policy": "same-site",
		});
		expect(download.headers.get("content-disposition")).toMatch(/^attachment/);
		read.mockRestore();

		// Anything but <uuid>.pdf or a picture in those folders stays private, whatever the lookup would say.
		const other = "uploads/user-1/documents/portfolio/notes.txt";
		await storage.write({ key: other, data: new TextEncoder().encode("private"), contentType: "text/plain" });
		state.publicFiles.add(other);
		expect((await get(other)).status).toBe(404);
		const nested = "uploads/user-1/documents/portfolio/a/b.pdf";
		await storage.write({ key: nested, data: pdfBytes, contentType: "application/pdf" });
		state.publicFiles.add(nested);
		expect((await get(nested)).status).toBe(404);
		const elsewhere = "uploads/user-1/documents/letter.pdf";
		await storage.write({ key: elsewhere, data: pdfBytes, contentType: "application/pdf" });
		expect((await get(elsewhere)).status).toBe(404);
	});
});

describe("other pictures", () => {
	it("stay public while their owner isn't banned, and other sites of the installation may show them", async () => {
		const key = "uploads/user-1/pictures/5e4f4a3b-9c2d-1e0f-9a8b-7c6d9a8b7c6d.jpeg";
		await storage.write({ key, data: new Uint8Array([0xff, 0xd8, 0xff]), contentType: "image/jpeg" });
		const response = await get(key);
		expect(response.status).toBe(200);
		expect(response.headers.get("cache-control")).toBe("public, max-age=3600");
		// The alias domain and custom domains show resume photos too.
		expect(response.headers.get("cross-origin-resource-policy")).toBe("cross-origin");
		expect(state.lookups).toBe(0);
		// A picture named like a portfolio one but outside its folder is one of these.
		const lookalike = "uploads/user-1/pictures/portfolio-persona.jpg";
		await storage.write({ key: lookalike, data: new Uint8Array([0xff, 0xd8, 0xff]), contentType: "image/jpeg" });
		expect((await get(lookalike)).status).toBe(200);
		state.banned.add("user-1");
		expect((await get(key)).status).toBe(404);
		expect(state.lookups).toBe(0);
	});
});
