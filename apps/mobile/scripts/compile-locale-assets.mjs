// Run by Metro before it resolves the app. Each compiled catalog is an offline asset, outside the JS bundle.
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { getCatalogs, createCompiledCatalog } from "@lingui/cli/api";
import { getConfig } from "@lingui/conf";

const directory = new URL("../.cache/lingui/", import.meta.url);
const config = getConfig();
const [catalog] = await getCatalogs(config);
if (!catalog) throw new Error("Mobile Lingui catalog was not found.");
await mkdir(directory, { recursive: true });

for (const locale of config.locales) {
	const { messages } = await catalog.getTranslations(locale, {
		fallbackLocales: config.fallbackLocales,
		sourceLocale: config.sourceLocale,
	});
	const pseudo = config.pseudoLocale.find((item) => item.locale === locale);
	const { source, errors } = createCompiledCatalog(locale, messages, {
		namespace: "json",
		pseudoLocale: pseudo?.locale,
		pseudoLocaleOptions: pseudo?.options,
	});
	if (errors.length > 0) throw new Error(`Invalid messages in ${locale}: ${errors.map(({ id }) => id).join(", ")}`);
	const target = new URL(`${locale}.l10n`, directory);
	if ((await readFile(target, "utf8").catch(() => null)) === source) continue;
	const staged = new URL(`${locale}-${process.pid}.tmp`, directory);
	await writeFile(staged, source);
	await rename(staged, target);
}
