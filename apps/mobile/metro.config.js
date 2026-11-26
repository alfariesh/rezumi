// Expo's defaults follow workspace symlinks and honor package exports. Catalogs ship as offline assets instead of
// embedding every compiled language in the JavaScript bundle.
const { execFileSync } = require("node:child_process");
const { join } = require("node:path");
const { getDefaultConfig } = require("expo/metro-config");
const { withUniwindConfig } = require("uniwind/metro");

execFileSync(process.execPath, [join(__dirname, "scripts/compile-locale-assets.mjs")], {
	cwd: __dirname,
	stdio: "inherit",
});

const config = getDefaultConfig(__dirname);
config.resolver.assetExts.push("l10n");

// Uniwind compiles Tailwind v4 for HeroUI Native; it must wrap the config last.
module.exports = withUniwindConfig(config, { cssEntryFile: "./global.css", dtsFile: "./uniwind-types.d.ts" });
