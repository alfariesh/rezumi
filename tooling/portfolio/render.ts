/**
 * Renders a persona's portfolio to an HTML file exactly as the server renders the public page (`apps/server/src/
 * static/portfolio-page.ts`), with the persona's pictures, logos and PDFs copied next to it under `img/`. Shared by
 * `preview.ts`, `previews.ts` and `matrix.ts`.
 */
import type { PersonaId, PersonaLang, PersonaVariant } from "./persona";
import type { PortfolioDataInput } from "@rezumi/schema/portfolio/data";
import type { PortfolioHeroEffect, PortfolioScheme, PortfolioTheme } from "@rezumi/schema/portfolio/themes";
import { mkdir, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { portfolioIconNames, renderPortfolioPage } from "@rezumi/portfolio";
import { renderPortfolioDocument } from "@rezumi/portfolio/document";
import { portfolioMessages, portfolioViewMessages } from "@rezumi/portfolio/messages";
import { buildPortfolioView } from "@rezumi/portfolio/view";
import { parseWritablePortfolioData } from "@rezumi/schema/portfolio/data";
import { buildPersona } from "./persona";

export type PageOptions = {
	persona: PersonaId;
	lang?: PersonaLang;
	variant?: PersonaVariant;
	/** Another theme than the persona's own. */
	theme?: PortfolioTheme;
	scheme?: PortfolioScheme;
	/** A custom accent, `#rrggbb`. */
	accent?: string;
	effect?: PortfolioHeroEffect;
	/** Section variants, such as `{ work: "grid-2" }`. */
	variants?: Record<string, string>;
};

export type RenderedPage = {
	file: string;
	/** The first visible work's detail anchor (`work-<slug>`), if the page has works. */
	firstWork: string | null;
	theme: PortfolioTheme;
	scheme: PortfolioScheme;
	/** The intro effect the page plays (the theme's own when it doesn't support the one asked for). */
	effect: PortfolioHeroEffect;
	bytes: number;
	scriptBytes: number;
};

type HeroEffectInput = NonNullable<NonNullable<PortfolioDataInput["hero"]>["effect"]>;

let glyphs: Promise<Readonly<Record<string, string>>> | null = null;
const copied = new Set<string>();

async function copyOnce(path: string, read: () => Promise<Buffer>) {
	if (copied.has(path)) return;
	copied.add(path);
	if (
		await stat(path).then(
			() => true,
			() => false,
		)
	)
		return;
	await writeFile(path, await read());
}

/** Writes `<dir>/<name>` and the files it uses to `<dir>/img/`. */
export async function writePersonaPage(dir: string, name: string, options: PageOptions): Promise<RenderedPage> {
	const persona = buildPersona(options.persona, {
		...(options.lang ? { lang: options.lang } : {}),
		...(options.variant ? { variant: options.variant } : {}),
	});
	await mkdir(join(dir, "img"), { recursive: true });
	for (const file of [...persona.files, persona.photo]) await copyOnce(join(dir, "img", file.name), file.read);

	const resume = persona.resume;
	resume.picture.url = `img/${persona.photo.name}`;
	let data = persona.portfolio;
	data = {
		...data,
		...(options.theme ? { theme: options.theme } : {}),
		...(options.effect
			? { hero: { ...data.hero, effect: { ...data.hero?.effect, id: options.effect } as HeroEffectInput } }
			: {}),
		design: {
			...data.design,
			...(options.scheme ? { scheme: options.scheme } : {}),
			...(options.accent ? { accent: { source: "custom", color: options.accent } } : {}),
			variants: { ...(data.design?.variants as Record<string, string> | undefined), ...options.variants },
		},
	};

	const names = new Map(persona.files.map((file) => [file.key, file.name]));
	const parsed = parseWritablePortfolioData(data);
	const messages = portfolioMessages(parsed.locale ?? resume.metadata.page.locale);
	const view = buildPortfolioView({
		portfolio: { data: parsed },
		resume: { data: resume },
		owner: persona.owner,
		entitlements: { hidePortfolioCredit: false },
		messages: portfolioViewMessages(messages),
		fileUrl: (key) => `img/${names.get(key) ?? "missing.png"}`,
		links: { resume: "#cv", resumePdf: "#pdf" },
	});
	const iconNames = portfolioIconNames(view);
	if (iconNames.length && !glyphs)
		glyphs = import("@rezumi/pdf/icon-glyphs").then(({ loadIconGlyphs }) => loadIconGlyphs("standard"));
	const shapes = iconNames.length && glyphs ? await glyphs : {};
	const page = renderPortfolioPage({
		view,
		messages,
		icons: Object.fromEntries(iconNames.flatMap((icon) => (shapes[icon] ? [[icon, shapes[icon]]] : []))),
		year: 2026,
		creditUrl: "https://rezumi.app",
	});
	const document = renderPortfolioDocument({
		page,
		head: {
			title: view.seo.title,
			description: view.seo.description,
			canonicalUrl: `https://rezumi.app/${persona.owner.username}`,
			indexable: false,
		},
	});
	const file = join(dir, name);
	await writeFile(file, document);
	const first = view.works[0];
	return {
		file,
		firstWork: first ? first.anchor : null,
		theme: view.theme,
		scheme: view.design.scheme,
		effect: view.design.effect.id,
		bytes: document.length,
		scriptBytes: page.script.length,
	};
}
