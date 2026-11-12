import { defineConfig } from "@lingui/cli";
import { formatter } from "@lingui/format-po";

// English is the source; Indonesian ships with the first release (plan rule #9). Any other browser language falls back
// to English (src/sidepanel/i18n.ts).
export default defineConfig({
	sourceLocale: "en",
	locales: ["en", "id"],
	fallbackLocales: { default: "en" },
	format: formatter({ lineNumbers: false }),
	catalogs: [{ path: "<rootDir>/locales/{locale}", include: ["src"] }],
});
