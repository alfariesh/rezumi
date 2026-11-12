/**
 * Packs dist/ into release/rezumi-extension-<version>.zip, the file the owner uploads to the Chrome Web Store and Edge
 * Add-ons. Run after a production build (`pnpm --filter extension zip` does both).
 */
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { relative } from "node:path";
import { zipSync } from "fflate";
import { distDir, extensionRoot } from "./build-config.ts";

const manifest = JSON.parse(await readFile(`${distDir}/manifest.json`, "utf8")) as { version: string; key?: string };
if (manifest.key)
	throw new Error("dist/ is a development build (its manifest has a key); run a production build first");

const files: Record<string, Uint8Array> = {};
for (const entry of await readdir(distDir, { recursive: true, withFileTypes: true })) {
	if (!entry.isFile() || entry.name === ".DS_Store") continue;
	const path = `${entry.parentPath}/${entry.name}`;
	files[relative(distDir, path)] = await readFile(path);
}

await mkdir(`${extensionRoot}release`, { recursive: true });
const zipPath = `${extensionRoot}release/rezumi-extension-${manifest.version}.zip`;
await writeFile(zipPath, zipSync(files, { level: 9 }));
console.log(`Packed ${Object.keys(files).length} files into ${zipPath}`);
