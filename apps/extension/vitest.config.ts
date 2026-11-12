import { fileURLToPath } from "node:url";
import { lingui } from "@lingui/vite-plugin";
// @boundaries-ignore root shared Vitest config
import { createVitestProjectConfig } from "../../vitest.shared.mts";

export default createVitestProjectConfig({
	name: "extension",
	dirname: fileURLToPath(new URL(".", import.meta.url)),
	plugins: [lingui({ macroTransform: true })],
});
