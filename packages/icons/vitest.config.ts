import { fileURLToPath } from "node:url";
// @boundaries-ignore root shared Vitest config
import { createVitestProjectConfig } from "../../vitest.shared.mts";

export default createVitestProjectConfig({
	name: "@rezumi/icons",
	dirname: fileURLToPath(new URL(".", import.meta.url)),
});
