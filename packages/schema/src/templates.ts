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
	"kirana",
	"linen",
	"horizon",
	"jejak",
	"purnama",
	"senja",
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
};
