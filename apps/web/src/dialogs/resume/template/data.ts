import type { MessageDescriptor } from "@lingui/core";
import type { CareerField, Template } from "@rezumi/schema/templates";
import { msg } from "@lingui/core/macro";

/** The galleries' field filter, in `careerFields` order (`templateCareerFields` says which templates suit each). */
export const careerFieldNames = {
	tech: msg({ comment: "Template gallery filter: technology jobs", message: "Tech" }),
	creative: msg({ comment: "Template gallery filter: creative jobs such as design and writing", message: "Creative" }),
	finance: msg({ comment: "Template gallery filter: finance, banking, law and consulting jobs", message: "Finance" }),
	government: msg({
		comment: "Template gallery filter: civil service and state-owned companies (Indonesian: Pemerintahan & BUMN)",
		message: "Government & state-owned",
	}),
	academic: msg({ comment: "Template gallery filter: research, teaching and scholarships", message: "Academic" }),
	graduate: msg({ comment: "Template gallery filter: a first job or internship", message: "Fresh graduate" }),
} as const satisfies Record<CareerField, MessageDescriptor>;

export type TemplateMetadata = {
	name: string;
	description: MessageDescriptor;
	tags: string[];
};

/**
 * A template's sample PDF and its previews (`pnpm --filter @rezumi/tooling templates:previews`). Each sample has an
 * English and an Indonesian version: Indonesian pages show the Indonesian one, every other language the English one.
 */
export const templateSample = (id: Template, locale: string) => {
	const folder = locale.split("-")[0] === "id" ? "id/" : "";
	return {
		pdf: `/templates/pdf/${folder}${id}.pdf`,
		/** 600×848 JPEG: builder and letter cards. */
		image: `/templates/jpg/${folder}${id}.jpg`,
		/** 596×843 and 300×424 WebP: the gallery and the homepage. */
		thumbnail: `/templates/thumb/${folder}${id}.webp`,
		smallThumbnail: `/templates/thumb/${folder}${id}-small.webp`,
	};
};

export const templates = {
	aksara: {
		name: "Aksara",
		description: msg`An editorial single column set like a magazine feature: a small kicker over a large display name and serif section titles between hairlines. For writers, designers and communications roles.`,
		tags: ["Single-column", "ATS friendly", "Editorial", "Serif", "Writer", "Designer"],
	},
	atlas: {
		name: "Atlas",
		description: msg`A Swiss grid: section titles in a narrow left column, entries beside them, and a hairline across the page above each section.`,
		tags: ["Single-column", "ATS friendly", "Swiss grid", "Minimal", "Consulting", "Design"],
	},
	cendekia: {
		name: "Cendekia",
		description: msg`An academic CV in a quiet serif, with small capital section titles and room for long lists of publications, grants and teaching. Suits research and scholarship applications.`,
		tags: ["Single-column", "ATS friendly", "Academic", "Research", "Scholarship", "Serif"],
	},
	horizon: {
		name: "Horizon",
		description: msg`An accent band across the top carries the name, headline and contact line in light text, with two columns below and the sidebar on the right.`,
		tags: ["Two-column", "Header band", "Modern", "Corporate", "Marketing"],
	},
	jejak: {
		name: "Jejak",
		description: msg`Your career as a path: experience and education hang from a fine line with an accent dot at each step, beside a left sidebar.`,
		tags: ["Two-column", "Timeline", "Modern", "Career story", "Creative"],
	},
	kirana: {
		name: "Kirana",
		description: msg`A soft wash of the accent down the left column for skills and languages; the name, a round portrait and the contact line lead the main column.`,
		tags: ["Two-column", "Soft sidebar", "Modern", "Photo", "Versatile"],
	},
	linen: {
		name: "Linen",
		description: msg`White and airy: an elegant serif name, the sidebar on the right set apart by a single hairline, and no fills anywhere.`,
		tags: ["Two-column", "Minimal", "Elegant", "Serif", "Design"],
	},
	meridian: {
		name: "Meridian",
		description: msg`A clean, modern single column: a large name, an accent headline, and small section labels with a fine rule. The default for every field.`,
		tags: ["Single-column", "ATS friendly", "Modern", "Clean", "Versatile"],
	},
	purnama: {
		name: "Purnama",
		description: msg`A deep night sidebar where a large serif name, the portrait and the contact lines glow in light text, beside a white main column.`,
		tags: ["Two-column", "Dark sidebar", "Elegant", "Photo", "Executive"],
	},
	senja: {
		name: "Senja",
		description: msg`The creative page: a block of the accent anchors the top corner, framing your portrait, beside an oversized name; two columns follow.`,
		tags: ["Two-column", "Creative", "Bold", "Design", "Marketing"],
	},
	sterling: {
		name: "Sterling",
		description: msg`A classic centred header with the name in tracked capitals and ruled section titles. Quiet and authoritative for finance, law and consulting.`,
		tags: ["Single-column", "ATS friendly", "Classic", "Finance", "Law", "Consulting"],
	},
	summit: {
		name: "Summit",
		description: msg`An executive page: a bold accent rule along the top, a commanding name and section titles underlined in the accent.`,
		tags: ["Single-column", "ATS friendly", "Executive", "Leadership", "Senior"],
	},
	tenun: {
		name: "Tenun",
		description: msg`A structured grid inspired by the Japanese rirekisho and the Indonesian DRH: the header and every section in hairline boxes with a tinted title band.`,
		tags: ["Single-column", "ATS friendly", "Ruled grid", "Structured", "Government", "Asian style"],
	},
	tunas: {
		name: "Tunas",
		description: msg`Compact and fresh for a first job or an internship: a tight rhythm that keeps to one page and a short accent bar before each section title.`,
		tags: ["Single-column", "ATS friendly", "Compact", "Fresh graduate", "Internship"],
	},
	vector: {
		name: "Vector",
		description: msg`For developers and data people: monospace accents for the headline, dates and labels, and skills as chips that can carry tool logos.`,
		tags: ["Single-column", "ATS friendly", "Developer", "Data", "Tech", "Monospace"],
	},
	wibawa: {
		name: "Wibawa",
		description: msg`The formal Indonesian CV: a portrait beside the name and a column of personal details, with firm ruled section titles. Fits state-owned companies, civil service and local employers.`,
		tags: ["Single-column", "ATS friendly", "Formal", "Photo", "Indonesia", "Government"],
	},
	anggrek: {
		name: "Anggrek",
		description: msg`A centred page with the poise of a hotel letterhead: a display serif name, a small tracked headline, a short accent ornament and section titles set between two hairlines. For hospitality, PR and private banking.`,
		tags: ["Single-column", "ATS friendly", "Elegant", "Serif", "Centred", "Hospitality"],
	},
	awan: {
		name: "Awan",
		description: msg`A soft rounded panel floats in the left column with your portrait, name and contact lines above the supporting sections, beside an open white main column.`,
		tags: ["Two-column", "Rounded panel", "Soft", "Photo", "Creative"],
	},
	bingkai: {
		name: "Bingkai",
		description: msg`A classic page inside a fine double frame, with a serif name and ruled capital section titles. Suits academic, legal and public policy applications.`,
		tags: ["Single-column", "ATS friendly", "Classic", "Framed", "Serif", "Academic"],
	},
	cahaya: {
		name: "Cahaya",
		description: msg`The name leads the main column from the top of the page, and the right column stands beside it behind a firm accent rule, with small capital titles.`,
		tags: ["Two-column", "Accent rule", "Modern", "Tech", "Finance"],
	},
	cerah: {
		name: "Cerah",
		description: msg`Friendly and bright: a round portrait beside the name and every section title on a soft rounded band, so a short first resume still looks finished.`,
		tags: ["Single-column", "ATS friendly", "Friendly", "Fresh graduate", "Tech"],
	},
	cobalt: {
		name: "Cobalt",
		description: msg`An executive page with a firm hand: a solid accent bar beside the name block and tracked capital titles over a full-width rule. For government and finance.`,
		tags: ["Single-column", "ATS friendly", "Executive", "Formal", "Government", "Finance"],
	},
	fajar: {
		name: "Fajar",
		description: msg`A soft wash of the accent fills the top of the page edge to edge behind your name and contact line, with two open columns below and the sidebar on the left.`,
		tags: ["Two-column", "Soft header band", "Fresh", "Fresh graduate", "Communications"],
	},
	graphite: {
		name: "Graphite",
		description: msg`A charcoal column down the right with labels lit in your accent, beside a white main column led by your name. Bright accents such as gold or cyan shine on it.`,
		tags: ["Two-column", "Dark sidebar", "Modern", "Tech lead", "Finance"],
	},
	ivory: {
		name: "Ivory",
		description: msg`Nordic quiet: a large name in a light weight, wide white space between sections, light titles led by one accent dot, and entries on a single line.`,
		tags: ["Single-column", "ATS friendly", "Minimal", "Light", "Designer", "Product"],
	},
	kontras: {
		name: "Kontras",
		description: msg`Poster type: a tall condensed name over a heavy ink rule and display section titles with a rule running on. Bold, high-contrast and made for creatives.`,
		tags: ["Single-column", "ATS friendly", "Bold", "Poster", "Art director", "Creative"],
	},
	lintasan: {
		name: "Lintasan",
		description: msg`One column with your career as a track: experience and education hang from a fine line with a ringed dot at each step, and section titles sit on the same axis.`,
		tags: ["Single-column", "ATS friendly", "Timeline", "Fresh graduate", "Early career"],
	},
	marquee: {
		name: "Marquee",
		description: msg`Your name in lights: a very large display name over a thick accent rule across the page, and the right column's sections on soft rounded cards.`,
		tags: ["Two-column", "Bold name", "Cards", "Creative", "Producer"],
	},
	menara: {
		name: "Menara",
		description: msg`The left column stands like a tower: a solid accent block at its top holds your name and contact lines, and a faint wash of the accent carries it down the page.`,
		tags: ["Two-column", "Accent block", "Corporate", "Finance", "State-owned"],
	},
	mozaik: {
		name: "Mozaik",
		description: msg`A bento page: the header is a solid tile of the accent and every section sits on its own soft rounded tile, with skills as chips.`,
		tags: ["Single-column", "ATS friendly", "Bento", "Cards", "Designer", "Product"],
	},
	nusa: {
		name: "Nusa",
		description: msg`Confident and graphic: a heavy name, and every section opens with its title as a solid accent tag with a rule running to the margin.`,
		tags: ["Single-column", "ATS friendly", "Bold", "Marketing", "Sales", "Fresh graduate"],
	},
	pilar: {
		name: "Pilar",
		description: msg`A formal page held by an accent rail down the left margin, with a solid stretch beside the name and a ringed marker for each section. For banking, audit and government.`,
		tags: ["Single-column", "ATS friendly", "Formal", "Banking", "Audit", "Government"],
	},
	sekar: {
		name: "Sekar",
		description: msg`A centred serif header with the portrait above the name, over two columns; the left column rests on a soft rounded card of the accent.`,
		tags: ["Two-column", "Elegant", "Serif", "Centred", "Creative", "Academic"],
	},
	selaras: {
		name: "Selaras",
		description: msg`A split header with your name on one side and the contact lines stacked behind a hairline on the other, accent-barred titles and dates above each entry.`,
		tags: ["Single-column", "ATS friendly", "Split header", "Consulting", "Product", "Fintech"],
	},
	tepi: {
		name: "Tepi",
		description: msg`A slim stripe of the accent runs down the page edge on the sidebar's side, the sidebar sits behind a hairline and main titles open with a short accent dash.`,
		tags: ["Two-column", "Edge stripe", "Minimal", "Research", "Tech"],
	},
	teras: {
		name: "Teras",
		description: msg`Friendly but formal: your portrait and name open the page, the contact details follow in a softly tinted bar, and titles sit over a soft thick rule. Fits fresh graduates, state-owned companies and civil service.`,
		tags: ["Single-column", "ATS friendly", "Formal", "Contact bar", "Fresh graduate", "Government"],
	},
} as const satisfies Record<Template, TemplateMetadata>;
