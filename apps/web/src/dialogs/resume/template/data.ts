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
} as const satisfies Record<Template, TemplateMetadata>;
