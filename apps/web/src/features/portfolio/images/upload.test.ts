import type { UploadImageOptions } from "./upload";
import type { PortfolioImage } from "@rezumi/schema/portfolio/files";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { i18n } from "@lingui/core";
import { ORPCError } from "@orpc/client";
import { PortfolioImageError } from "./compress";
import { imageUploadErrorMessage, MAX_BATCH_PICTURES, uploadImageBatch } from "./upload";

const mocks = vi.hoisted(() => ({ openPlanDialogForError: vi.fn() }));
vi.mock("@/features/billing/plan-dialog", () => ({ openPlanDialogForError: mocks.openPlanDialogForError }));

beforeEach(() => i18n.loadAndActivate({ locale: "en-US", messages: {} }));

const file = (name: string) => new File(["x"], name, { type: "image/jpeg" });

const picture = (name: string): PortfolioImage => ({
	key: `uploads/u1/pictures/portfolio/${name}.webp`,
	width: 800,
	height: 600,
	alt: "",
});

describe("uploadImageBatch", () => {
	it("uploads one at a time with progress, and goes on after a picture that fails, naming it", async () => {
		const progress: number[] = [];
		const upload = vi.fn(async (source: File, _options: UploadImageOptions) => {
			if (source.name === "b.svg") throw new PortfolioImageError("svg");
			return picture(source.name);
		});
		const outcome = await uploadImageBatch([file("a.jpg"), file("b.svg"), file("c.jpg")], {
			upload,
			alt: (index) => `Picture ${index + 1}`,
			onProgress: (step) => progress.push(step.done),
		});
		expect(outcome.uploaded.map((entry) => entry.fileName)).toEqual(["a.jpg", "c.jpg"]);
		expect(outcome.errors).toEqual([
			"“b.svg”: SVG files can't be used. Export the picture as PNG or JPG, then upload it.",
		]);
		expect(outcome.stopped).toBeNull();
		expect(progress).toEqual([0, 1, 2, 3]);
		expect(upload.mock.calls[2]?.[1]).toMatchObject({ alt: "Picture 3" });
	});

	it("stops when the server says too many came in a short time, saying how many didn't go", async () => {
		const upload = vi.fn(async (source: File) => {
			if (source.name !== "a.jpg") throw new ORPCError("TOO_MANY_REQUESTS", { data: { reset: Date.now() } });
			return picture(source.name);
		});
		const outcome = await uploadImageBatch([file("a.jpg"), file("b.jpg"), file("c.jpg"), file("d.jpg")], { upload });
		expect(upload).toHaveBeenCalledTimes(2);
		expect(outcome.stopped).toBe("rate-limited");
		expect(outcome.uploaded).toHaveLength(1);
		expect(outcome.errors).toEqual([
			"Too many uploads in a short time. Wait a minute, then try again. 3 pictures weren't uploaded.",
		]);
	});

	it("stops when the account's storage is full: the rest couldn't go up either", async () => {
		const upload = vi.fn(async (source: File) => {
			if (source.name === "b.jpg")
				throw new ORPCError("PORTFOLIO_STORAGE_FULL", {
					status: 413,
					data: { bytes: 1, maxBytes: 1, files: 1, maxFiles: 1 },
				});
			return picture(source.name);
		});
		const outcome = await uploadImageBatch([file("a.jpg"), file("b.jpg"), file("c.jpg")], { upload });
		expect(upload).toHaveBeenCalledTimes(2);
		expect(outcome.stopped).toBe("storage-full");
		expect(outcome.errors).toEqual([
			"Your portfolio's storage is full. Remove pictures or PDFs you don't need, then try again. 2 pictures weren't uploaded.",
		]);
	});

	it("stops at the plan's storage quota and explains the plan once", async () => {
		mocks.openPlanDialogForError.mockClear();
		const refusal = new ORPCError("PLAN_LIMIT_REACHED", {
			status: 403,
			data: { limit: "portfolioStorageBytes", max: 100 * 1024 * 1024, used: 100 * 1024 * 1024, planId: "free" },
		});
		const upload = vi.fn(() => Promise.reject(refusal));
		const outcome = await uploadImageBatch([file("a.jpg"), file("b.jpg")], { upload });
		expect(upload).toHaveBeenCalledTimes(1);
		expect(outcome.stopped).toBe("storage-full");
		expect(mocks.openPlanDialogForError).toHaveBeenCalledExactlyOnceWith(refusal);
	});

	it("stops when it's cancelled, without counting the picture on its way as a failure", async () => {
		const controller = new AbortController();
		const upload = vi.fn(async (source: File, options: { signal?: AbortSignal }) => {
			if (source.name === "b.jpg") {
				controller.abort();
				options.signal?.throwIfAborted();
			}
			return picture(source.name);
		});
		const outcome = await uploadImageBatch([file("a.jpg"), file("b.jpg"), file("c.jpg")], {
			upload,
			signal: controller.signal,
		});
		expect(outcome).toMatchObject({ stopped: "cancelled", errors: [] });
		expect(outcome.uploaded.map((entry) => entry.fileName)).toEqual(["a.jpg"]);
		expect(upload).toHaveBeenCalledTimes(2);
	});

	it(`takes at most ${MAX_BATCH_PICTURES} pictures at a time and says so`, async () => {
		const upload = vi.fn(async (source: File) => picture(source.name));
		const files = Array.from({ length: MAX_BATCH_PICTURES + 5 }, (_, index) => file(`p${index}.jpg`));
		const outcome = await uploadImageBatch(files, { upload });
		expect(upload).toHaveBeenCalledTimes(MAX_BATCH_PICTURES);
		expect(outcome.errors).toEqual([
			`Up to ${MAX_BATCH_PICTURES} pictures are uploaded at a time. Add the others afterwards.`,
		]);
	});
});

describe("imageUploadErrorMessage", () => {
	it("words the server's refusals in the app's language, never its English message", () => {
		const refused = new ORPCError("PORTFOLIO_FILE_TOO_LARGE", { message: "This picture is too large to upload." });
		expect(imageUploadErrorMessage(refused, "big.jpg")).toBe(
			"“big.jpg”: The picture is still too large after shrinking it. Try a smaller picture.",
		);
		// The API refuses a file over its size limit as a bad request, before reading it.
		expect(imageUploadErrorMessage(new ORPCError("BAD_REQUEST", { message: "Input validation failed" }))).toBe(
			"The picture is still too large after shrinking it. Try a smaller picture.",
		);
		expect(imageUploadErrorMessage(new ORPCError("SOMETHING_NEW", { message: "Raw server text" }))).toBe(
			"The picture couldn't be uploaded. Check your connection and try again.",
		);
		expect(imageUploadErrorMessage(new TypeError("Failed to fetch"))).toBe(
			"The picture couldn't be uploaded. Check your connection and try again.",
		);
	});

	it("tells a file the browser couldn't open (moved, or still in the cloud) from a connection problem", () => {
		expect(imageUploadErrorMessage(new DOMException("Can't read", "NotReadableError"), "photo.heic")).toBe(
			"“photo.heic”: This file can't be opened. If it's stored in the cloud, download it to your device first, then choose it again.",
		);
	});

	it("names the limits a picture is over", () => {
		expect(imageUploadErrorMessage(new PortfolioImageError("too-large"))).toBe(
			"This picture is too large to prepare. Use one under 50 MB and 100 megapixels.",
		);
	});
});
