import { describe, expect, it } from "vite-plus/test";
import { build } from "vite-plus";
import { CONTENT_SCRIPT_BUDGET_BYTES, contentScriptConfig } from "../../scripts/build-config";

describe("content script", () => {
	it("stays within its budget and ships neither React nor Zod", { timeout: 30_000 }, async () => {
		const config = contentScriptConfig({ dev: false, rezumiUrl: "https://rezumi.app", version: "0.0.0" });
		const result = await build({ ...config, logLevel: "silent", build: { ...config.build, write: false } });
		// With `write: false`, a library build resolves to its bundles' output.
		type Bundle = { output: { fileName: string; type: string; code?: string }[] };
		const bundles = (Array.isArray(result) ? result : [result]) as Bundle[];
		const chunk = bundles.flatMap((bundle) => bundle.output).find((file) => file.fileName === "content.js");
		if (chunk?.type !== "chunk" || chunk.code === undefined) throw new Error("No content.js in the build");

		expect(Buffer.byteLength(chunk.code)).toBeLessThanOrEqual(CONTENT_SCRIPT_BUDGET_BYTES);
		expect(chunk.code).not.toMatch(/react|ZodError|\$ZodType/i);
		// A classic script: manifest content scripts cannot use import.
		expect(chunk.code).not.toMatch(/^\s*import\s|\bexport\s*\{/m);
	});
});
