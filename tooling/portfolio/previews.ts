/**
 * Renders the theme gallery pictures: each theme with its own fictional persona (Lugas: Nadia, Prima: Anindya, Kanvas:
 * Bayu, Mozaik: Citra; `persona.ts`), in English and Indonesian, photographed in the system Chrome at twice the pixels.
 * The picture is the top of the page on a 1440×900 desktop screen, in the theme's own mode (Kanvas dark, the others
 * light), with the intro effect finished.
 *
 *   pnpm --filter @rezumi/tooling portfolio:previews [themes…] [--lang en|id] [--out <dir>]
 *
 * Writes, under `apps/web/public/portfolio-themes` unless `--out` says otherwise (Indonesian in an `id/` folder of
 * each, as the resume template gallery does): `jpg/<theme>.jpg` at 1200×750 (the theme's larger picture) and
 * `thumb/<theme>.webp` at 600×375 (gallery cards, `themePicture` in `apps/web/src/features/portfolio/theme-gallery.tsx`).
 */
import type { PersonaLang } from "./persona";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import sharp from "sharp";
import { PORTFOLIO_THEME_INFO, portfolioThemeSchema } from "@rezumi/schema/portfolio/themes";
import { Camera, closePage, loadPictures } from "./browser";
import { PERSONA_LANGS, THEME_PERSONAS } from "./persona";
import { writePersonaPage } from "./render";

const repo = resolve(import.meta.dirname, "../..");
const { values, positionals } = parseArgs({
	allowPositionals: true,
	options: {
		out: { type: "string", default: join(repo, "apps/web/public/portfolio-themes") },
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
const viewport = { width: 1440, height: 900 };
const sizes = { jpg: { width: 1200, height: 750 }, thumb: { width: 600, height: 375 } };

const work = await mkdtemp(join(tmpdir(), "rezumi-portfolio-previews-"));
const camera = await Camera.start();
try {
	for (const theme of themes) {
		for (const lang of langs) {
			const page = await writePersonaPage(work, `${theme}-${lang}.html`, {
				persona: THEME_PERSONAS[theme],
				lang,
				scheme: PORTFOLIO_THEME_INFO[theme].defaultScheme,
			});
			const tab = await camera.open({ viewport, deviceScaleFactor: 2 }, page.file);
			await loadPictures(tab);
			// The intro effect plays to its end, so the picture shows the name as visitors read it.
			await tab.clock.runFor(6000);
			const shot = await tab.screenshot({ animations: "disabled" });
			await closePage(tab);

			const folder = lang === "en" ? "" : lang;
			const jpg = join(values.out, "jpg", folder, `${theme}.jpg`);
			const thumb = join(values.out, "thumb", folder, `${theme}.webp`);
			await mkdir(join(values.out, "jpg", folder), { recursive: true });
			await mkdir(join(values.out, "thumb", folder), { recursive: true });
			const image = await sharp(shot)
				.resize({ ...sizes.jpg, fit: "fill" })
				.jpeg({ quality: 80, mozjpeg: true })
				.toFile(jpg);
			const small = await sharp(shot)
				.resize({ ...sizes.thumb, fit: "fill" })
				.webp({ quality: 80, effort: 6, smartSubsample: true })
				.toFile(thumb);
			console.log(
				`${theme} ${lang}: ${THEME_PERSONAS[theme]}, jpg ${Math.round(image.size / 1024)} KB, thumb ${Math.round(small.size / 1024)} KB`,
			);
		}
	}
} finally {
	await camera.close();
	await rm(work, { recursive: true, force: true });
}
