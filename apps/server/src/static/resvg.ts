import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { initWasm } from "@resvg/resvg-wasm";

/**
 * resvg's WebAssembly, which draws the link-preview cards (`portfolio-card.ts`, `resume-card.ts`). Workers can't read
 * package files, so its entry hands over the module bundled beside the script (`resvg.wasm`, see
 * `tooling/cloudflare/build.mjs`); Node reads the package's file.
 */
let bundled: WebAssembly.Module | undefined;
let ready: Promise<void> | undefined;

/** Workers: the compiled module, imported by the Worker entry. */
export function configureResvgWasm(module: WebAssembly.Module): void {
	bundled = module;
}

/** Starts resvg once per process; a failed start is tried again on the next card. */
export function initializeResvg(): Promise<void> {
	ready ??= (
		bundled
			? initWasm(bundled)
			: readFile(fileURLToPath(import.meta.resolve("@resvg/resvg-wasm/index_bg.wasm"))).then((bytes) => initWasm(bytes))
	).catch((error: unknown) => {
		ready = undefined;
		throw error;
	});
	return ready;
}
