import type { InlineConfig } from "vite-plus";
import { fileURLToPath } from "node:url";
import { lingui } from "@lingui/vite-plugin";
import babel from "@rolldown/plugin-babel";
import tailwindcss from "@tailwindcss/vite";
import viteReact, { reactCompilerPreset } from "@vitejs/plugin-react";

export const extensionRoot = fileURLToPath(new URL("..", import.meta.url));
export const distDir = `${extensionRoot}dist`;

/** The content script runs on every job board page, so it stays small (02-teknis.md §4). */
export const CONTENT_SCRIPT_BUDGET_BYTES = 50 * 1024;

export type BuildOptions = {
	dev: boolean;
	rezumiUrl: string;
	version: string;
};

const defines = ({ dev, rezumiUrl, version }: BuildOptions) => ({
	__DEV__: JSON.stringify(dev),
	__REZUMI_URL__: JSON.stringify(rezumiUrl),
	__EXTENSION_VERSION__: JSON.stringify(version),
	"process.env.NODE_ENV": JSON.stringify(dev ? "development" : "production"),
});

/** The side panel page and the service worker: ES modules, sharing chunks. */
export const extensionPagesConfig = (options: BuildOptions): InlineConfig => ({
	configFile: false,
	root: extensionRoot,
	mode: options.dev ? "development" : "production",
	envDir: false,
	publicDir: "public",
	define: defines(options),
	plugins: [
		tailwindcss(),
		viteReact(),
		lingui({ macroTransform: { parser: { syntax: "typescript", tsx: true } } }),
		babel({ presets: [reactCompilerPreset()] }),
	],
	build: {
		outDir: distDir,
		// scripts/build.ts empties dist/ once; a watch rebuild must keep the content script and manifest.
		emptyOutDir: false,
		// No remote code: everything ships inside the package (Manifest V3).
		modulePreload: false,
		minify: !options.dev,
		sourcemap: options.dev ? "inline" : false,
		chunkSizeWarningLimit: 2 * 1024,
		rolldownOptions: {
			input: {
				sidepanel: `${extensionRoot}sidepanel.html`,
				background: `${extensionRoot}src/background/index.ts`,
			},
			output: {
				// The manifest names the worker "background.js".
				entryFileNames: (chunk) => (chunk.name === "background" ? "background.js" : "assets/[name]-[hash].js"),
			},
		},
	},
});

/** The content script: one classic script (manifest content scripts cannot be modules), no React and no Zod. */
export const contentScriptConfig = (options: BuildOptions): InlineConfig => ({
	configFile: false,
	root: extensionRoot,
	mode: options.dev ? "development" : "production",
	envDir: false,
	publicDir: false,
	define: defines(options),
	build: {
		outDir: distDir,
		emptyOutDir: false,
		minify: !options.dev,
		sourcemap: options.dev ? "inline" : false,
		lib: {
			entry: `${extensionRoot}src/content/index.ts`,
			formats: ["iife"],
			name: "rezumiContent",
			fileName: () => "content.js",
		},
	},
});
