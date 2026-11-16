import type { ImagesBinding } from "@cloudflare/workers-types";
import { describe, expect, it, vi } from "vite-plus/test";
import { createImagesProcessor } from "./images";

function binding(info: object, output = new Uint8Array([9, 8, 7])) {
	const transform = vi.fn();
	const outputOptions = vi.fn();
	const transformer = {
		transform: (options: unknown) => {
			transform(options);
			return transformer;
		},
		output: async (options: unknown) => {
			outputOptions(options);
			return { image: () => new Blob([output]).stream() };
		},
	};
	const images = { info: vi.fn().mockResolvedValue(info), input: vi.fn(() => transformer) };
	return { images: images as unknown as ImagesBinding, transform, outputOptions };
}

describe("createImagesProcessor", () => {
	it("resizes to an 800 px JPEG on white, as sharp does", async () => {
		const { images, transform, outputOptions } = binding({
			format: "image/png",
			width: 2000,
			height: 1000,
			fileSize: 1,
		});

		await expect(createImagesProcessor(() => images)(new Uint8Array([1]))).resolves.toEqual({
			data: new Uint8Array([9, 8, 7]),
			contentType: "image/jpeg",
		});
		expect(transform).toHaveBeenCalledWith({ width: 800, height: 800, fit: "scale-down" });
		expect(outputOptions).toHaveBeenCalledWith({ format: "image/jpeg", quality: 80, background: "#ffffff" });
	});

	it("keeps the original without the binding, for oversized bitmaps, SVG and empty output", async () => {
		const data = new Uint8Array([1]);
		await expect(createImagesProcessor(() => undefined)(data)).resolves.toBeNull();
		const huge = binding({ format: "image/png", width: 10_000, height: 10_000, fileSize: 1 });
		await expect(createImagesProcessor(() => huge.images)(data)).resolves.toBeNull();
		expect(huge.transform).not.toHaveBeenCalled();
		const svg = binding({ format: "image/svg+xml" });
		await expect(createImagesProcessor(() => svg.images)(data)).resolves.toBeNull();
		const empty = binding({ format: "image/png", width: 1, height: 1, fileSize: 1 }, new Uint8Array());
		await expect(createImagesProcessor(() => empty.images)(data)).resolves.toBeNull();
	});
});
