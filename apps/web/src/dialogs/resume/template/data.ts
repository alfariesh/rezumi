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
	azurill: {
		name: "Azurill",
		description: msg`Two-column with a bold colored sidebar and skill bars; great for creative or tech roles where visual flair is welcome.`,
		imageUrl: "/templates/jpg/azurill.jpg",
		tags: ["Two-column", "Creative", "Tech", "Visual flair"],
	},
	bronzor: {
		name: "Bronzor",
		description: msg`One column with labeled section rows and subtle dividers. A compact layout for experience, education and supporting details.`,
		imageUrl: "/templates/jpg/bronzor.jpg",
		tags: ["Single-column", "Clean", "Professional", "Corporate", "Finance", "Consulting"],
	},
	cendekia: {
		name: "Cendekia",
		description: msg`An academic CV in a quiet serif, with small capital section titles and room for long lists of publications, grants and teaching. Suits research and scholarship applications.`,
		imageUrl: "/templates/jpg/cendekia.jpg",
		tags: ["Single-column", "ATS friendly", "Academic", "Research", "Scholarship", "Serif"],
	},
	chikorita: {
		name: "Chikorita",
		description: msg`Two-column with a soft header accent and circular profile photo; ideal for marketing, HR, or client-facing roles.`,
		imageUrl: "/templates/jpg/chikorita.jpg",
		tags: ["Two-column", "Soft accent", "Marketing", "HR", "Client-facing"],
	},
	ditgar: {
		name: "Ditgar",
		description: msg`Two-column with a dark teal sidebar and skills grid; modern feel for developers, data scientists, or technical PMs.`,
		imageUrl: "/templates/jpg/ditgar.jpg",
		tags: ["Two-column", "Modern", "Developer", "Data science", "Technical PM", "Dark sidebar"],
	},
	ditto: {
		name: "Ditto",
		description: msg`Two columns beneath a colored header band. Keep experience in the main column and supporting details in the sidebar.`,
		imageUrl: "/templates/jpg/ditto.jpg",
		tags: ["Two-column", "Minimal", "Text-dense", "Traditional"],
	},
	gengar: {
		name: "Gengar",
		description: msg`Two-column with accent colors and clean typography; balanced choice for business analysts or operations roles.`,
		imageUrl: "/templates/jpg/gengar.jpg",
		tags: ["Two-column", "Accent colors", "Clean typography", "Business analyst", "Operations"],
	},
	glalie: {
		name: "Glalie",
		description: msg`Two-column, minimal with light gray sidebar and subtle icons; professional and understated for legal, finance, or executive roles.`,
		imageUrl: "/templates/jpg/glalie.jpg",
		tags: ["Two-column", "Minimal", "Professional", "Legal", "Finance", "Executive", "Understated"],
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
	kakuna: {
		name: "Kakuna",
		description: msg`Single-column with a magenta left border accent; compact and efficient for entry-level or internship applications.`,
		imageUrl: "/templates/jpg/kakuna.jpg",
		tags: ["Single-column", "ATS friendly", "Compact", "Efficient", "Entry level", "Internship", "Magenta accent"],
	},
	kirana: {
		name: "Kirana",
		description: msg`A soft wash of the accent down the left column for skills and languages; the name, a round portrait and the contact line lead the main column.`,
		imageUrl: "/templates/jpg/kirana.jpg",
		tags: ["Two-column", "Soft sidebar", "Modern", "Photo", "Versatile"],
	},
	lapras: {
		name: "Lapras",
		description: msg`Single-column; polished and serious for senior or enterprise-level positions.`,
		imageUrl: "/templates/jpg/lapras.jpg",
		tags: ["Single-column", "ATS friendly", "Polished", "Senior", "Enterprise"],
	},
	leafish: {
		name: "Leafish",
		description: msg`Two-column with a muted color sidebar; earthy and calm, suits sustainability, healthcare, or nonprofit sectors.`,
		imageUrl: "/templates/jpg/leafish.jpg",
		tags: ["Two-column", "Muted sidebar", "Earthy", "Calm", "Sustainability", "Healthcare", "Nonprofit"],
	},
	linen: {
		name: "Linen",
		description: msg`White and airy: an elegant serif name, the sidebar on the right set apart by a single hairline, and no fills anywhere.`,
		imageUrl: "/templates/jpg/linen.jpg",
		tags: ["Two-column", "Minimal", "Elegant", "Serif", "Design"],
	},
	meowth: {
		name: "Meowth",
		description: msg`Single-column with uppercase section headings over a rule and the photo beside the name; compact and ATS-friendly, well-suited for Asian resume conventions (CN/JP/KR).`,
		imageUrl: "/templates/jpg/meowth.jpg",
		tags: ["Single-column", "ATS friendly", "Ruled headings", "Compact", "Asian style", "CN/JP/KR"],
	},
	meridian: {
		name: "Meridian",
		description: msg`A clean, modern single column: a large name, an accent headline, and small section labels with a fine rule. The default for every field.`,
		imageUrl: "/templates/jpg/meridian.jpg",
		tags: ["Single-column", "ATS friendly", "Modern", "Clean", "Versatile"],
	},
	onyx: {
		name: "Onyx",
		description: msg`One column with a photo beside the header and clear section headings. A simple top-to-bottom layout for your experience.`,
		imageUrl: "/templates/jpg/onyx.jpg",
		tags: ["Single-column", "ATS friendly", "Versatile", "Professional", "Technical"],
	},
	persian: {
		name: "Persian",
		description: msg`Single-column Wall Street style with a centered header and ruled section headings.`,
		imageUrl: "/templates/jpg/persian.jpg",
		tags: ["Single-column", "ATS friendly", "Finance", "Consulting", "Traditional"],
	},
	pikachu: {
		name: "Pikachu",
		description: msg`Two-column with a left margin color; simple and approachable for creative, editorial, or junior roles.`,
		imageUrl: "/templates/jpg/pikachu.jpg",
		tags: ["Two-column", "Simple", "Creative", "Editorial", "Junior", "Accent colors"],
	},
	porygon: {
		name: "Porygon",
		description: msg`Single-column ruled form inspired by the Japanese rirekisho: a bordered header of field cells and every section as a table with a solid title bar; dense and fast to scan for engineering, operations, or applications in Japan.`,
		imageUrl: "/templates/jpg/porygon.jpg",
		tags: [
			"Single-column",
			"ATS friendly",
			"Ruled grid",
			"Dense",
			"Structured",
			"Engineering",
			"Operations",
			"Asian style",
		],
	},
	purnama: {
		name: "Purnama",
		description: msg`A deep night sidebar where a large serif name, the portrait and the contact lines glow in light text, beside a white main column.`,
		imageUrl: "/templates/jpg/purnama.jpg",
		tags: ["Two-column", "Dark sidebar", "Elegant", "Photo", "Executive"],
	},
	rhyhorn: {
		name: "Rhyhorn",
		description: msg`Single-column with a minimal top header and lots of whitespace; clean and modern for designers or content creators.`,
		imageUrl: "/templates/jpg/rhyhorn.jpg",
		tags: ["Single-column", "ATS friendly", "Minimal", "Clean", "Modern", "Designer", "Content creator", "Whitespace"],
	},
	scizor: {
		name: "Scizor",
		description: msg`Single-column with uppercase section headings and a primary-color top rule on every page; polished for executive, consulting, or startup resumes.`,
		imageUrl: "/templates/jpg/scizor.jpg",
		tags: ["Single-column", "ATS friendly", "Uppercase headings", "Executive", "Consulting", "Startup"],
	},
	senja: {
		name: "Senja",
		description: msg`The creative page: a block of the accent anchors the top corner, framing your portrait, beside an oversized name; two columns follow.`,
		imageUrl: "/templates/jpg/senja.jpg",
		tags: ["Two-column", "Creative", "Bold", "Design", "Marketing"],
	},
	smeargle: {
		name: "Smeargle",
		description: msg`Single-column set like a magazine feature: a large display name under an uppercase kicker and the summary as a larger standfirst; refined for writers, designers, and communications roles.`,
		imageUrl: "/templates/jpg/smeargle.jpg",
		tags: ["Single-column", "ATS friendly", "Editorial", "Magazine", "Serif", "Writer", "Designer", "Communications"],
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
