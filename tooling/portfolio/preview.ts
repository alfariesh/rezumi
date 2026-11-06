/**
 * Renders the portfolio persona to an HTML file, for checking a theme by eye (`02-teknis.md` section 22).
 *
 *   pnpm --filter @rezumi/tooling portfolio:preview --out <dir> [--variant full|minimal|long|rtl] [--scheme light|dark|auto]
 *     [--theme lugas] [--accent <#rrggbb>] [--set work=grid-2] [--name <file>]
 *
 * The page and the persona's pictures (copied from the Phase 00 mockup) land in `<dir>`; open the HTML file in a
 * browser. `--set` picks a section variant (`hero`, `work`, `services`, `testimonials`, `clients`, `experience`,
 * `education`, `skills`, `metric`). The page renders exactly as the server renders it, minus the script's local time.
 */
import type { PortfolioDataInput } from "@rezumi/schema/portfolio/data";
import { copyFile, mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { renderPortfolioPage } from "@rezumi/portfolio";
import { renderPortfolioDocument } from "@rezumi/portfolio/document";
import { portfolioMessages, portfolioViewMessages } from "@rezumi/portfolio/messages";
import { buildPortfolioView } from "@rezumi/portfolio/view";
import { parseWritablePortfolioData } from "@rezumi/schema/portfolio/data";
import { MOCKUP_IMAGES, minimalPortfolio, PERSONA_FILES, personaPortfolio, personaResume } from "./persona";

const { values } = parseArgs({
	options: {
		out: { type: "string", default: "." },
		variant: { type: "string", default: "full" },
		scheme: { type: "string" },
		theme: { type: "string" },
		accent: { type: "string" },
		set: { type: "string", multiple: true, default: [] },
		name: { type: "string", default: "index.html" },
	},
});

const out = resolve(values.out);
await mkdir(join(out, "img"), { recursive: true });

const resume = personaResume();
resume.picture.url = "img/nadia.jpg";
let data: PortfolioDataInput = values.variant === "minimal" ? minimalPortfolio() : personaPortfolio();

if (values.variant === "long") {
	const full = personaPortfolio();
	resume.basics.name = "Nadia Kusumawardhani Rahmawati Puspitasari";
	const works = full.works?.items ?? [];
	data = {
		...full,
		basics: {
			headline: "Senior Product Manager untuk pembayaran digital, merchant, dan eksperimen produk berskala besar",
		},
		works: {
			items: [
				...works,
				// Copies with their own ids and long titles, for a page with twelve works.
				...works.map((work, index) => ({
					...(JSON.parse(
						JSON.stringify(work).replace(/"(id|highlightMetricId)":"([^"]+)"/g, '"$1":"$2-copy"'),
					) as typeof work),
					slug: `copy-${index}`,
					title: `${work.title ?? ""}: catatan lanjutan yang judulnya jauh lebih panjang`.slice(0, 100),
				})),
			],
		},
	};
}
if (values.variant === "rtl") data = { ...personaPortfolio(), locale: "ar-SA" };

const variants = Object.fromEntries(values.set.map((assignment) => assignment.split("=", 2) as [string, string]));
data = {
	...data,
	...(values.theme ? { theme: values.theme as PortfolioDataInput["theme"] } : {}),
	design: {
		...data.design,
		...(values.scheme ? { scheme: values.scheme as "light" | "dark" | "auto" } : {}),
		...(values.accent ? { accent: { source: "custom", color: values.accent } } : {}),
		variants: { ...(data.design?.variants as Record<string, string> | undefined), ...variants },
	},
};

const files = new Map(Object.values(PERSONA_FILES).map((file) => [file.key, file.file]));
for (const file of [...files.values(), "nadia.jpg"])
	await copyFile(fileURLToPath(new URL(file, MOCKUP_IMAGES)), join(out, "img", file));

const parsed = parseWritablePortfolioData(data);
const messages = portfolioMessages(parsed.locale ?? resume.metadata.page.locale);
const view = buildPortfolioView({
	portfolio: { data: parsed },
	resume: { data: resume },
	owner: { name: "Nadia Rahmawati", username: "nadia" },
	entitlements: { hidePortfolioCredit: false },
	messages: portfolioViewMessages(messages),
	fileUrl: (key) => `img/${files.get(key) ?? "missing.png"}`,
	links: { resume: "#cv", resumePdf: "#pdf" },
});
const page = renderPortfolioPage({ view, messages, year: new Date().getFullYear(), creditUrl: "https://rezumi.app" });
const document = renderPortfolioDocument({
	page,
	head: {
		title: view.seo.title,
		description: view.seo.description,
		canonicalUrl: "https://rezumi.app/nadia",
		indexable: false,
	},
});
const target = join(out, values.name);
await writeFile(target, document);
console.log(`Wrote ${target} (${Math.round(document.length / 1024)} KB, script ${page.script.length} bytes)`);
