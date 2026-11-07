import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { createRouterClient } from "@orpc/server";

const storage = vi.hoisted(() => ({ delete: vi.fn<(key: string) => Promise<boolean>>() }));

vi.mock("../../context", async () => {
	const { os } = await vi.importActual<typeof import("@orpc/server")>("@orpc/server");
	return { protectedProcedure: os.$context<{ user: { id: string } }>() };
});
vi.mock("../billing/limits", () => ({ assertFeature: vi.fn() }));
vi.mock("./service", () => ({
	getStorageService: () => storage,
	isImageFile: vi.fn(),
	processImageForUpload: vi.fn(),
	uploadFile: vi.fn(),
	uploadFontFile: vi.fn(),
}));

const { storageRouter } = await import("./router");

const client = () =>
	createRouterClient(storageRouter, { context: { user: { id: "member" }, reqHeaders: new Headers() } as never });

describe("storage.deleteFile", () => {
	beforeEach(() => {
		storage.delete.mockReset().mockResolvedValue(true);
	});

	it("deletes the account's own files", async () => {
		await client().deleteFile({ filename: "photo.jpg" });
		await client().deleteFile({ filename: "uploads/member/pictures/portfolio-persona.jpg" });
		expect(storage.delete.mock.calls).toEqual([
			["uploads/member/pictures/photo.jpg"],
			["uploads/member/pictures/portfolio-persona.jpg"],
		]);
	});

	it("never deletes portfolio files, their folders, or a folder holding them", async () => {
		for (const filename of [
			"portfolio/a.webp",
			"uploads/member/pictures/portfolio/a.webp",
			"uploads/member/documents/portfolio/deck.pdf",
			"uploads/member/pictures/portfolio",
			"/uploads/member/documents/portfolio/",
			"uploads/member/pictures",
			"uploads/member/documents",
			"uploads/member",
		])
			await expect(client().deleteFile({ filename }), filename).rejects.toMatchObject({
				code: "FORBIDDEN",
				status: 403,
			});
		expect(storage.delete).not.toHaveBeenCalled();
	});

	it("still refuses other accounts' files", async () => {
		await expect(client().deleteFile({ filename: "uploads/other/pictures/photo.jpg" })).rejects.toMatchObject({
			code: "FORBIDDEN",
		});
		expect(storage.delete).not.toHaveBeenCalled();
	});
});
