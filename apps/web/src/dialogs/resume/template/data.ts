import type { MessageDescriptor } from "@lingui/core";
import type { Template } from "@rezumi/schema/templates";
import { msg } from "@lingui/core/macro";

export type TemplateMetadata = {
	name: string;
	description: MessageDescriptor;
	imageUrl: string;
	tags: string[];
};

export const templates = {
	aksara: {
		name: "Aksara",
		description: msg`An editorial single column set like a magazine feature: a small kicker over a large display name and serif section titles between hairlines. For writers, designers and communications roles.`,
		imageUrl: "/templates/jpg/aksara.jpg",
		tags: ["Single-column", "ATS friendly", "Editorial", "Serif", "Writer", "Designer"],
	},
	atlas: {
		name: "Atlas",
		description: msg`A Swiss grid: section titles in a narrow left column, entries beside them, and a hairline across the page above each section.`,
		imageUrl: "/templates/jpg/atlas.jpg",
		tags: ["Single-column", "ATS friendly", "Swiss grid", "Minimal", "Consulting", "Design"],
	},
	cendekia: {
		name: "Cendekia",
		description: msg`An academic CV in a quiet serif, with small capital section titles and room for long lists of publications, grants and teaching. Suits research and scholarship applications.`,
		imageUrl: "/templates/jpg/cendekia.jpg",
		tags: ["Single-column", "ATS friendly", "Academic", "Research", "Scholarship", "Serif"],
	},
	horizon: {
		name: "Horizon",
		description: msg`An accent band across the top carries the name, headline and contact line in light text, with two columns below and the sidebar on the right.`,
		imageUrl: "/templates/jpg/horizon.jpg",
		tags: ["Two-column", "Header band", "Modern", "Corporate", "Marketing"],
	},
	jejak: {
		name: "Jejak",
		description: msg`Your career as a path: experience and education hang from a fine line with an accent dot at each step, beside a left sidebar.`,
		imageUrl: "/templates/jpg/jejak.jpg",
		tags: ["Two-column", "Timeline", "Modern", "Career story", "Creative"],
	},
	kirana: {
		name: "Kirana",
		description: msg`A soft wash of the accent down the left column for skills and languages; the name, a round portrait and the contact line lead the main column.`,
		imageUrl: "/templates/jpg/kirana.jpg",
		tags: ["Two-column", "Soft sidebar", "Modern", "Photo", "Versatile"],
	},
	linen: {
		name: "Linen",
		description: msg`White and airy: an elegant serif name, the sidebar on the right set apart by a single hairline, and no fills anywhere.`,
		imageUrl: "/templates/jpg/linen.jpg",
		tags: ["Two-column", "Minimal", "Elegant", "Serif", "Design"],
	},
	meridian: {
		name: "Meridian",
		description: msg`A clean, modern single column: a large name, an accent headline, and small section labels with a fine rule. The default for every field.`,
		imageUrl: "/templates/jpg/meridian.jpg",
		tags: ["Single-column", "ATS friendly", "Modern", "Clean", "Versatile"],
	},
	purnama: {
		name: "Purnama",
		description: msg`A deep night sidebar where a large serif name, the portrait and the contact lines glow in light text, beside a white main column.`,
		imageUrl: "/templates/jpg/purnama.jpg",
		tags: ["Two-column", "Dark sidebar", "Elegant", "Photo", "Executive"],
	},
	senja: {
		name: "Senja",
		description: msg`The creative page: a block of the accent anchors the top corner, framing your portrait, beside an oversized name; two columns follow.`,
		imageUrl: "/templates/jpg/senja.jpg",
		tags: ["Two-column", "Creative", "Bold", "Design", "Marketing"],
	},
	sterling: {
		name: "Sterling",
		description: msg`A classic centred header with the name in tracked capitals and ruled section titles. Quiet and authoritative for finance, law and consulting.`,
		imageUrl: "/templates/jpg/sterling.jpg",
		tags: ["Single-column", "ATS friendly", "Classic", "Finance", "Law", "Consulting"],
	},
	summit: {
		name: "Summit",
		description: msg`An executive page: a bold accent rule along the top, a commanding name and section titles underlined in the accent.`,
		imageUrl: "/templates/jpg/summit.jpg",
		tags: ["Single-column", "ATS friendly", "Executive", "Leadership", "Senior"],
	},
	tenun: {
		name: "Tenun",
		description: msg`A structured grid inspired by the Japanese rirekisho and the Indonesian DRH: the header and every section in hairline boxes with a tinted title band.`,
		imageUrl: "/templates/jpg/tenun.jpg",
		tags: ["Single-column", "ATS friendly", "Ruled grid", "Structured", "Government", "Asian style"],
	},
	tunas: {
		name: "Tunas",
		description: msg`Compact and fresh for a first job or an internship: a tight rhythm that keeps to one page and a short accent bar before each section title.`,
		imageUrl: "/templates/jpg/tunas.jpg",
		tags: ["Single-column", "ATS friendly", "Compact", "Fresh graduate", "Internship"],
	},
	vector: {
		name: "Vector",
		description: msg`For developers and data people: monospace accents for the headline, dates and labels, and skills as chips that can carry tool logos.`,
		imageUrl: "/templates/jpg/vector.jpg",
		tags: ["Single-column", "ATS friendly", "Developer", "Data", "Tech", "Monospace"],
	},
	wibawa: {
		name: "Wibawa",
		description: msg`The formal Indonesian CV: a portrait beside the name and a column of personal details, with firm ruled section titles. Fits state-owned companies, civil service and local employers.`,
		imageUrl: "/templates/jpg/wibawa.jpg",
		tags: ["Single-column", "ATS friendly", "Formal", "Photo", "Indonesia", "Government"],
	},
} as const satisfies Record<Template, TemplateMetadata>;
