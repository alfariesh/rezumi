import { cp, mkdir, readdir, rm, stat } from "node:fs/promises";
import { builtinModules, createRequire } from "node:module";
import { relative, resolve } from "node:path";
import { build } from "esbuild";

const root = resolve(import.meta.dirname, "../..");
const output = resolve(root, "apps/server/dist-cloudflare");
const require = createRequire(resolve(root, "apps/server/package.json"));
const hugeicons = resolve(root, "packages/pdf/src/forme/hugeicons");
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await build({
	absWorkingDir: root,
	entryPoints: ["apps/server/src/cloudflare/index.ts"],
	outfile: `${output}/index.js`,
	bundle: true,
	format: "esm",
	platform: "neutral",
	mainFields: ["browser", "module", "main"],
	conditions: ["workerd", "worker", "browser"],
	target: "es2022",
	minify: true,
	external: ["node:*", "cloudflare:*", ...builtinModules],
	banner: {
		js: 'import { createRequire } from "node:module"; const require = createRequire("file:///bundle/index.js");',
	},
	alias: {
		sharp: "./apps/server/src/cloudflare/sharp.ts",
	},
	define: {
		__APP_VERSION__: JSON.stringify(require("../../package.json").version),
		"import.meta.url": JSON.stringify("file:///bundle/index.js"),
	},
	plugins: [
		{
			name: "forme-wasm",
			setup(builder) {
				builder.onResolve({ filter: /^css-tree$/ }, () => ({ path: require.resolve("css-tree/dist/csstree.esm") }));
				builder.onResolve({ filter: /\.wasm$/ }, () => ({ path: "./forme.wasm", external: true }));
			},
		},
		{
			// The icon drawings (~3.7 MB) parsed as script pushed Worker startup past its CPU limit. Each file ships
			// as a Text module instead, parsed when a render first draws that style.
			name: "hugeicons-text",
			setup(builder) {
				builder.onResolve({ filter: /\.json$/, namespace: "file" }, (args) => {
					const file = relative(hugeicons, resolve(args.resolveDir, args.path));
					return /^\w+\/\w+\.json$/.test(file) ? { path: file, namespace: "hugeicons" } : undefined;
				});
				builder.onLoad({ filter: /.*/, namespace: "hugeicons" }, (args) => ({
					contents: `import text from "./hugeicons/${args.path}"; export default JSON.parse(text);`,
				}));
				builder.onResolve({ filter: /^\.\/hugeicons\//, namespace: "hugeicons" }, (args) => ({
					path: args.path,
					external: true,
				}));
			},
		},
	],
});
// Cloudflare refuses a Worker whose global scope takes over 1 s of CPU, and only a real deploy checks it: an 11 MiB
// script started in about 850 ms. Ship large data as a Text module, as the icons above, instead of growing the script.
const { size } = await stat(`${output}/index.js`);
if (size > 12 * 2 ** 20) {
	throw new Error(`Worker script is ${(size / 2 ** 20).toFixed(1)} MiB, over its 12 MiB startup budget`);
}
await cp(require.resolve("@formepdf/core/pkg-web/forme_bg.wasm"), `${output}/forme.wasm`);
await mkdir(`${output}/prompts`);
for (const name of await readdir(resolve(root, "packages/ai/src/prompts"))) {
	if (name.endsWith(".md")) await cp(resolve(root, "packages/ai/src/prompts", name), `${output}/prompts/${name}`);
}
await cp(hugeicons, `${output}/hugeicons`, { recursive: true, filter: (path) => !path.endsWith(".ts") });
await cp(resolve(root, "apps/web/dist"), `${output}/assets`, { recursive: true });
await cp(resolve(root, "apps/web/dist-prerender"), `${output}/assets/_prerender`, { recursive: true });
