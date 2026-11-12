/**
 * Builds the extension into dist/: the side panel and service worker (ES modules), the content script (one classic
 * script), and manifest.json.
 *
 *   node scripts/build.ts              production build for the stores (REZUMI_URL defaults to https://rezumi.app)
 *   node scripts/build.ts --dev        development build (http://localhost:3000, logs, EXTENSION_KEY if set)
 *   node scripts/build.ts --dev --watch
 *
 * Then "Load unpacked" apps/extension/dist in chrome://extensions or edge://extensions.
 */
import { readFile, rm, stat, writeFile } from "node:fs/promises";
import { build } from "vite-plus";
import { buildManifest, CHROME_STORE_PUBLIC_KEY } from "../manifest.config.ts";
import {
	CONTENT_SCRIPT_BUDGET_BYTES,
	contentScriptConfig,
	distDir,
	extensionPagesConfig,
	extensionRoot,
} from "./build-config.ts";

const dev = process.argv.includes("--dev");
const watch = process.argv.includes("--watch");
const rezumiUrl = process.env.REZUMI_URL?.trim() || (dev ? "http://localhost:3000" : "https://rezumi.app");
// The Chrome Web Store item's public key (02-teknis.md §15), never in a store build. EXTENSION_KEY overrides it.
const key = dev ? process.env.EXTENSION_KEY?.trim() || CHROME_STORE_PUBLIC_KEY : undefined;

if (!dev && !rezumiUrl.startsWith("https://"))
	throw new Error(`A store build must talk to an https server: ${rezumiUrl}`);

const { version } = JSON.parse(await readFile(`${extensionRoot}package.json`, "utf8")) as { version: string };
const options = { dev, rezumiUrl, version };
const watchOption = watch ? { watch: {} } : {};

await rm(distDir, { recursive: true, force: true });
await build({ ...extensionPagesConfig(options), build: { ...extensionPagesConfig(options).build, ...watchOption } });
await build({ ...contentScriptConfig(options), build: { ...contentScriptConfig(options).build, ...watchOption } });
await writeFile(
	`${distDir}/manifest.json`,
	`${JSON.stringify(buildManifest({ version, rezumiUrl, key }), null, "\t")}\n`,
);

if (!dev) {
	const { size } = await stat(`${distDir}/content.js`);
	if (size > CONTENT_SCRIPT_BUDGET_BYTES)
		throw new Error(`content.js is ${size} bytes, over its ${CONTENT_SCRIPT_BUDGET_BYTES}-byte budget`);
}

console.log(`Built Rezumi extension ${version} for ${rezumiUrl}${dev ? " (development)" : ""} into ${distDir}`);
