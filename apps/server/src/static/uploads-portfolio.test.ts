import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vite-plus/test";

const envMock = vi.hoisted(() => ({
	APP_URL: "https://resume.example.com",
	STORAGE_BACKEND: "local",
	LOCAL_STORAGE_PATH: "",
}));
const owners = vi.hoisted(() => ({ banned: new Set<string>() }));
vi.mock("@rezumi/env/server", () => ({ env: envMock }));
vi.mock("@rezumi/api/features/storage", async (original) => ({
	...(await original<typeof import("@rezumi/api/features/storage")>()),
	isPublicUploadOwner: async (userId: string) => !owners.banned.has(userId),
}));
// Nobody is signed in: these are visitors.
vi.mock("@rezumi/api/context", () => ({ resolveAuthenticationFromRequestHeaders: async () => null }));

let storage: ReturnType<typeof import("@rezumi/api/features/storage").getStorageService>;
let handleUpload: typeof import("./uploads").handleUpload;
beforeAll(async () => {
	envMock.LOCAL_STORAGE_PATH = await mkdtemp(join(tmpdir(), "portfolio-pdf-upload-"));
	storage = (await import("@rezumi/api/features/storage")).getStorageService();
	({ handleUpload } = await import("./uploads"));
});
afterAll(async () => {
	await rm(envMock.LOCAL_STORAGE_PATH, { recursive: true, force: true });
});
beforeEach(() => {
	owners.banned.clear();
});

const pdfKey = "uploads/user-1/documents/portfolio/3f0a8c1e-7b2d-4c5e-9f10-123456789abc.pdf";
const pdfBytes = new TextEncoder().encode("%PDF-1.7\n1 0 obj << >> endobj\n%%EOF");
const get = (key: string, headers: HeadersInit = {}) =>
	handleUpload(new Request(`${envMock.APP_URL}/${key}`, { headers }));

describe("portfolio PDFs", () => {
	it("are public, shown inline by the PDF viewer and locked down", async () => {
		await storage.write({ key: pdfKey, data: pdfBytes, contentType: "application/pdf" });
		const response = await get(pdfKey);
		expect(response.status).toBe(200);
		expect(Object.fromEntries(response.headers)).toMatchObject({
			"content-type": "application/pdf",
			"content-disposition": 'inline; filename="document.pdf"',
			"x-content-type-options": "nosniff",
			"content-security-policy": "sandbox",
			"cache-control": "public, max-age=3600",
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

	it("disappear when their owner is banned or deleted", async () => {
		await storage.write({ key: pdfKey, data: pdfBytes, contentType: "application/pdf" });
		owners.banned.add("user-1");
		const response = await get(pdfKey);
		expect(response.status).toBe(404);
		expect(response.headers.get("cache-control")).toBe("no-store");
	});

	it("are never served as anything else, whatever was stored", async () => {
		// Local storage names the type after the file: HTML bytes under a .pdf name still go out as a sandboxed PDF.
		const htmlKey = "uploads/user-1/documents/portfolio/0d9b6a2c-1e3f-4a5b-8c7d-6e5f4a3b2c1d.pdf";
		await storage.write({
			key: htmlKey,
			data: new TextEncoder().encode("<script>1</script>"),
			contentType: "text/html",
		});
		const local = await get(htmlKey);
		expect(local.headers.get("content-type")).toBe("application/pdf");
		expect(local.headers.get("content-security-policy")).toBe("sandbox");
		expect(local.headers.get("x-content-type-options")).toBe("nosniff");
		// S3 and R2 keep the type it was written with: anything but a PDF stays private.
		const read = vi.spyOn(storage, "read").mockResolvedValueOnce({
			data: new TextEncoder().encode("<script>1</script>"),
			size: 18,
			contentType: "text/html",
		});
		expect((await get(htmlKey)).status).toBe(404);
		read.mockRestore();

		// Anything but <uuid>.pdf in that folder stays private.
		const other = "uploads/user-1/documents/portfolio/notes.txt";
		await storage.write({ key: other, data: new TextEncoder().encode("private"), contentType: "text/plain" });
		expect((await get(other)).status).toBe(404);
		const nested = "uploads/user-1/documents/portfolio/a/b.pdf";
		await storage.write({ key: nested, data: pdfBytes, contentType: "application/pdf" });
		expect((await get(nested)).status).toBe(404);
		const elsewhere = "uploads/user-1/documents/letter.pdf";
		await storage.write({ key: elsewhere, data: pdfBytes, contentType: "application/pdf" });
		expect((await get(elsewhere)).status).toBe(404);
	});

	it("leave pictures exactly as before", async () => {
		const key = "uploads/user-1/pictures/portfolio/9a8b7c6d-5e4f-4a3b-9c2d-1e0f9a8b7c6d.webp";
		await storage.write({ key, data: new Uint8Array([0x52, 0x49, 0x46, 0x46]), contentType: "image/webp" });
		const response = await get(key);
		expect(response.status).toBe(200);
		expect(response.headers.get("content-type")).toBe("image/webp");
		expect(response.headers.get("content-disposition")).toBeNull();
		expect(response.headers.get("content-security-policy")).toBeNull();
		expect(response.headers.get("cache-control")).toBe("public, max-age=3600");
		owners.banned.add("user-1");
		expect((await get(key)).status).toBe(404);
	});
});
