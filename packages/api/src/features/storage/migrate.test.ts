import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import sharp from "sharp";

const mocks = vi.hoisted(() => ({
	list: vi.fn(),
	read: vi.fn(),
	write: vi.fn(),
	delete: vi.fn(),
	healthcheck: vi.fn(),
}));

const env = vi.hoisted(() => ({
	APP_URL: "https://resume.example",
	STORAGE_BACKEND: "local",
	LOCAL_STORAGE_PATH: "./data",
	FLAG_DISABLE_IMAGE_PROCESSING: false,
}));
vi.mock("@rezumi/env/server", () => ({ env }));

const { configureImageProcessor, configureStorageService, migrateUserStorage, processImageForUpload } =
	await import("./service");

beforeEach(() => {
	mocks.list.mockReset();
	mocks.read.mockReset();
	mocks.write.mockReset();
	mocks.delete.mockReset();
	configureStorageService(mocks);
});

describe("migrateUserStorage", () => {
	it("copies all files from the guest prefix to the target user prefix and deletes the originals", async () => {
		const guestKey1 = "uploads/guest-1/pictures/photo.png";
		const guestKey2 = "uploads/guest-1/pictures/resume.pdf";
		const data1 = new Uint8Array([1, 2, 3]);
		const data2 = new Uint8Array([4, 5, 6]);

		mocks.list.mockResolvedValue([guestKey1, guestKey2]);
		mocks.read.mockImplementation(async (key: string) => {
			if (key === guestKey1) return { data: data1, size: 3, contentType: "image/png" };
			if (key === guestKey2) return { data: data2, size: 3, contentType: "application/pdf" };
			return null;
		});
		mocks.write.mockResolvedValue(undefined);
		mocks.delete.mockResolvedValue(true);

		const cleanup = await migrateUserStorage("guest-1", "user-2");
		expect(mocks.delete).not.toHaveBeenCalled();
		await cleanup?.();

		expect(mocks.list).toHaveBeenCalledWith("uploads/guest-1/");
		expect(mocks.write).toHaveBeenCalledWith({
			key: "uploads/user-2/pictures/photo.png",
			data: data1,
			contentType: "image/png",
		});
		expect(mocks.write).toHaveBeenCalledWith({
			key: "uploads/user-2/pictures/resume.pdf",
			data: data2,
			contentType: "application/pdf",
		});
		expect(mocks.delete).toHaveBeenCalledWith(guestKey1);
		expect(mocks.delete).toHaveBeenCalledWith(guestKey2);
	});

	it("completes cleanly when the guest has no uploaded files", async () => {
		mocks.list.mockResolvedValue([]);

		await migrateUserStorage("guest-empty", "user-2");

		expect(mocks.list).toHaveBeenCalledWith("uploads/guest-empty/");
		expect(mocks.read).not.toHaveBeenCalled();
		expect(mocks.write).not.toHaveBeenCalled();
		expect(mocks.delete).not.toHaveBeenCalled();
	});

	it("does not delete any original files if writing a target file fails", async () => {
		const guestKey = "uploads/guest-1/pictures/photo.png";
		const data = new Uint8Array([1, 2, 3]);

		mocks.list.mockResolvedValue([guestKey]);
		mocks.read.mockResolvedValue({ data, size: 3, contentType: "image/png" });
		mocks.write.mockRejectedValue(new Error("Disk full"));

		await expect(migrateUserStorage("guest-1", "user-2")).rejects.toThrow("Disk full");
		expect(mocks.delete).not.toHaveBeenCalled();
	});

	it("skips keys that do not start with fromPrefix", async () => {
		mocks.list.mockResolvedValue(["other-prefix/photo.png"]);

		const cleanup = await migrateUserStorage("guest-1", "user-2");
		expect(mocks.delete).not.toHaveBeenCalled();
		await cleanup?.();

		expect(mocks.read).not.toHaveBeenCalled();
		expect(mocks.write).not.toHaveBeenCalled();
		expect(mocks.delete).not.toHaveBeenCalled();
	});

	it("does nothing and never deletes files when fromUserId equals toUserId", async () => {
		mocks.list.mockResolvedValue(["uploads/user-1/pictures/photo.png"]);

		await migrateUserStorage("user-1", "user-1");

		expect(mocks.list).not.toHaveBeenCalled();
		expect(mocks.read).not.toHaveBeenCalled();
		expect(mocks.write).not.toHaveBeenCalled();
		expect(mocks.delete).not.toHaveBeenCalled();
	});

	it("attempts every copied key cleanup even if one delete fails, without deleting the prefix", async () => {
		const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => {});
		const guestKey1 = "uploads/guest-1/pictures/photo1.png";
		const guestKey2 = "uploads/guest-1/pictures/photo2.png";
		mocks.list.mockResolvedValue([guestKey1, guestKey2]);
		mocks.read.mockImplementation(async () => ({
			data: new Uint8Array([1]),
			size: 1,
			contentType: "image/png",
		}));
		mocks.write.mockResolvedValue(undefined);
		mocks.delete.mockRejectedValueOnce(new Error("Storage timeout on key 1")).mockResolvedValue(true);

		const cleanup = await migrateUserStorage("guest-1", "user-2");
		expect(mocks.delete).not.toHaveBeenCalled();
		await cleanup?.();
		expect(mocks.delete).toHaveBeenCalledWith(guestKey1);
		expect(mocks.delete).toHaveBeenCalledWith(guestKey2);
		expect(mocks.delete).not.toHaveBeenCalledWith("uploads/guest-1/");
		expect(mocks.delete).toHaveBeenCalledTimes(2);
		expect(consoleWarn).toHaveBeenCalled();
		consoleWarn.mockRestore();
	});

	it("preserves every source file when one listed file cannot be read", async () => {
		const guestKey1 = "uploads/guest-1/pictures/photo1.png";
		const guestKey2 = "uploads/guest-1/pictures/photo2.png";
		mocks.list.mockResolvedValue([guestKey1, guestKey2]);
		mocks.read.mockImplementation(async (key: string) => {
			if (key === guestKey1) return { data: new Uint8Array([1]), size: 1, contentType: "image/png" };
			return null;
		});
		mocks.write.mockResolvedValue(undefined);
		mocks.delete.mockResolvedValue(true);

		await expect(migrateUserStorage("guest-1", "user-2")).rejects.toThrow("Could not read");
		expect(mocks.delete).not.toHaveBeenCalled();
	});
});

describe("processImageForUpload", () => {
	it("stores the format the bytes have, not the one the client declared, and rejects anything else", async () => {
		const png = new Uint8Array(
			await sharp({ create: { width: 2, height: 2, channels: 3, background: "#fff" } })
				.png()
				.toBuffer(),
		);
		const html = new TextEncoder().encode("<html><script>alert(1)</script></html>");

		await expect(processImageForUpload(new File([png], "a.gif", { type: "image/gif" }))).resolves.toMatchObject({
			contentType: "image/jpeg",
		});
		await expect(processImageForUpload(new File([html], "a.png", { type: "image/png" }))).rejects.toMatchObject({
			code: "BAD_REQUEST",
		});

		env.FLAG_DISABLE_IMAGE_PROCESSING = true;
		try {
			await expect(processImageForUpload(new File([png], "a.gif", { type: "image/gif" }))).resolves.toEqual({
				data: png,
				contentType: "image/png",
			});
			await expect(processImageForUpload(new File([html], "a.png", { type: "image/png" }))).rejects.toMatchObject({
				code: "BAD_REQUEST",
			});
		} finally {
			env.FLAG_DISABLE_IMAGE_PROCESSING = false;
		}
	});

	it("hands checked pictures to a configured processor and keeps the original when it fails", async () => {
		const png = new Uint8Array(
			await sharp({ create: { width: 2, height: 2, channels: 3, background: "#fff" } })
				.png()
				.toBuffer(),
		);
		const resized = { data: new Uint8Array([1, 2, 3]), contentType: "image/jpeg" };
		const processor = vi.fn().mockResolvedValue(resized);
		const error = vi.spyOn(console, "error").mockImplementation(() => {});
		env.FLAG_DISABLE_IMAGE_PROCESSING = true;
		configureImageProcessor(processor);
		try {
			await expect(processImageForUpload(new File([png], "a.png"))).resolves.toEqual(resized);
			expect(processor).toHaveBeenCalledWith(png, { side: 800, quality: 80 });

			await expect(
				processImageForUpload(new File([new TextEncoder().encode("<svg/>")], "a.png")),
			).rejects.toMatchObject({ code: "BAD_REQUEST" });
			expect(processor).toHaveBeenCalledTimes(1);

			processor.mockResolvedValueOnce(null);
			await expect(processImageForUpload(new File([png], "a.png"))).resolves.toEqual({
				data: png,
				contentType: "image/png",
			});
			processor.mockRejectedValueOnce(new Error("quota"));
			await expect(processImageForUpload(new File([png], "a.png"))).resolves.toEqual({
				data: png,
				contentType: "image/png",
			});
			expect(error).toHaveBeenCalledOnce();
		} finally {
			configureImageProcessor(undefined);
			env.FLAG_DISABLE_IMAGE_PROCESSING = false;
			error.mockRestore();
		}
	});

	it("drops EXIF GPS and XMP from photos stored as they are, keeping the picture", async () => {
		const has = (bytes: Uint8Array, text: string) => Buffer.from(bytes).includes(Buffer.from(text, "latin1"));
		const base = sharp({ create: { width: 8, height: 6, channels: 3, background: "#1e78c8" } })
			.withExif({ IFD0: { Make: "PhoneMaker" }, IFD3: { GPSMapDatum: "HOME STREET" } })
			.withXmp(
				'<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"><rdf:Description xmlns:dc="http://purl.org/dc/elements/1.1/" dc:creator="XMP Dana"/></rdf:RDF></x:xmpmeta>',
			);

		env.FLAG_DISABLE_IMAGE_PROCESSING = true;
		try {
			for (const [format, contentType] of [
				["jpeg", "image/jpeg"],
				["png", "image/png"],
				["webp", "image/webp"],
			] as const) {
				const photo = new Uint8Array(await base.clone().toFormat(format).toBuffer());
				expect(has(photo, "HOME STREET") || has(photo, "XMP Dana"), format).toBe(true);
				const stored = await processImageForUpload(new File([photo], "photo", { type: contentType }));
				expect(stored.contentType).toBe(contentType);
				expect(has(stored.data, "HOME STREET"), format).toBe(false);
				expect(has(stored.data, "PhoneMaker"), format).toBe(false);
				expect(has(stored.data, "XMP Dana"), format).toBe(false);
				expect((await sharp(stored.data).metadata()).width).toBe(8);
			}
		} finally {
			env.FLAG_DISABLE_IMAGE_PROCESSING = false;
		}
	});

	it("drops photo metadata on the Images path too: from its output, and from the original it falls back to", async () => {
		const has = (bytes: Uint8Array, text: string) => Buffer.from(bytes).includes(Buffer.from(text, "latin1"));
		const photo = new Uint8Array(
			await sharp({ create: { width: 8, height: 6, channels: 3, background: "#1e78c8" } })
				.withExif({ IFD3: { GPSMapDatum: "HOME STREET" } })
				.jpeg()
				.toBuffer(),
		);
		const processor = vi.fn().mockResolvedValue({ data: photo, contentType: "image/jpeg" });
		configureImageProcessor(processor);
		try {
			expect(has((await processImageForUpload(new File([photo], "a.jpg"))).data, "HOME STREET")).toBe(false);
			processor.mockResolvedValueOnce(null);
			expect(has((await processImageForUpload(new File([photo], "a.jpg"))).data, "HOME STREET")).toBe(false);
		} finally {
			configureImageProcessor(undefined);
		}
	});
});
