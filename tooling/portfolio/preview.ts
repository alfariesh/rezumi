/**
 * Renders a portfolio persona to an HTML file, for checking a theme by eye (`02-teknis.md` section 22).
 *
 *   pnpm --filter @rezumi/tooling portfolio:preview --out <dir> [--persona nadia|anindya|bayu|citra] [--lang id|en]
 *     [--variant full|minimal|long|rtl] [--scheme light|dark|auto] [--theme lugas|prima|kanvas|mozaik]
 *     [--accent <#rrggbb>] [--effect none|fade-up|…] [--set work=grid-2] [--name <file>]
 *
 * Nadia (Lugas) in Indonesian is the default; each persona renders in its own theme unless `--theme` says otherwise
 * (`persona.ts`). The page and the persona's pictures land in `<dir>`; open the HTML file in a browser. `--set` picks a
 * section variant (`hero`, `work`, `services`, `testimonials`, `clients`, `experience`, `education`, `skills`,
 * `metric`). The page renders exactly as the server renders it; the page script fills in the local time.
 */
import type { PortfolioHeroEffect, PortfolioScheme, PortfolioTheme } from "@rezumi/schema/portfolio/themes";
import { resolve } from "node:path";
import { parseArgs } from "node:util";
import { PORTFOLIO_HERO_EFFECTS, PORTFOLIO_SCHEMES, PORTFOLIO_THEMES } from "@rezumi/schema/portfolio/themes";
import { isPersonaId, PERSONA_LANGS, PERSONA_VARIANTS } from "./persona";
import { writePersonaPage } from "./render";

const { values } = parseArgs({
	options: {
		out: { type: "string", default: "." },
		persona: { type: "string", default: "nadia" },
		lang: { type: "string", default: "id" },
		variant: { type: "string", default: "full" },
		scheme: { type: "string" },
		theme: { type: "string" },
		accent: { type: "string" },
		effect: { type: "string" },
		set: { type: "string", multiple: true, default: [] },
		name: { type: "string", default: "index.html" },
	},
});

/** The value when it is one of `options`, otherwise an error naming them. */
function oneOf<T extends string>(name: string, value: string, options: readonly T[]): T {
	if ((options as readonly string[]).includes(value)) return value as T;
	throw new Error(`Unknown ${name} "${value}": use ${options.join(", ")}.`);
}

if (!isPersonaId(values.persona)) throw new Error(`Unknown persona "${values.persona}".`);
const page = await writePersonaPage(resolve(values.out), values.name, {
	persona: values.persona,
	lang: oneOf("language", values.lang, PERSONA_LANGS),
	variant: oneOf("variant", values.variant, PERSONA_VARIANTS),
	...(values.theme ? { theme: oneOf<PortfolioTheme>("theme", values.theme, PORTFOLIO_THEMES) } : {}),
	...(values.scheme ? { scheme: oneOf<PortfolioScheme>("scheme", values.scheme, PORTFOLIO_SCHEMES) } : {}),
	...(values.effect ? { effect: oneOf<PortfolioHeroEffect>("effect", values.effect, PORTFOLIO_HERO_EFFECTS) } : {}),
	...(values.accent ? { accent: values.accent } : {}),
	variants: Object.fromEntries(values.set.map((assignment) => assignment.split("=", 2) as [string, string])),
});
console.log(
	`Wrote ${page.file} (${page.theme}, ${Math.round(page.bytes / 1024)} KB, script ${page.scriptBytes} bytes)`,
);
