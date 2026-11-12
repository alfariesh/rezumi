import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { initWasm } from "@resvg/resvg-wasm";

/**
 * resvg's WebAssembly, which draws the link-preview cards (`portfolio-card.ts`, `resume-card.ts`). Workers can't read
 * package files, so its entry hands over the module bundled beside the script (`resvg.wasm`, see
 * `tooling/cloudflare/build.mjs`); Node reads the package's file.
 */
let bundled: (() => Promise<WebAssembly.Module>) | undefined;
let ready: Promise<void> | undefined;

/** Workers: how to load the compiled module, set by the Worker entry and called when the first card is drawn. */
export function configureResvgWasm(load: () => Promise<WebAssembly.Module>): void {
	bundled = load;
}

/** Starts resvg once per process; a failed start is tried again on the next card. */
export function initializeResvg(): Promise<void> {
	ready ??= (
		bundled
			? bundled().then((module) => initWasm(module))
			: readFile(fileURLToPath(import.meta.resolve("@resvg/resvg-wasm/index_bg.wasm"))).then((bytes) => initWasm(bytes))
	).catch((error: unknown) => {
		ready = undefined;
		throw error;
	});
	return ready;
}
