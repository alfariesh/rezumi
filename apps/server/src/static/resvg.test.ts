import { describe, expect, it, vi } from "vite-plus/test";

const initWasm = vi.hoisted(() => vi.fn());
vi.mock("@resvg/resvg-wasm", () => ({ initWasm }));

describe("initializeResvg", () => {
	it("reads the package's file on Node", async () => {
		vi.resetModules();
		initWasm.mockReset().mockResolvedValue(undefined);
		const { initializeResvg } = await import("./resvg");
		await initializeResvg();
		await initializeResvg();
		expect(initWasm).toHaveBeenCalledTimes(1);
		const [bytes] = initWasm.mock.calls[0] as [Uint8Array];
		// The WebAssembly magic number: the real file was read.
		expect([...bytes.subarray(0, 4)]).toEqual([0x00, 0x61, 0x73, 0x6d]);
	});

	it("uses the module the Worker bundled, and tries again after a failed start", async () => {
		vi.resetModules();
		initWasm.mockReset().mockRejectedValueOnce(new Error("no")).mockResolvedValue(undefined);
		const { configureResvgWasm, initializeResvg } = await import("./resvg");
		const module = {} as WebAssembly.Module;
		configureResvgWasm(() => Promise.resolve(module));
		await expect(initializeResvg()).rejects.toThrow("no");
		await initializeResvg();
		expect(initWasm.mock.calls).toEqual([[module], [module]]);
	});
});
