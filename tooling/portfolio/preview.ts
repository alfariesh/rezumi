/**
 * Renders a portfolio persona to an HTML file, for checking a theme by eye (`02-teknis.md` section 22).
 *
 *   pnpm --filter @rezumi/tooling portfolio:preview --out <dir> [--persona <id>] [--lang id|en]
 *     [--variant full|minimal|long|rtl] [--scheme light|dark|auto] [--theme <theme>]
 *     [--accent <#rrggbb>] [--effect none|fade-up|…] [--set work=grid-2] [--name <file>] [--work <slug>] [--works]
 *
 * Nadia (Lugas) in Indonesian is the default. With `--theme`, the gallery persona for that theme is the default.
 * With `--persona` alone, the persona's own theme is used. The page and pictures land in `<dir>`. `--set` picks a
 * section variant (`hero`, `work`, `services`, `testimonials`, `clients`, `experience`, `education`, `skills`,
 * `metric`). The page renders exactly as the server renders it; the page script fills in the local time. `--work`
 * also writes that work's own page (Phase 13 B2), `--works` every listed work's, each beside the home page as
 * `<name>.work-<slug>.html`, so the cards and the work pages' links lead from one to the other.
 */
import type { PortfolioHeroEffect, PortfolioScheme, PortfolioTheme } from "@rezumi/schema/portfolio/themes";
import { resolve } from "node:path";
import { parseArgs } from "node:util";
import { listedWorkSlugs, parseWritablePortfolioData } from "@rezumi/schema/portfolio/data";
import {
	PORTFOLIO_HERO_EFFECTS,
	PORTFOLIO_SCHEMES,
	PORTFOLIO_THEME_INFO,
	PORTFOLIO_THEMES,
} from "@rezumi/schema/portfolio/themes";
import { buildPersona, isPersonaId, PERSONA_LANGS, PERSONA_VARIANTS, THEME_PERSONAS } from "./persona";
import { writePersonaPage } from "./render";

const { values } = parseArgs({
	options: {
		out: { type: "string", default: "." },
		persona: { type: "string" },
		lang: { type: "string", default: "id" },
		variant: { type: "string", default: "full" },
		scheme: { type: "string" },
		theme: { type: "string" },
		accent: { type: "string" },
		effect: { type: "string" },
		set: { type: "string", multiple: true, default: [] },
		name: { type: "string", default: "index.html" },
		work: { type: "string" },
		works: { type: "boolean", default: false },
	},
});

/** The value when it is one of `options`, otherwise an error naming them. */
function oneOf<T extends string>(name: string, value: string, options: readonly T[]): T {
	if ((options as readonly string[]).includes(value)) return value as T;
	throw new Error(`Unknown ${name} "${value}": use ${options.join(", ")}.`);
}

const theme = values.theme ? oneOf<PortfolioTheme>("theme", values.theme, PORTFOLIO_THEMES) : undefined;
const personaId = values.persona ?? (theme ? THEME_PERSONAS[theme] : "nadia");
if (!isPersonaId(personaId)) throw new Error(`Unknown persona "${personaId}".`);
const accent = values.accent ?? (theme ? PORTFOLIO_THEME_INFO[theme].fallbackAccent : undefined);
const options = {
	persona: personaId,
	lang: oneOf("language", values.lang, PERSONA_LANGS),
	variant: oneOf("variant", values.variant, PERSONA_VARIANTS),
	...(theme ? { theme } : {}),
	...(values.scheme ? { scheme: oneOf<PortfolioScheme>("scheme", values.scheme, PORTFOLIO_SCHEMES) } : {}),
	...(values.effect ? { effect: oneOf<PortfolioHeroEffect>("effect", values.effect, PORTFOLIO_HERO_EFFECTS) } : {}),
	...(accent ? { accent } : {}),
	variants: Object.fromEntries(values.set.map((assignment) => assignment.split("=", 2) as [string, string])),
};
const page = await writePersonaPage(resolve(values.out), values.name, options);
console.log(
	`Wrote ${page.file} (${page.theme}, ${Math.round(page.bytes / 1024)} KB, script ${page.scriptBytes} bytes)`,
);

const persona = buildPersona(options.persona, { lang: options.lang, variant: options.variant });
const slugs = values.works
	? listedWorkSlugs(parseWritablePortfolioData(persona.portfolio))
	: values.work
		? [values.work]
		: [];
for (const slug of slugs) {
	const work = await writePersonaPage(resolve(values.out), values.name, { ...options, work: slug });
	console.log(`Wrote ${work.file} (the work's own page)`);
}
