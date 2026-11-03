import z from "zod";

export const templateSchema = z.enum([
	"aksara",
	"atlas",
	"azurill",
	"bronzor",
	"cendekia",
	"chikorita",
	"ditgar",
	"ditto",
	"gengar",
	"glalie",
	"horizon",
	"jejak",
	"kakuna",
	"kirana",
	"lapras",
	"leafish",
	"linen",
	"meowth",
	"meridian",
	"onyx",
	"persian",
	"pikachu",
	"porygon",
	"purnama",
	"rhyhorn",
	"scizor",
	"senja",
	"smeargle",
	"sterling",
	"summit",
	"tenun",
	"tunas",
	"vector",
	"wibawa",
]);

export type Template = z.infer<typeof templateSchema>;

/**
 * The templates offered for new choices: the November 2026 lineup, in gallery order. The former templates still
 * render the documents that use them until they are removed (.agents/docs/plans/cv-templates).
 */
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
] as const satisfies readonly Template[];

export type LineupTemplate = (typeof templateLineup)[number];

/**
 * The template that took each former template's place (see `.agents/docs/plans/cv-templates/00-keputusan.md`). Data
 * naming a former template is read and saved with its successor, so no resume or letter is drawn the old way.
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
} as const satisfies Record<Exclude<Template, LineupTemplate>, LineupTemplate>;

/** The lineup template to use for `template`: itself, or a former template's successor. */
export const upgradeTemplateId = (template: Template): LineupTemplate =>
	(legacyTemplateSuccessors as Partial<Record<Template, LineupTemplate>>)[template] ?? (template as LineupTemplate);

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
} as const satisfies Record<LineupTemplate, string>;

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
	aksara: oneColumn,
	atlas: oneColumn,
	azurill: { columns: 2, sidebarSide: "left", headerPlacement: "full-width", atsSafe: false },
	// Bronzor prints sidebar sections as labelled rows inside one column.
	bronzor: oneColumn,
	cendekia: oneColumn,
	chikorita: { columns: 2, sidebarSide: "right", headerPlacement: "main-only", atsSafe: false },
	ditgar: { columns: 2, sidebarSide: "left", headerPlacement: "sidebar-only", atsSafe: false },
	ditto: { columns: 2, sidebarSide: "left", headerPlacement: "full-width", atsSafe: false },
	gengar: { columns: 2, sidebarSide: "left", headerPlacement: "sidebar-only", atsSafe: false },
	glalie: { columns: 2, sidebarSide: "left", headerPlacement: "sidebar-only", atsSafe: false },
	kakuna: oneColumn,
	lapras: oneColumn,
	leafish: { columns: 2, sidebarSide: "right", headerPlacement: "full-width", atsSafe: false },
	meowth: oneColumn,
	meridian: oneColumn,
	onyx: oneColumn,
	persian: oneColumn,
	pikachu: { columns: 2, sidebarSide: "left", headerPlacement: "main-only", atsSafe: false },
	porygon: oneColumn,
	rhyhorn: oneColumn,
	scizor: oneColumn,
	smeargle: oneColumn,
	sterling: oneColumn,
	summit: oneColumn,
	tenun: oneColumn,
	tunas: oneColumn,
	vector: oneColumn,
	wibawa: oneColumn,
	kirana: { columns: 2, sidebarSide: "left", headerPlacement: "main-only", atsSafe: false },
	linen: { columns: 2, sidebarSide: "right", headerPlacement: "full-width", atsSafe: false },
	horizon: { columns: 2, sidebarSide: "right", headerPlacement: "full-width", atsSafe: false },
	jejak: { columns: 2, sidebarSide: "left", headerPlacement: "full-width", atsSafe: false },
	purnama: { columns: 2, sidebarSide: "left", headerPlacement: "sidebar-only", atsSafe: false },
	senja: { columns: 2, sidebarSide: "right", headerPlacement: "full-width", atsSafe: false },
} as const satisfies Record<Template, TemplateLayout>;

/**
 * The look a template was designed with: fonts, accent, entry layout and picture shape. Gallery samples and new
 * resumes start from it, and Design can apply it on request; switching templates alone keeps the user's own choices.
 * Only the November 2026 lineup has presets.
 */
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

export const templatePresets: Partial<Record<Template, TemplatePreset>> = {
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
