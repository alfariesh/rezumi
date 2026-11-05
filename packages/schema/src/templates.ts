import z from "zod";

/** The templates, in gallery order. */
export const templateLineup = [
	"meridian",
	"sterling",
	"aksara",
	"atlas",
	"tunas",
	"summit",
	"cendekia",
	"wibawa",
	"tenun",
	"vector",
	"anggrek",
	"ivory",
	"pilar",
	"bingkai",
	"cerah",
	"mozaik",
	"nusa",
	"selaras",
	"teras",
	"cobalt",
	"kontras",
	"lintasan",
	"kirana",
	"linen",
	"horizon",
	"jejak",
	"purnama",
	"senja",
	"graphite",
	"awan",
	"menara",
	"tepi",
	"sekar",
	"marquee",
	"fajar",
	"cahaya",
] as const;

/** The only template IDs the apps, the API and the JSON Schema for agents name. */
export const templateSchema = z.enum(templateLineup);

export type Template = z.infer<typeof templateSchema>;

/** The template a new resume starts with, and the one an unreadable ID falls back to. */
export const defaultTemplate = "meridian" as const satisfies Template;

/**
 * The template that took each former template's place (see `.agents/docs/plans/cv-templates/00-keputusan.md`). The
 * former templates no longer exist; data naming one (a saved resume, a Reactive Resume export, an older API client)
 * is read and saved with its successor, so no resume or letter is drawn the old way.
 */
export const legacyTemplateSuccessors = {
	azurill: "jejak",
	bronzor: "atlas",
	chikorita: "linen",
	ditgar: "purnama",
	ditto: "horizon",
	gengar: "kirana",
	glalie: "kirana",
	kakuna: "tunas",
	lapras: "summit",
	leafish: "linen",
	meowth: "wibawa",
	onyx: "meridian",
	persian: "sterling",
	pikachu: "horizon",
	porygon: "tenun",
	rhyhorn: "meridian",
	scizor: "summit",
	smeargle: "aksara",
} as const satisfies Record<string, Template>;

export type LegacyTemplate = keyof typeof legacyTemplateSuccessors;

/** The successor of a former template ID, or undefined for anything else. */
export const formerTemplateSuccessor = (template: unknown): Template | undefined =>
	typeof template === "string" && Object.hasOwn(legacyTemplateSuccessors, template)
		? legacyTemplateSuccessors[template as LegacyTemplate]
		: undefined;

/** `template` itself, a former template's successor, or the default for anything else. */
export const upgradeTemplateId = (template: unknown): Template => {
	const parsed = templateSchema.safeParse(template);
	return formerTemplateSuccessor(template) ?? (parsed.success ? parsed.data : defaultTemplate);
};

/**
 * For API inputs: a template ID, with a former one accepted and replaced by its successor. Anything else is rejected.
 * The JSON Schema for agents lists only the templates (a preprocessed schema documents its output).
 */
export const templateInputSchema = z.preprocess((value) => formerTemplateSuccessor(value) ?? value, templateSchema);

/**
 * For stored and imported data: a template ID, a former one included. Anything unreadable becomes the default
 * template instead of failing the whole document. The fallback is a fixed value because the JSON Schema cannot
 * describe a computed one.
 */
export const readableTemplateSchema = templateInputSchema.catch(defaultTemplate);

/** Who each lineup template is for, in a line, for AI agents choosing one (the apps have their own translated copy). */
export const templateSummaries = {
	meridian: "Default. Clean modern single column, large name, accent headline; any field.",
	sterling: "Classic centred serif page with ruled capital titles; finance, law, consulting.",
	aksara: "Editorial: small kicker over a large display name, serif titles; writers, designers, communications.",
	atlas: "Swiss grid with section titles in a narrow left column; consulting, design, product.",
	tunas: "Compact one-page layout for fresh graduates and internships.",
	summit: "Executive: accent rule on top, commanding name, underlined titles; senior and leadership roles.",
	cendekia: "Academic CV with years in a date column; research, teaching, scholarships.",
	wibawa:
		"Formal Indonesian CV: portrait plus personal details (labelled custom fields); civil service, local employers.",
	tenun: "Ruled grid in the style of the Japanese rirekisho and Indonesian DRH; structured applications.",
	vector: "Developers and data: monospace accents, skills as chips with tool logos.",
	kirana: "Two columns: soft accent sidebar on the left, round portrait; versatile.",
	linen: "Two columns: white, serif name, right sidebar behind a hairline; minimal and elegant.",
	horizon: "Two columns under a full-width accent header band; corporate and marketing.",
	jejak: "Two columns with experience and education as a timeline; career stories.",
	purnama: "Two columns: deep dark sidebar with the name and portrait in light text; elegant.",
	senja: "Two columns, creative: accent block framing the portrait beside an oversized name.",
	anggrek:
		"Centred luxury serif: display name, section titles between two hairlines; hospitality, PR, private banking.",
	ivory: "Nordic minimal: a large light name, quiet labels and one-line entries; designers and product people.",
	pilar: "Formal: an accent rail down the left margin with a marker for each section; banking, audit, government.",
	bingkai: "Classic page inside a fine double frame, ruled serif titles; academic, legal and public policy.",
	cerah: "Friendly and bright: section titles on soft rounded bands; fresh graduates and junior tech roles.",
	mozaik: "Bento cards: every section on a soft rounded tile, skills as chips; designers and product teams.",
	nusa: "Bold: section titles as solid accent tags with a hairline; marketing, sales and creative juniors.",
	selaras: "Split header with the contact lines beside the name, dates above titles; consulting, product, fintech.",
	teras: "Friendly formal: contact details in a tinted bar under the name; fresh graduates, BUMN and civil service.",
	cobalt: "Executive formal: an accent bar beside the name block and firm ruled titles; government and finance.",
	kontras: "Poster type: a tall condensed name and titles with high contrast; art directors and creatives.",
	lintasan: "One column with experience and education on a timeline of dots; graduates and early careers.",
	graphite:
		"Two columns: charcoal sidebar on the right with accent labels, name in the main column; tech leads, finance.",
	awan: "Two columns: the name and portrait in a soft rounded panel on the left; creative and junior roles.",
	menara: "Two columns: a solid accent block for the name tops a softly tinted left sidebar; finance and BUMN.",
	tepi: "Two columns: a slim accent stripe on the page edge, left sidebar behind a hairline; research and tech.",
	sekar: "Two columns under a centred serif header, left sidebar on a soft rounded card; elegant, creative, academic.",
	marquee: "Two columns: a huge name over a thick accent rule, sidebar sections as soft cards; creative producers.",
	fajar: "Two columns under a softly tinted full-width header band, left sidebar; graduates and communications.",
	cahaya: "Two columns: the name leads the main column, right sidebar after an accent rule; cloud, data, fintech.",
} as const satisfies Record<Template, string>;

/** Fields of work the template galleries filter by, in filter order. "graduate" is a first job or internship. */
export const careerFields = ["tech", "creative", "finance", "government", "academic", "graduate"] as const;

export type CareerField = (typeof careerFields)[number];

/**
 * The fields each template suits, from "Untuk siapa" in `.agents/docs/plans/cv-templates/00-keputusan.md`. Each field
 * lists at least one free template. "government" covers civil service and state-owned companies (BUMN).
 */
export const templateCareerFields = {
	meridian: ["tech", "finance", "graduate"],
	sterling: ["finance", "government", "academic"],
	aksara: ["creative"],
	atlas: ["tech", "creative"],
	tunas: ["graduate"],
	summit: ["finance", "government"],
	cendekia: ["academic", "graduate"],
	wibawa: ["government", "graduate"],
	tenun: ["government"],
	vector: ["tech"],
	kirana: ["creative", "graduate"],
	linen: ["creative", "academic"],
	horizon: ["tech", "finance"],
	jejak: ["tech", "creative"],
	purnama: ["finance", "creative"],
	senja: ["creative"],
	anggrek: ["creative", "finance"],
	ivory: ["creative", "tech"],
	pilar: ["finance", "government"],
	bingkai: ["academic", "government"],
	cerah: ["graduate", "tech"],
	mozaik: ["creative", "tech"],
	nusa: ["creative", "graduate"],
	selaras: ["tech", "finance"],
	teras: ["government", "graduate"],
	cobalt: ["government", "finance"],
	kontras: ["creative"],
	lintasan: ["graduate", "tech"],
	graphite: ["tech", "finance"],
	awan: ["creative", "graduate"],
	menara: ["finance", "government"],
	tepi: ["tech", "academic"],
	sekar: ["creative", "academic"],
	marquee: ["creative"],
	fajar: ["graduate", "creative"],
	cahaya: ["tech", "finance"],
} as const satisfies Record<Template, readonly CareerField[]>;

/** How a template lays out the page. The single source for the gallery filters, the Check layout rule and DOCX. */
export type TemplateLayout = {
	/** Two-column templates print the sidebar as a column of its own; one-column templates read top to bottom. */
	columns: 1 | 2;
	/** Where the sidebar column sits by default. Null for one-column templates. */
	sidebarSide: "left" | "right" | null;
	/** Where the header sits: across the page, over the main column only, or in the sidebar. */
	headerPlacement: "full-width" | "main-only" | "sidebar-only";
	/** One reading order and plain text headings, which applicant tracking systems read cleanly. */
	atsSafe: boolean;
};

const oneColumn: TemplateLayout = { columns: 1, sidebarSide: null, headerPlacement: "full-width", atsSafe: true };

export const templateLayouts = {
	meridian: oneColumn,
	sterling: oneColumn,
	aksara: oneColumn,
	atlas: oneColumn,
	tunas: oneColumn,
	summit: oneColumn,
	cendekia: oneColumn,
	wibawa: oneColumn,
	tenun: oneColumn,
	vector: oneColumn,
	kirana: { columns: 2, sidebarSide: "left", headerPlacement: "main-only", atsSafe: false },
	linen: { columns: 2, sidebarSide: "right", headerPlacement: "full-width", atsSafe: false },
	horizon: { columns: 2, sidebarSide: "right", headerPlacement: "full-width", atsSafe: false },
	jejak: { columns: 2, sidebarSide: "left", headerPlacement: "full-width", atsSafe: false },
	purnama: { columns: 2, sidebarSide: "left", headerPlacement: "sidebar-only", atsSafe: false },
	senja: { columns: 2, sidebarSide: "right", headerPlacement: "full-width", atsSafe: false },
	anggrek: oneColumn,
	ivory: oneColumn,
	pilar: oneColumn,
	bingkai: oneColumn,
	cerah: oneColumn,
	mozaik: oneColumn,
	nusa: oneColumn,
	selaras: oneColumn,
	teras: oneColumn,
	cobalt: oneColumn,
	kontras: oneColumn,
	lintasan: oneColumn,
	graphite: { columns: 2, sidebarSide: "right", headerPlacement: "main-only", atsSafe: false },
	awan: { columns: 2, sidebarSide: "left", headerPlacement: "sidebar-only", atsSafe: false },
	menara: { columns: 2, sidebarSide: "left", headerPlacement: "sidebar-only", atsSafe: false },
	tepi: { columns: 2, sidebarSide: "left", headerPlacement: "full-width", atsSafe: false },
	sekar: { columns: 2, sidebarSide: "left", headerPlacement: "full-width", atsSafe: false },
	marquee: { columns: 2, sidebarSide: "right", headerPlacement: "full-width", atsSafe: false },
	fajar: { columns: 2, sidebarSide: "left", headerPlacement: "full-width", atsSafe: false },
	cahaya: { columns: 2, sidebarSide: "right", headerPlacement: "main-only", atsSafe: false },
} as const satisfies Record<Template, TemplateLayout>;

type FontWeight = "100" | "200" | "300" | "400" | "500" | "600" | "700" | "800" | "900";

export type TemplatePreset = {
	heading: { fontFamily: string; fontWeight: FontWeight; fontSize: number };
	body: { fontFamily: string; fontSize: number; lineHeight: number };
	/** The accent colour, as rgba(r, g, b, a). */
	primary: string;
	entry?: { layout: "stacked" | "inline" | "compact" | "date-column" | "eyebrow" };
	/** How skill keywords print, when the template is built around one way. */
	keywordLayout?: "inline" | "list" | "tags";
	/** Picture corner radius as a share of its width (0.5 is a circle), and its width over height. */
	picture: { radius: number; aspectRatio: number };
};

const preset = (
	heading: [fontFamily: string, fontWeight: FontWeight, fontSize: number],
	body: [fontFamily: string, fontSize: number, lineHeight: number],
	primary: string,
	extra: Partial<Pick<TemplatePreset, "entry" | "picture" | "keywordLayout">> = {},
): TemplatePreset => ({
	heading: { fontFamily: heading[0], fontWeight: heading[1], fontSize: heading[2] },
	body: { fontFamily: body[0], fontSize: body[1], lineHeight: body[2] },
	primary,
	picture: { radius: 0.5, aspectRatio: 1 },
	...extra,
});

/**
 * The look a template was designed with: fonts, accent, entry layout and picture shape. Gallery samples and new
 * resumes start from it, and Design can apply it on request; switching templates alone keeps the user's own choices.
 */
export const templatePresets: Record<Template, TemplatePreset> = {
	meridian: preset(["Plus Jakarta Sans", "700", 13], ["Plus Jakarta Sans", 9.5, 1.45], "rgba(31, 58, 104, 1)"),
	sterling: preset(["EB Garamond", "600", 13], ["EB Garamond", 10.5, 1.4], "rgba(28, 32, 41, 1)", {
		picture: { radius: 0.5, aspectRatio: 1 },
	}),
	aksara: preset(["Instrument Serif", "400", 14], ["Inter", 9.2, 1.5], "rgba(170, 72, 42, 1)", {
		picture: { radius: 0.06, aspectRatio: 0.8 },
	}),
	atlas: preset(["Inter Tight", "700", 13], ["Inter Tight", 9.5, 1.45], "rgba(15, 91, 92, 1)"),
	tunas: preset(["DM Sans", "700", 12.5], ["DM Sans", 9.2, 1.4], "rgba(22, 120, 86, 1)"),
	summit: preset(["Manrope", "800", 13], ["Inter", 9.4, 1.5], "rgba(120, 30, 45, 1)"),
	cendekia: preset(["Source Serif 4", "600", 13], ["Source Serif 4", 9.8, 1.42], "rgba(28, 51, 92, 1)", {
		entry: { layout: "date-column" },
	}),
	wibawa: preset(["Lato", "700", 13], ["Lato", 9.8, 1.45], "rgba(23, 42, 95, 1)", {
		picture: { radius: 0.06, aspectRatio: 0.75 },
	}),
	tenun: preset(["IBM Plex Sans", "600", 12.5], ["IBM Plex Sans", 9.2, 1.4], "rgba(46, 63, 127, 1)", {
		picture: { radius: 0, aspectRatio: 0.75 },
	}),
	vector: preset(["JetBrains Mono", "600", 12.5], ["Inter", 9.4, 1.5], "rgba(79, 70, 229, 1)", {
		keywordLayout: "tags",
	}),
	kirana: preset(["Manrope", "700", 13], ["Manrope", 9.3, 1.45], "rgba(29, 111, 115, 1)"),
	linen: preset(["Newsreader", "500", 14], ["Source Sans 3", 9.8, 1.45], "rgba(140, 90, 60, 1)"),
	horizon: preset(["Inter", "700", 13], ["Inter", 9.3, 1.5], "rgba(30, 41, 59, 1)"),
	jejak: preset(["Outfit", "600", 13], ["Outfit", 9.5, 1.45], "rgba(196, 80, 52, 1)"),
	purnama: preset(["Cormorant Garamond", "600", 16], ["Inter", 9.2, 1.5], "rgba(22, 30, 52, 1)"),
	senja: preset(["Bricolage Grotesque", "700", 14], ["DM Sans", 9.4, 1.45], "rgba(214, 96, 63, 1)", {
		picture: { radius: 0.5, aspectRatio: 1 },
	}),
	anggrek: preset(["Playfair Display", "500", 13.5], ["Mulish", 9.3, 1.5], "rgba(108, 44, 82, 1)"),
	ivory: preset(["Albert Sans", "300", 14], ["Albert Sans", 9.4, 1.5], "rgba(52, 84, 104, 1)", {
		entry: { layout: "inline" },
	}),
	pilar: preset(["Public Sans", "700", 12.5], ["Public Sans", 9.3, 1.45], "rgba(14, 76, 117, 1)"),
	bingkai: preset(["Libre Baskerville", "700", 12.5], ["Lora", 9.6, 1.45], "rgba(33, 77, 58, 1)", {
		picture: { radius: 0.04, aspectRatio: 0.8 },
	}),
	cerah: preset(["Figtree", "700", 13], ["Figtree", 9.5, 1.45], "rgba(29, 99, 214, 1)"),
	mozaik: preset(["Space Grotesk", "700", 13], ["Inter", 9.2, 1.45], "rgba(104, 56, 200, 1)", {
		keywordLayout: "tags",
		picture: { radius: 0.18, aspectRatio: 1 },
	}),
	nusa: preset(["Archivo", "800", 12.5], ["Archivo", 9.3, 1.45], "rgba(190, 56, 30, 1)"),
	selaras: preset(["Sora", "600", 12.5], ["Onest", 9.3, 1.5], "rgba(4, 108, 80, 1)", {
		entry: { layout: "eyebrow" },
	}),
	teras: preset(["Rubik", "600", 13], ["Rubik", 9.2, 1.45], "rgba(150, 92, 12, 1)", {
		picture: { radius: 0.12, aspectRatio: 0.8 },
	}),
	cobalt: preset(["Libre Franklin", "800", 13], ["Libre Franklin", 9.3, 1.45], "rgba(0, 71, 171, 1)"),
	kontras: preset(["Bebas Neue", "400", 17], ["Barlow", 9.6, 1.45], "rgba(214, 40, 57, 1)", {
		picture: { radius: 0, aspectRatio: 0.8 },
	}),
	lintasan: preset(["Lexend", "600", 12.5], ["Lexend", 8.9, 1.5], "rgba(15, 118, 110, 1)"),
	graphite: preset(["Urbanist", "800", 13], ["Urbanist", 9.6, 1.45], "rgba(202, 138, 4, 1)"),
	awan: preset(["Nunito Sans", "800", 13], ["Nunito Sans", 9.4, 1.45], "rgba(186, 64, 102, 1)", {
		picture: { radius: 0.18, aspectRatio: 1 },
	}),
	menara: preset(["Red Hat Display", "700", 13], ["Red Hat Text", 9.3, 1.45], "rgba(30, 58, 138, 1)"),
	tepi: preset(["Hanken Grotesk", "700", 13], ["Hanken Grotesk", 9.4, 1.45], "rgba(224, 86, 18, 1)"),
	sekar: preset(["Fraunces", "500", 14], ["Karla", 9.4, 1.5], "rgba(84, 108, 78, 1)"),
	marquee: preset(["Syne", "700", 14], ["Work Sans", 9.2, 1.45], "rgba(204, 36, 112, 1)", {
		picture: { radius: 0.5, aspectRatio: 1 },
	}),
	fajar: preset(["Poppins", "600", 12.5], ["Poppins", 8.9, 1.5], "rgba(214, 104, 36, 1)"),
	cahaya: preset(["Schibsted Grotesk", "700", 13], ["Schibsted Grotesk", 9.4, 1.45], "rgba(8, 128, 160, 1)"),
};
