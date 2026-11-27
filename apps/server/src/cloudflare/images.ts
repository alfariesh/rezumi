import type { ImagesBinding, ReadableStream as WorkerReadableStream } from "@cloudflare/workers-types";
import type { ImageProcessor } from "@rezumi/api/features/storage";

/**
 * Same result as the Node server's sharp step: at most 800×800 (or the size asked for, such as a portfolio picture's
 * 2000), JPEG at quality 80, transparency on white.
 */
const PICTURE_SIZE = { side: 800, quality: 80 };
// Stops a small file from decoding into a huge bitmap, like sharp's limitInputPixels on the Node server.
const MAX_INPUT_PIXELS = 25_000_000;

const streamOf = (data: Uint8Array) =>
	new Blob([data as Uint8Array<ArrayBuffer>]).stream() as unknown as WorkerReadableStream<Uint8Array>;

/**
 * Resizes uploaded pictures with the Cloudflare Images binding, since sharp's native modules can't run in a Worker.
 * Without the binding, or for a picture it can't read, the upload keeps the original (see configureImageProcessor).
 */
export function createImagesProcessor(images: () => ImagesBinding | undefined): ImageProcessor {
	return async (data, size = PICTURE_SIZE) => {
		const binding = images();
		if (!binding) return null;
		const info = await binding.info(streamOf(data));
		if (!("width" in info) || info.width * info.height > MAX_INPUT_PIXELS) return null;
		const result = await binding
			.input(streamOf(data))
			.transform({ width: size.side, height: size.side, fit: "scale-down" })
			.output({ format: "image/jpeg", quality: size.quality, background: "#ffffff" });
		const bytes = new Uint8Array(await new Response(result.image() as unknown as BodyInit).arrayBuffer());
		return bytes.byteLength > 0 ? { data: bytes, contentType: "image/jpeg" } : null;
	};
}
