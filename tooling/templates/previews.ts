/**
 * Renders the gallery samples: each template with its fictional persona (`personas/`) and its preset look, in English
 * and Indonesian, as the sample PDF and the preview images the web app and the mobile picker show.
 *
 *   pnpm --filter @rezumi/tooling templates:previews [templates…] [--locale en|id] [--out <dir>]
 *
 * Writes, under `apps/web/public/templates` unless `--out` says otherwise (Indonesian under an `id/` folder of each):
 * `pdf/<id>.pdf`, `jpg/<id>.jpg` at 600×848 (builder and letter cards, the mobile picker, the README),
 * `thumb/<id>.webp` at 596×843 and `thumb/<id>-small.webp` at 300×424 (homepage and gallery), and the English page at
 * 1242×1756 for the docs (`docs/images/templates/<id>.webp`, or `<out>/docs` with `--out`). Needs `pdftoppm` (poppler)
 * to draw the first page. Renders are deterministic: an unchanged persona writes the same bytes.
 */
import type { Locale } from "./personas/persona";
import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import sharp from "sharp";
import { createResumePdfFile } from "@rezumi/pdf/server";
import { applyTemplatePreset } from "@rezumi/resume/template-preset";
import { templateSchema } from "@rezumi/schema/templates";
import { personas } from "./personas";
import { buildPersonaResume } from "./personas/persona";

const repo = resolve(import.meta.dirname, "../..");
const publicTemplates = join(repo, "apps/web/public/templates");
const { values, positionals } = parseArgs({
	allowPositionals: true,
	options: {
		out: { type: "string", default: publicTemplates },
		locale: { type: "string", multiple: true, default: ["en", "id"] },
	},
});

const templates = positionals.length > 0 ? positionals.map((id) => templateSchema.parse(id)) : templateSchema.options;
const locales = values.locale.map((locale) => {
	if (locale !== "en" && locale !== "id") throw new Error(`Unknown locale "${locale}": use en or id.`);
	return locale satisfies Locale;
});
const docs = values.out === publicTemplates ? join(repo, "docs/images/templates") : join(values.out, "docs");
const work = await mkdtemp(join(tmpdir(), "rezumi-previews-"));
// A4 at 300 dpi; every sample is A4.
const page = (width: number) => ({ width, height: Math.round((width * 3508) / 2481), fit: "fill" as const });
const webp = { quality: 75, effort: 6, smartSubsample: true };

try {
	for (const template of templates) {
		const persona = personas[template];
		const photo = persona.photo
			? `data:image/jpeg;base64,${(await readFile(join(import.meta.dirname, "photos", `${template}.jpg`))).toString("base64")}`
			: "";

		for (const locale of locales) {
			const data = buildPersonaResume(persona, template, locale, photo);
			applyTemplatePreset(data, template);
			persona.finish?.(data);

			const folder = locale === "en" ? "" : locale;
			const target = (kind: string, file: string) => join(values.out, kind, folder, file);
			await Promise.all(
				["pdf", "jpg", "thumb"].map((kind) => mkdir(join(values.out, kind, folder), { recursive: true })),
			);

			const file = await createResumePdfFile({ data, filename: `${template}.pdf` });
			const pdf = Buffer.from(await file.arrayBuffer());
			await writeFile(target("pdf", `${template}.pdf`), pdf);

			const png = join(work, `${template}-${locale}`);
			execFileSync("pdftoppm", [
				"-png",
				"-r",
				"300",
				"-singlefile",
				"-f",
				"1",
				"-l",
				"1",
				target("pdf", `${template}.pdf`),
				png,
			]);
			const first = await readFile(`${png}.png`);
			await sharp(first)
				.resize(page(600))
				.jpeg({ mozjpeg: true, quality: 75 })
				.toFile(target("jpg", `${template}.jpg`));
			await sharp(first)
				.resize(page(596))
				.webp(webp)
				.toFile(target("thumb", `${template}.webp`));
			await sharp(first)
				.resize(page(300))
				.webp(webp)
				.toFile(target("thumb", `${template}-small.webp`));
			if (locale === "en") {
				await mkdir(docs, { recursive: true });
				await sharp(first)
					.resize(page(1242))
					.webp(webp)
					.toFile(join(docs, `${template}.webp`));
			}

			const pages = pdf.toString("latin1").match(/\/Type\s*\/Page\b(?!s)/g)?.length ?? 0;
			console.log(`${template} ${locale}: ${pages} page${pages === 1 ? "" : "s"}`);
		}
	}
} finally {
	await rm(work, { recursive: true, force: true });
}
