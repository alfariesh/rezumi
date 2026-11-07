import type { PortfolioStandardSection } from "./sections";
import z from "zod";

/** Lugas and Prima are free; the creative themes belong to Plus. */
export const PORTFOLIO_THEMES = ["lugas", "prima", "kanvas", "mozaik", "paper", "brutal"] as const;
export type PortfolioTheme = (typeof PORTFOLIO_THEMES)[number];
export const portfolioThemeSchema = z
	.enum(PORTFOLIO_THEMES)
	.describe("The portfolio theme: lugas, prima (free), kanvas, mozaik, paper or brutal (Plus).");
export const defaultPortfolioTheme: PortfolioTheme = "lugas";

export const PORTFOLIO_SCHEMES = ["light", "dark", "auto"] as const;
export type PortfolioScheme = (typeof PORTFOLIO_SCHEMES)[number];

/** Intro text effects (in-house, not React Bits; `02-teknis.md` section 23). `none` is no effect. */
export const PORTFOLIO_HERO_EFFECTS = [
	"none",
	"fade-up",
	"shimmer",
	"gradient",
	"typewriter",
	"scramble",
	"vector-hover",
] as const;
export type PortfolioHeroEffect = (typeof PORTFOLIO_HERO_EFFECTS)[number];

/** How a metric widget is drawn: KPI card, big number, or before → after bars. */
export const PORTFOLIO_METRIC_VARIANTS = ["kpi", "big", "ba"] as const;
export type PortfolioMetricVariant = (typeof PORTFOLIO_METRIC_VARIANTS)[number];

/**
 * Every layout variant a section can take in some theme. A theme supports a subset (`PortfolioThemeInfo.variants`);
 * a stored value it doesn't support renders as the theme's default. The intro without a photo is automatic.
 */
export const PORTFOLIO_VARIANT_OPTIONS = {
	hero: ["photo-top", "photo-left", "photo-right", "big-name", "bento"],
	work: ["list", "grid-2", "grid-3", "featured-grid", "bento"],
	services: ["cards", "list"],
	testimonials: ["cards", "carousel"],
	clients: ["grayscale", "color"],
	experience: ["timeline", "compact"],
	education: ["timeline", "compact"],
	skills: ["chips", "groups"],
	metric: PORTFOLIO_METRIC_VARIANTS,
} as const satisfies Record<string, readonly string[]>;
export type PortfolioVariantKey = keyof typeof PORTFOLIO_VARIANT_OPTIONS;
export type PortfolioVariantValue<K extends PortfolioVariantKey = PortfolioVariantKey> =
	(typeof PORTFOLIO_VARIANT_OPTIONS)[K][number];
export const PORTFOLIO_VARIANT_KEYS = Object.keys(PORTFOLIO_VARIANT_OPTIONS) as PortfolioVariantKey[];

export function isPortfolioVariant(key: string, value: unknown): boolean {
	const options = (PORTFOLIO_VARIANT_OPTIONS as Record<string, readonly string[]>)[key];
	return Boolean(options && typeof value === "string" && options.includes(value));
}

/** The eight curated accents (`01-desain.md` section 6). */
export const PORTFOLIO_ACCENTS = {
	samudra: { label: "Samudra", color: "#1D4ED8" },
	toska: { label: "Toska", color: "#0F766E" },
	daun: { label: "Daun", color: "#15803D" },
	kunyit: { label: "Kunyit", color: "#EAB308" },
	jingga: { label: "Jingga", color: "#EA580C" },
	cabai: { label: "Cabai", color: "#DC2626" },
	anggrek: { label: "Anggrek", color: "#7C3AED" },
	grafit: { label: "Grafit", color: "#334155" },
} as const;
export type PortfolioAccentId = keyof typeof PORTFOLIO_ACCENTS;
export const PORTFOLIO_ACCENT_IDS = Object.keys(PORTFOLIO_ACCENTS) as PortfolioAccentId[];
/** Used when the accent follows a resume the portfolio doesn't have. */
export const fallbackPortfolioAccent: PortfolioAccentId = "samudra";

type FontPair = {
	label: string;
	heading: string;
	body: string;
	/** Width of the name's letters (Archivo at 72% in Kanvas). */
	nameStretch?: string;
	/** Whether the theme sets the name in capitals with this pair. */
	nameUppercase?: boolean;
};

/**
 * Curated heading + body pairs, all in `packages/fonts/src/webfontlist.json` and freely licensed. Themes offer five or
 * six each (`PortfolioThemeInfo.fontPairs`, the first being the theme's default). Monospace defaults to IBM Plex Mono.
 */
export const PORTFOLIO_FONT_PAIRS = {
	"space-inter": { label: "Space Grotesk + Inter", heading: "Space Grotesk", body: "Inter" },
	"google-sans": { label: "Google Sans", heading: "Google Sans", body: "Google Sans" },
	jakarta: { label: "Plus Jakarta Sans", heading: "Plus Jakarta Sans", body: "Plus Jakarta Sans" },
	"lora-figtree": { label: "Lora + Figtree", heading: "Lora", body: "Figtree" },
	manrope: { label: "Manrope", heading: "Manrope", body: "Manrope" },
	"dm-sans": { label: "DM Sans", heading: "DM Sans", body: "DM Sans" },
	"source-serif-sans": { label: "Source Serif 4 + Source Sans 3", heading: "Source Serif 4", body: "Source Sans 3" },
	atkinson: { label: "Atkinson Hyperlegible", heading: "Atkinson Hyperlegible", body: "Atkinson Hyperlegible" },
	"source-plex": { label: "Source Serif 4 + IBM Plex Sans", heading: "Source Serif 4", body: "IBM Plex Sans" },
	"caslon-public": { label: "Libre Caslon Text + Public Sans", heading: "Libre Caslon Text", body: "Public Sans" },
	"plex-serif-sans": { label: "IBM Plex Serif + IBM Plex Sans", heading: "IBM Plex Serif", body: "IBM Plex Sans" },
	"literata-work": { label: "Literata + Work Sans", heading: "Literata", body: "Work Sans" },
	archivo: { label: "Archivo", heading: "Archivo", body: "Archivo", nameStretch: "72%", nameUppercase: true },
	"bodoni-work": { label: "Bodoni Moda + Work Sans", heading: "Bodoni Moda", body: "Work Sans" },
	"syne-dm": { label: "Syne + DM Sans", heading: "Syne", body: "DM Sans" },
	instrument: { label: "Instrument Serif + Instrument Sans", heading: "Instrument Serif", body: "Instrument Sans" },
	"bricolage-dm": { label: "Bricolage Grotesque + DM Sans", heading: "Bricolage Grotesque", body: "DM Sans" },
	"bricolage-onest": { label: "Bricolage Grotesque + Onest", heading: "Bricolage Grotesque", body: "Onest" },
	"unbounded-albert": { label: "Unbounded + Albert Sans", heading: "Unbounded", body: "Albert Sans" },
	outfit: { label: "Outfit", heading: "Outfit", body: "Outfit" },
	"sora-dm": { label: "Sora + DM Sans", heading: "Sora", body: "DM Sans" },
	rethink: { label: "Rethink Sans", heading: "Rethink Sans", body: "Rethink Sans" },
	"redhat-albert": { label: "Red Hat Display + Albert Sans", heading: "Red Hat Display", body: "Albert Sans" },
} as const satisfies Record<string, FontPair>;
export type PortfolioFontPairId = keyof typeof PORTFOLIO_FONT_PAIRS;
export const PORTFOLIO_FONT_PAIR_IDS = Object.keys(PORTFOLIO_FONT_PAIRS) as PortfolioFontPairId[];
export const PORTFOLIO_MONO_FONT = "IBM Plex Mono";

type VariantSupport = { [K in PortfolioVariantKey]: readonly PortfolioVariantValue<K>[] };

export type PortfolioThemeInfo = {
	id: PortfolioTheme;
	name: string;
	/** Free themes are open to every plan; Plus themes need a paid plan once billing applies (Phase 07). */
	plan: "free" | "plus";
	defaultScheme: Exclude<PortfolioScheme, "auto">;
	/** Used only when following a resume with no usable accent (including portfolios without a resume). */
	fallbackAccent?: string;
	/** A theme's own face for figures and dates; otherwise the shared IBM Plex Mono. */
	monoFont?: string;
	/** Supported effects; the first is the theme's default. */
	effects: readonly PortfolioHeroEffect[];
	/** Offered font pairs; the first is the theme's default. */
	fontPairs: readonly PortfolioFontPairId[];
	/** Supported variants per section; the first is the theme's default. */
	variants: VariantSupport;
	/** Section order until the user reorders. Free sections and the resume's custom sections go before contact. */
	sectionOrder: readonly PortfolioStandardSection[];
};

const allMetricVariants = (first: PortfolioMetricVariant) =>
	[first, ...PORTFOLIO_METRIC_VARIANTS.filter((variant) => variant !== first)] as const;

/** Theme metadata (`01-desain.md` sections 5 and 18). Phase 02 and 06 give the themes their CSS. */
export const PORTFOLIO_THEME_INFO: Record<PortfolioTheme, PortfolioThemeInfo> = {
	lugas: {
		id: "lugas",
		name: "Lugas",
		plan: "free",
		defaultScheme: "light",
		effects: ["fade-up", "none", "shimmer", "gradient", "typewriter", "scramble", "vector-hover"],
		fontPairs: ["jakarta", "lora-figtree", "manrope", "dm-sans", "source-serif-sans", "atkinson"],
		variants: {
			hero: ["photo-top", "photo-left"],
			work: ["list", "grid-2", "featured-grid"],
			services: ["list", "cards"],
			testimonials: ["cards", "carousel"],
			clients: ["grayscale", "color"],
			experience: ["compact", "timeline"],
			education: ["compact", "timeline"],
			skills: ["groups", "chips"],
			metric: allMetricVariants("big"),
		},
		sectionOrder: [
			"about",
			"work",
			"services",
			"testimonials",
			"clients",
			"experience",
			"education",
			"skills",
			"certifications",
			"languages",
			"awards",
			"publications",
			"volunteer",
			"interests",
			"profiles",
			"contact",
		],
	},
	prima: {
		id: "prima",
		name: "Prima",
		plan: "free",
		defaultScheme: "light",
		effects: ["none", "fade-up", "shimmer", "typewriter"],
		fontPairs: ["source-plex", "manrope", "caslon-public", "plex-serif-sans", "literata-work"],
		variants: {
			hero: ["photo-right", "photo-left"],
			work: ["grid-2", "grid-3", "list"],
			services: ["cards", "list"],
			testimonials: ["cards", "carousel"],
			clients: ["grayscale", "color"],
			experience: ["timeline", "compact"],
			education: ["compact", "timeline"],
			skills: ["chips", "groups"],
			metric: allMetricVariants("kpi"),
		},
		sectionOrder: [
			"about",
			"experience",
			"work",
			"services",
			"testimonials",
			"clients",
			"education",
			"certifications",
			"awards",
			"skills",
			"languages",
			"publications",
			"volunteer",
			"interests",
			"profiles",
			"contact",
		],
	},
	kanvas: {
		id: "kanvas",
		name: "Kanvas",
		plan: "plus",
		defaultScheme: "dark",
		effects: ["vector-hover", "none", "fade-up", "shimmer", "gradient", "typewriter"],
		fontPairs: ["archivo", "bodoni-work", "syne-dm", "instrument", "bricolage-dm"],
		variants: {
			hero: ["big-name"],
			work: ["featured-grid", "grid-2", "grid-3"],
			services: ["list", "cards"],
			testimonials: ["cards", "carousel"],
			clients: ["grayscale", "color"],
			experience: ["compact", "timeline"],
			education: ["compact", "timeline"],
			skills: ["chips", "groups"],
			metric: allMetricVariants("big"),
		},
		sectionOrder: [
			"work",
			"about",
			"services",
			"testimonials",
			"clients",
			"experience",
			"education",
			"skills",
			"awards",
			"languages",
			"certifications",
			"publications",
			"volunteer",
			"interests",
			"profiles",
			"contact",
		],
	},
	brutal: {
		id: "brutal",
		name: "Brutal",
		plan: "plus",
		defaultScheme: "light",
		fallbackAccent: "#FFD23F",
		monoFont: "IBM Plex Mono",
		effects: ["none", "fade-up", "typewriter", "scramble", "vector-hover"],
		fontPairs: ["space-inter", "syne-dm", "jakarta", "archivo", "outfit"],
		variants: {
			hero: ["photo-right", "photo-left", "big-name"],
			work: ["grid-2", "grid-3", "featured-grid", "list"],
			services: ["cards", "list"],
			testimonials: ["cards", "carousel"],
			clients: ["color", "grayscale"],
			experience: ["timeline", "compact"],
			education: ["compact", "timeline"],
			skills: ["chips", "groups"],
			metric: allMetricVariants("kpi"),
		},
		sectionOrder: [
			"work",
			"about",
			"services",
			"experience",
			"skills",
			"testimonials",
			"clients",
			"education",
			"certifications",
			"awards",
			"languages",
			"publications",
			"volunteer",
			"interests",
			"profiles",
			"contact",
		],
	},
	paper: {
		id: "paper",
		name: "Paper",
		plan: "plus",
		defaultScheme: "light",
		fallbackAccent: "#F54E00",
		monoFont: "JetBrains Mono",
		effects: ["none", "fade-up", "shimmer", "gradient", "typewriter", "scramble", "vector-hover"],
		fontPairs: ["google-sans", "jakarta", "manrope", "dm-sans", "source-serif-sans"],
		variants: {
			hero: ["photo-top", "photo-right", "photo-left"],
			work: ["list", "grid-2", "grid-3"],
			services: ["list", "cards"],
			testimonials: ["cards", "carousel"],
			clients: ["grayscale", "color"],
			experience: ["compact", "timeline"],
			education: ["compact", "timeline"],
			skills: ["groups", "chips"],
			metric: allMetricVariants("big"),
		},
		sectionOrder: [
			"about",
			"experience",
			"education",
			"awards",
			"skills",
			"work",
			"services",
			"testimonials",
			"clients",
			"certifications",
			"languages",
			"publications",
			"volunteer",
			"interests",
			"profiles",
			"contact",
		],
	},
	mozaik: {
		id: "mozaik",
		name: "Mozaik",
		plan: "plus",
		defaultScheme: "light",
		effects: ["gradient", "none", "fade-up", "shimmer", "typewriter", "scramble", "vector-hover"],
		fontPairs: ["bricolage-onest", "unbounded-albert", "outfit", "sora-dm", "rethink", "redhat-albert"],
		variants: {
			hero: ["bento"],
			work: ["bento", "grid-2"],
			services: ["cards", "list"],
			testimonials: ["carousel", "cards"],
			clients: ["grayscale", "color"],
			experience: ["compact", "timeline"],
			education: ["compact", "timeline"],
			skills: ["chips", "groups"],
			metric: allMetricVariants("kpi"),
		},
		sectionOrder: [
			"about",
			"work",
			"services",
			"testimonials",
			"clients",
			"experience",
			"skills",
			"education",
			"certifications",
			"awards",
			"languages",
			"publications",
			"volunteer",
			"interests",
			"profiles",
			"contact",
		],
	},
};

/** The themes, in the order the theme gallery shows them. */
export const portfolioThemeLineup: readonly PortfolioThemeInfo[] = PORTFOLIO_THEMES.map(
	(id) => PORTFOLIO_THEME_INFO[id],
);

export function isFreePortfolioTheme(theme: PortfolioTheme): boolean {
	return PORTFOLIO_THEME_INFO[theme].plan === "free";
}

/** The variant a theme draws for a section: the stored one when the theme supports it, otherwise its default. */
export function themeVariant<K extends PortfolioVariantKey>(
	theme: PortfolioTheme,
	key: K,
	stored: string | undefined,
): PortfolioVariantValue<K> {
	const supported = PORTFOLIO_THEME_INFO[theme].variants[key] as readonly PortfolioVariantValue<K>[];
	const match = supported.find((variant) => variant === stored);
	return match ?? (supported[0] as PortfolioVariantValue<K>);
}

/** The intro effect a theme plays: the stored one when the theme supports it, otherwise its default. */
export function themeEffect(theme: PortfolioTheme, stored: PortfolioHeroEffect | undefined): PortfolioHeroEffect {
	const { effects } = PORTFOLIO_THEME_INFO[theme];
	return stored && effects.includes(stored) ? stored : (effects[0] ?? "none");
}

/** The font pair a theme uses: the chosen one when the theme offers it, otherwise its default. */
export function themeFontPair(theme: PortfolioTheme, stored: PortfolioFontPairId | undefined): PortfolioFontPairId {
	const { fontPairs } = PORTFOLIO_THEME_INFO[theme];
	return stored && fontPairs.includes(stored) ? stored : (fontPairs[0] ?? "jakarta");
}

/** Light or dark when chosen, otherwise the theme's own mode; `auto` follows the visitor's device. */
export function themeScheme(theme: PortfolioTheme, stored: PortfolioScheme | undefined): PortfolioScheme {
	return stored ?? PORTFOLIO_THEME_INFO[theme].defaultScheme;
}
