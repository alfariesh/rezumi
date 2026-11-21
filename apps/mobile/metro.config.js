// Expo's defaults already handle the pnpm monorepo: they watch the workspace root, follow pnpm symlinks to one
// React copy and honour package "exports"/"imports" (S2). The only addition compiles Lingui `.po` catalogs on import.
const { getDefaultConfig } = require("expo/metro-config");
const { withUniwindConfig } = require("uniwind/metro");

const config = getDefaultConfig(__dirname);

config.transformer.babelTransformerPath = require.resolve("@lingui/metro-transformer/expo");
config.resolver.sourceExts.push("po");

// Uniwind compiles Tailwind v4 for HeroUI Native; it must wrap the config last.
module.exports = withUniwindConfig(config, { cssEntryFile: "./global.css", dtsFile: "./uniwind-types.d.ts" });
