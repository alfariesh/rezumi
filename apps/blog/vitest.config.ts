import { fileURLToPath } from "node:url";
// @boundaries-ignore root shared Vitest config
import { createVitestProjectConfig } from "../../vitest.shared.mts";

// Unit tests cover the pure modules in src/lib and src/i18n; pages are checked against a running site.
export default createVitestProjectConfig({
	name: "blog",
	dirname: fileURLToPath(new URL(".", import.meta.url)),
});
