/**
 * Writes the landing page's theme previews: each theme's whole page with its fictional persona (`THEME_PERSONAS`), in
 * English and Indonesian, as a still document the landing opens in a sandboxed frame (no script runs; the intro effect
 * shows its end). Each case study has its own still document. The pages share one folder of pictures.
 *
 *   pnpm --filter @rezumi/tooling portfolio:samples [themes…] [--lang en|id] [--out <dir>]
 *
 * Writes, under `apps/web/public/portfolio-themes/sample` unless `--out` says otherwise: `<theme>.html` (English),
 * `id/<theme>.html` (Indonesian), their neighbouring `<theme>.work-<slug>.html` pages, and `img/`. Run it
 * with `portfolio:previews` whenever a theme or a persona changes.
 */
import type { PersonaLang } from "./persona";
import type { PageOptions } from "./render";
import { mkdir, rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { PORTFOLIO_THEME_INFO, portfolioThemeSchema } from "@rezumi/schema/portfolio/themes";
import { PERSONA_LANGS, THEME_PERSONAS } from "./persona";
import { writePersonaPage } from "./render";

const repo = resolve(import.meta.dirname, "../..");
const { values, positionals } = parseArgs({
	allowPositionals: true,
	options: {
		out: { type: "string", default: join(repo, "apps/web/public/portfolio-themes/sample") },
		lang: { type: "string", multiple: true, default: [...PERSONA_LANGS] },
	},
});

const themes = positionals.length
	? positionals.map((id) => portfolioThemeSchema.parse(id))
	: portfolioThemeSchema.options;
const langs = values.lang.map((lang) => {
	if (!(PERSONA_LANGS as readonly string[]).includes(lang))
		throw new Error(`Unknown language "${lang}": use en or id.`);
	return lang as PersonaLang;
});

// A full run starts from an empty folder, so pictures no persona uses any more don't linger.
if (!positionals.length && values.lang.length === PERSONA_LANGS.length)
	await rm(values.out, { recursive: true, force: true });

for (const theme of themes) {
	for (const lang of langs) {
		const info = PORTFOLIO_THEME_INFO[theme];
		const dir = join(values.out, lang === "en" ? "" : lang);
		await mkdir(dir, { recursive: true });
		const name = `${theme}.html`;
		const options: PageOptions = {
			persona: THEME_PERSONAS[theme],
			theme,
			...(info.fallbackAccent ? { accent: info.fallbackAccent } : {}),
			lang,
			scheme: info.defaultScheme,
			sample: { assetBase: "/portfolio-themes/sample/img/", imageDir: values.out, assetVersion: "2" },
		};
		const page = await writePersonaPage(dir, name, options);
		for (const work of page.workSlugs) await writePersonaPage(dir, name, { ...options, work });
		console.log(`${theme} ${lang}: ${THEME_PERSONAS[theme]}, ${page.workSlugs.length} case studies`);
	}
}
