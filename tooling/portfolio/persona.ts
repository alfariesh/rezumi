/**
 * The fictional people of the portfolio themes (`01-desain.md` sections 5 and 14), in English and Indonesian: Nadia
 * Rahmawati (Lugas, Paper), Anindya Dewi (Prima), Bayu Saputra (Kanvas), Citra Maharani (Mozaik, Brutal), Raka
 * Mahendra (Sintaks) and Laras Kusumawardhani (Warta). Raka's and Laras' portraits (`raka.jpg`, `laras.jpg`) are
 * illustrations, not photos. Their
 * careers are the gallery's resume personas (`tooling/templates/personas`), their portfolios follow the Phase 00
 * mockups (`.agents/docs/plans/portfolio/mockups/<theme>.html`). Every name, company, client, testimonial, number and
 * link is made up. Pictures are the mockups' own drawings and photos (`mockups/img`); client logos and the sample PDFs
 * are drawn here.
 *
 * Variants (`02-teknis.md` section 22): `full` (A) fills everything, every block type included; `minimal` (B) has no
 * photo, no work pictures and one Text block per work; `long` (C) has many works, a very long name and long work
 * titles; `rtl` (D) is the full portfolio as an Arabic (`ar-SA`) page with an Arabic intro.
 */
import type { PortfolioDataInput } from "@rezumi/schema/portfolio/data";
import type { PortfolioTheme } from "@rezumi/schema/portfolio/themes";
import type { ResumeData } from "@rezumi/schema/resume/data";
import type { Template } from "@rezumi/schema/templates";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { PORTFOLIO_LIMITS } from "@rezumi/schema/portfolio/limits";
import { personas as resumePersonas } from "../templates/personas";
import { buildPersonaResume } from "../templates/personas/persona";
import { anindya } from "./personas/anindya";
import { bayu } from "./personas/bayu";
import { citra } from "./personas/citra";
import { laras } from "./personas/laras";
import { nadia } from "./personas/nadia";
import { raka } from "./personas/raka";

const MOCKUP_IMAGES = new URL("../../.agents/docs/plans/portfolio/mockups/img/", import.meta.url);

export const PERSONA_IDS = ["nadia", "anindya", "bayu", "citra", "raka", "laras"] as const;
export type PersonaId = (typeof PERSONA_IDS)[number];
export const PERSONA_LANGS = ["en", "id"] as const;
export type PersonaLang = (typeof PERSONA_LANGS)[number];
export const PERSONA_VARIANTS = ["full", "minimal", "long", "rtl"] as const;
export type PersonaVariant = (typeof PERSONA_VARIANTS)[number];

/** A text in English, then Indonesian. A plain string reads the same in both (names, companies, numbers). */
type Text = string | readonly [en: string, id: string];

type WorkInput = NonNullable<NonNullable<PortfolioDataInput["works"]>["items"]>[number];
type BlockInput = NonNullable<WorkInput["blocks"]>[number];
type MetricInput = NonNullable<NonNullable<PortfolioDataInput["hero"]>["highlights"]>[number];
type ImageInput = NonNullable<WorkInput["cover"]>;

type MetricExtra = Omit<MetricInput, "id" | "label" | "value" | "prefix" | "suffix" | "context" | "change"> & {
	prefix?: Text;
	suffix?: Text;
	context?: Text;
	change?: { direction: "up" | "down" | "neutral"; text: Text; good: boolean };
};

type WorkSource = {
	id: string;
	slug: string;
	title: Text;
	summary: Text;
	role: Text;
	date: Text;
	tags?: readonly Text[];
	/** A mockup drawing. */
	cover: string;
	/** The first is the metric the work's card highlights; they form a Metrics block after the first block. */
	metrics: readonly MetricInput[];
	blocks: readonly BlockInput[];
	featured?: boolean;
};

/** What a persona's portfolio is written with: the language, and stored files that point at mockup drawings. */
type PersonaKit = {
	t: (text: Text) => string;
	/** A mockup drawing as a stored picture (1200×900 unless `size` says otherwise). */
	picture: (file: string, alt?: Text, size?: { width: number; height: number }) => ImageInput;
	/** A made-up client's wordmark: one of six abstract marks and the name, in `color`. */
	logo: (name: string, mark: number, color: string) => ImageInput;
	/** A sample PDF with `pages` pages, as its storage key. */
	pdf: (name: string, title: string, pages: number) => string;
	metric: (id: string, label: Text, value: number | Text, extra?: MetricExtra) => MetricInput;
	text: (id: string, html: Text) => BlockInput;
	work: (work: WorkSource) => WorkInput;
};

export type PersonaDefinition = {
	id: PersonaId;
	theme: PortfolioTheme;
	/** The gallery's resume persona with the same career. */
	resume: Template;
	username: string;
	/** The resume's accent, which the portfolio follows ("Follow resume", the mockup's own colour). */
	accent: string;
	/** The photo in `mockups/img`. */
	photo: string;
	profiles: readonly { network: string; username: string; url: string; icon: string }[];
	/** Variant B's one-sentence intro. */
	minimal: Text;
	/** Variant C's very long name (one word of 19 letters or more) and headline. */
	long: { name: string; headline: Text };
	/** Variant D's Arabic intro. */
	arabic: { headline: string; greeting: string; availability: string };
	portfolio: (kit: PersonaKit) => PortfolioDataInput;
};

const DEFINITIONS: Record<PersonaId, PersonaDefinition> = { nadia, anindya, bayu, citra, raka, laras };

/** The persona each theme's gallery picture, mockup and default matrix rows show. */
export const THEME_PERSONAS: Record<PortfolioTheme, PersonaId> = {
	lugas: "nadia",
	prima: "anindya",
	kanvas: "bayu",
	mozaik: "citra",
	paper: "nadia",
	brutal: "citra",
	sintaks: "raka",
	warta: "laras",
};

/** A stored file the persona's portfolio uses. */
type PersonaFile = {
	/** The storage key in the portfolio data (pictures `.png`, documents `.pdf`). */
	key: string;
	/** The file's name next to a rendered page (`img/<name>`), in its own format: SVG drawings, JPEG photos, PDFs. */
	name: string;
	kind: "image" | "pdf";
	/** Pixel size of a picture; zero for a PDF. */
	width: number;
	height: number;
	pages?: number;
	read: () => Promise<Buffer>;
};

export type Persona = {
	id: PersonaId;
	theme: PortfolioTheme;
	owner: { name: string; username: string };
	resume: ResumeData;
	portfolio: PortfolioDataInput;
	files: PersonaFile[];
	/** The resume's photo, in `mockups/img`. */
	photo: Pick<PersonaFile, "name" | "read">;
};

const mockup = (name: string) => () => readFile(fileURLToPath(new URL(name, MOCKUP_IMAGES)));

const escapeXml = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** The mockups' six abstract client marks, on a 24×24 grid. */
const MARKS = [
	'<circle cx="12" cy="12" r="9" fill="none" stroke="C" stroke-width="2.4"/><circle cx="12" cy="12" r="3.6" fill="C"/>',
	'<rect x="3" y="5" width="18" height="5" rx="2.5" fill="C"/><rect x="3" y="14" width="12" height="5" rx="2.5" fill="C"/>',
	'<path d="M2 20 9.5 7l4 6.5L16 10l6 10z" fill="C"/>',
	'<path d="M5 19C5 10 10 4 20 4c0 10-6 15-15 15z" fill="C"/><path d="M5 19 13 11" stroke="#fff" stroke-width="1.6"/>',
	'<rect x="3" y="3" width="8" height="8" rx="2" fill="C"/><rect x="13" y="3" width="8" height="8" rx="4" fill="C"/><rect x="3" y="13" width="8" height="8" rx="4" fill="C"/><rect x="13" y="13" width="8" height="8" rx="2" fill="C"/>',
	'<path d="M2 9c3.3-3 6.7 3 10 0s6.7 3 10 0M2 15c3.3-3 6.7 3 10 0s6.7 3 10 0" fill="none" stroke="C" stroke-width="2.4" stroke-linecap="round"/>',
];

/** A wordmark 64 px high: the mark at 40 px, then the name in bold. Widths are estimated from the name's length. */
function logoSvg(name: string, mark: number, color: string): { svg: string; width: number; height: number } {
	const width = Math.round(64 + name.length * 13.6);
	const shape = (MARKS[mark % MARKS.length] ?? "").replaceAll('"C"', `"${color}"`);
	const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="64" viewBox="0 0 ${width} 64"><g transform="translate(4 12) scale(1.6667)">${shape}</g><text x="56" y="42" font-family="Helvetica, Arial, sans-serif" font-size="24" font-weight="700" fill="${color}">${escapeXml(name)}</text></svg>`;
	return { svg, width, height: 64 };
}

/** A small valid PDF of A4 pages, each with the title on it. */
function samplePdf(title: string, pages: number): Buffer {
	const ascii = title
		.normalize("NFKD")
		.replace(/[^\x20-\x7e]/g, "")
		.replace(/[()\\]/g, "\\$&");
	const content = `BT /F1 22 Tf 64 760 Td (${ascii}) Tj 0 -32 Td /F1 12 Tf (Sample document for a fictional portfolio.) Tj ET`;
	const objects = [
		"<</Type/Catalog/Pages 2 0 R>>",
		`<</Type/Pages/Kids[${Array.from({ length: pages }, (_, index) => `${index + 5} 0 R`).join(" ")}]/Count ${pages}>>`,
		"<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>",
		`<</Length ${content.length}>>\nstream\n${content}\nendstream`,
		...Array.from(
			{ length: pages },
			() => "<</Type/Page/Parent 2 0 R/MediaBox[0 0 595 842]/Resources<</Font<</F1 3 0 R>>>>/Contents 4 0 R>>",
		),
	];
	let body = "%PDF-1.4\n";
	const offsets = objects.map((object, index) => {
		const offset = body.length;
		body += `${index + 1} 0 obj\n${object}\nendobj\n`;
		return offset;
	});
	const xref = body.length;
	body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("")}`;
	body += `trailer\n<</Size ${objects.length + 1}/Root 1 0 R>>\nstartxref\n${xref}\n%%EOF\n`;
	return Buffer.from(body, "latin1");
}

function createKit(definition: PersonaDefinition, lang: PersonaLang, files: Map<string, PersonaFile>): PersonaKit {
	const t = (text: Text) => (typeof text === "string" ? text : text[lang === "en" ? 0 : 1]);
	const root = `uploads/persona-${definition.id}`;
	const register = (file: PersonaFile) => {
		if (!files.has(file.key)) files.set(file.key, file);
		return file;
	};
	const picture: PersonaKit["picture"] = (name, alt = "", size = { width: 1200, height: 900 }) => {
		const file = register({
			key: `${root}/pictures/portfolio/${name.replace(/\.\w+$/, "")}.png`,
			name,
			kind: "image",
			...size,
			read: mockup(name),
		});
		return { key: file.key, width: file.width, height: file.height, alt: t(alt) };
	};
	const metric: PersonaKit["metric"] = (id, label, value, extra = {}) => {
		const { prefix, suffix, context, change, ...rest } = extra;
		return {
			id,
			label: t(label),
			value: typeof value === "number" ? { kind: "number", number: value } : { kind: "text", text: t(value) },
			...rest,
			...(prefix === undefined ? {} : { prefix: t(prefix) }),
			...(suffix === undefined ? {} : { suffix: t(suffix) }),
			...(context === undefined ? {} : { context: t(context) }),
			...(change ? { change: { ...change, text: t(change.text) } } : {}),
		};
	};
	return {
		t,
		picture,
		logo: (name, mark, color) => {
			const slug = name.toLowerCase().replace(/[^\da-z]+/g, "-");
			const { svg, width, height } = logoSvg(name, mark, color);
			const file = register({
				key: `${root}/pictures/portfolio/logo-${slug}.png`,
				name: `${definition.id}-logo-${slug}.svg`,
				kind: "image",
				width,
				height,
				read: () => Promise.resolve(Buffer.from(svg)),
			});
			return { key: file.key, width, height, alt: name };
		},
		pdf: (name, title, pages) => {
			const file = register({
				key: `${root}/documents/portfolio/${name}.pdf`,
				name: `${definition.id}-${name}.pdf`,
				kind: "pdf",
				width: 0,
				height: 0,
				pages,
				read: () => Promise.resolve(samplePdf(title, pages)),
			});
			return file.key;
		},
		metric,
		text: (id, html) => ({ id, type: "text", html: t(html) }),
		work: (work) => {
			const [first, ...rest] = work.blocks;
			const title = t(work.title);
			return {
				id: work.id,
				slug: work.slug,
				title,
				summary: t(work.summary),
				role: t(work.role),
				date: t(work.date),
				tags: (work.tags ?? []).map(t),
				cover: picture(work.cover, [`Cover: ${title}`, `Sampul: ${title}`]),
				...(work.metrics[0] ? { highlightMetricId: work.metrics[0].id } : {}),
				// The highlighted metric's block follows the first text block, where a reader expects the result.
				blocks: [
					...(first ? [first] : []),
					...(work.metrics.length ? [{ id: `${work.id}-m`, type: "metrics" as const, items: [...work.metrics] }] : []),
					...rest,
				],
				featured: work.featured ?? false,
				hidden: false,
			};
		},
	};
}

/** The resume: the gallery persona's career in the chosen language, with the portfolio's accent and profiles. */
function personaResume(definition: PersonaDefinition, lang: PersonaLang): ResumeData {
	const data = buildPersonaResume(resumePersonas[definition.resume], definition.resume, lang);
	data.metadata.design.colors.primary = definition.accent;
	data.picture = { ...data.picture, url: "", hidden: false };
	data.basics.customFields = [];
	data.sections.profiles.items = definition.profiles.map((profile, index) => ({
		id: `${definition.id}-profile-${index + 1}`,
		hidden: false,
		icon: profile.icon,
		iconColor: "",
		network: profile.network,
		username: profile.username,
		website: { url: profile.url, label: "", inlineLink: false },
	}));
	// The portfolio shows works instead of the resume's projects.
	data.sections.projects.items = [];
	return data;
}

/** Sections a minimal page leaves out, so it shows little more than the intro, three works and contact. */
const MINIMAL_HIDDEN = [
	"profiles",
	"experience",
	"education",
	"skills",
	"certifications",
	"languages",
	"awards",
	"publications",
	"volunteer",
	"interests",
] as const;

/** A copy of the items with ids that stay unique, for the long variant. */
function copies<T>(items: readonly T[], tag: string): T[] {
	return items.map(
		(item) => JSON.parse(JSON.stringify(item).replace(/"(id|highlightMetricId)":"([^"]+)"/g, `"$1":"$2-${tag}"`)) as T,
	);
}

/**
 * One persona in one language and variant: the resume, the portfolio data (in its own theme) and the files it uses.
 * Storage keys name a placeholder account (`uploads/persona-<id>/…`).
 */
export function buildPersona(id: PersonaId, options: { lang?: PersonaLang; variant?: PersonaVariant } = {}): Persona {
	const { lang = "id", variant = "full" } = options;
	const definition = DEFINITIONS[id];
	const files = new Map<string, PersonaFile>();
	const kit = createKit(definition, lang, files);
	const resume = personaResume(definition, lang);
	const full = definition.portfolio(kit);
	let portfolio: PortfolioDataInput = {
		...full,
		theme: definition.theme,
		locale: lang === "en" ? "en-US" : "id-ID",
	};

	if (variant === "minimal") {
		const works = (full.works?.items ?? []).slice(0, 3).map((work) => {
			const { cover: _cover, highlightMetricId: _highlight, ...rest } = work;
			return {
				...rest,
				blocks: [{ id: `${work.id}-only`, type: "text" as const, html: `<p>${escapeXml(work.summary ?? "")}</p>` }],
			};
		});
		portfolio = {
			theme: definition.theme,
			locale: portfolio.locale,
			basics: { picture: null },
			hero: { greeting: kit.t(definition.minimal), showPicture: false, buttons: [{ kind: "contact" }] },
			about: { content: "" },
			works: { items: works },
			location: { label: full.location?.label ?? "" },
			contact: full.contact ?? {},
			sections: { order: [], hidden: [...MINIMAL_HIDDEN], titles: {}, hiddenItems: {} },
		};
		// Files only the full page uses stay out, so a seeded account holds just what its page shows.
		files.clear();
	}

	if (variant === "long") {
		resume.basics.name = definition.long.name;
		const works = full.works?.items ?? [];
		const longer = kit.t([
			": a follow-up note whose title runs much longer",
			": catatan lanjutan yang judulnya jauh lebih panjang",
		]);
		portfolio = {
			...portfolio,
			basics: { ...portfolio.basics, headline: kit.t(definition.long.headline) },
			works: {
				items: [
					...works,
					...copies(works, "copy").map((work, index) => ({
						...work,
						slug: `${work.slug}-${index + 2}`,
						title: `${work.title ?? ""}${longer}`.slice(0, PORTFOLIO_LIMITS.text.workTitle),
						featured: false,
					})),
				],
			},
			services: { items: [...(full.services?.items ?? []), ...copies(full.services?.items ?? [], "copy")] },
			testimonials: {
				items: [...(full.testimonials?.items ?? []), ...copies(full.testimonials?.items ?? [], "copy")],
			},
			clients: { items: [...(full.clients?.items ?? []), ...copies(full.clients?.items ?? [], "copy")] },
		};
	}

	if (variant === "rtl") {
		portfolio = {
			...portfolio,
			locale: "ar-SA",
			basics: { ...portfolio.basics, headline: definition.arabic.headline },
			hero: {
				...portfolio.hero,
				greeting: definition.arabic.greeting,
				availability: { ...portfolio.hero?.availability, show: true, text: definition.arabic.availability },
			},
		};
	}

	return {
		id,
		theme: definition.theme,
		owner: { name: resume.basics.name, username: definition.username },
		resume,
		portfolio,
		files: [...files.values()],
		photo: { name: definition.photo, read: mockup(definition.photo) },
	};
}

export function isPersonaId(value: string): value is PersonaId {
	return (PERSONA_IDS as readonly string[]).includes(value);
}
