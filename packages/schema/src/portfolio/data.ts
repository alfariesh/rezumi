import type { SchemaKit } from "./kit";
import type { PortfolioSectionKey } from "./sections";
import type { PortfolioVariantKey } from "./themes";
import z from "zod";
import { localeSchema } from "@rezumi/utils/locale";
import { brandIconSchema, createBlockSchema, PORTFOLIO_BLOCK_TYPES } from "./blocks";
import { createImageSchema } from "./files";
import { createSchemaKit, itemIdSchema, resumeItemIdSchema } from "./kit";
import { PORTFOLIO_LIMITS } from "./limits";
import { portfolioUrlSchema, webUrlSchema } from "./links";
import { createMetricSchema, portfolioIconSchema } from "./metric";
import { isPortfolioSectionKey, portfolioSectionKeySchema } from "./sections";
import {
	defaultPortfolioTheme,
	isPortfolioVariant,
	PORTFOLIO_ACCENT_IDS,
	PORTFOLIO_FONT_PAIR_IDS,
	PORTFOLIO_HERO_EFFECTS,
	PORTFOLIO_SCHEMES,
	PORTFOLIO_VARIANT_KEYS,
	portfolioThemeSchema,
} from "./themes";

const { text: max } = PORTFOLIO_LIMITS;

export const PORTFOLIO_BUTTON_KINDS = ["resume", "pdf", "contact", "whatsapp", "email", "profile", "link"] as const;
export const PORTFOLIO_WORK_MODES = ["remote", "hybrid", "onsite"] as const;
export const PORTFOLIO_MAP_PRECISIONS = ["city", "region", "country"] as const;
/**
 * The map zoom for each precision (`02-teknis.md` section 24): the editor's map and the picture it saves, and the
 * page's "Open in map" link. City is the default: a point at the city's centre, never a street.
 */
export const PORTFOLIO_MAP_ZOOM = { city: 10, region: 7, country: 4 } as const satisfies Record<
	(typeof PORTFOLIO_MAP_PRECISIONS)[number],
	number
>;
export const PORTFOLIO_HERO_BACKGROUNDS = ["plain", "soft-gradient", "pattern", "image"] as const;

/** Work slugs: lowercase ASCII letters and digits with single dashes, unique within the portfolio. */
export const PORTFOLIO_SLUG_PATTERN = /^[\da-z]+(?:-[\da-z]+)*$/;
/** WhatsApp numbers: digits in international form without "+" (E.164), or empty. */
export const WHATSAPP_NUMBER_PATTERN = /^(?:[1-9]\d{6,14})?$/;
const HEX_COLOR_PATTERN = /^#[\da-f]{6}$/i;

function isTimeZone(value: string): boolean {
	try {
		new Intl.DateTimeFormat("en-US", { timeZone: value });
		return true;
	} catch {
		return false;
	}
}

/** A URL-safe slug from a title: ASCII letters and digits, accents removed, at most 64 characters. */
export function slugifyPortfolioTitle(title: string): string {
	return title
		.normalize("NFKD")
		.replace(/[̀-ͯ]/g, "")
		.toLowerCase()
		.replace(/[^\da-z]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, max.slug)
		.replace(/-+$/, "");
}

/** A slug for a work that no other work in `taken` uses, adding `-2`, `-3`… when needed. */
export function uniquePortfolioSlug(title: string, taken: ReadonlySet<string>): string {
	const base = slugifyPortfolioTitle(title) || "work";
	if (!taken.has(base)) return base;
	for (let index = 2; ; index++) {
		const suffix = `-${index}`;
		const candidate = `${base.slice(0, max.slug - suffix.length).replace(/-+$/, "")}${suffix}`;
		if (!taken.has(candidate)) return candidate;
	}
}

function createPortfolioSchemas(kit: SchemaKit) {
	const image = createImageSchema(kit);
	const metric = createMetricSchema(kit);
	const block = createBlockSchema(kit);

	const button = z.object({
		kind: z.enum(PORTFOLIO_BUTTON_KINDS).describe("What the button opens; the page fills in its address."),
		label: kit.optional(kit.text(max.buttonLabel)).describe("The button's text; empty uses a default."),
		url: kit.optional(portfolioUrlSchema).describe("The address, for profile and link buttons."),
	});

	const work = kit.whole(
		z.object({
			id: itemIdSchema,
			slug: kit.lenient ? z.string().catch("") : z.string().max(max.slug).regex(PORTFOLIO_SLUG_PATTERN),
			title: kit.field(kit.text(max.workTitle), ""),
			summary: kit.field(kit.text(max.workSummary), ""),
			role: kit.field(kit.text(max.workRole), ""),
			date: kit.field(kit.text(max.workDate), "").describe("Free text such as '2024' or 'Jan–Mar 2025'."),
			tags: kit.list(kit.text(max.tag), PORTFOLIO_LIMITS.tagsPerWork),
			cover: kit.optional(
				image.extend({
					focus: kit
						.optional(z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1) }))
						.describe("The point to keep in view when the cover is cropped, from 0 to 1."),
				}),
			),
			highlightMetricId: kit
				.optional(itemIdSchema)
				.describe("A metric from one of this work's Metrics blocks, shown on its card."),
			primaryLink: kit.optional(z.object({ label: kit.field(kit.text(max.buttonLabel), ""), url: portfolioUrlSchema })),
			blocks: kit.list(block, PORTFOLIO_LIMITS.blocksPerWork, { id: (item) => item.id }),
			featured: kit.field(z.boolean(), false),
			hidden: kit.field(z.boolean(), false),
			fromResumeItemId: kit.optional(resumeItemIdSchema).describe("The resume project this work was copied from."),
		}),
		(value, issue) => {
			if (value.highlightMetricId && !workMetricIds(value).has(value.highlightMetricId))
				issue("Highlight a metric from this work's Metrics blocks.", ["highlightMetricId"]);
		},
		(value) => {
			if (!value.highlightMetricId || workMetricIds(value).has(value.highlightMetricId)) return value;
			const { highlightMetricId: _dropped, ...rest } = value;
			return rest;
		},
	);

	const service = z.object({
		id: itemIdSchema,
		title: kit.field(kit.text(max.serviceTitle), ""),
		description: kit.field(kit.text(max.serviceDescription), ""),
		price: kit.optional(kit.text(max.servicePrice)).describe("Free text such as 'From Rp1.5m'."),
		icon: kit.optional(portfolioIconSchema),
		cta: kit.field(button, { kind: "contact" }).describe("The order button: WhatsApp, the contact form, or a link."),
	});

	const testimonial = z.object({
		id: itemIdSchema,
		quote: kit.field(kit.text(max.quote), ""),
		name: kit.field(kit.text(max.personName), ""),
		role: kit.field(kit.text(max.personRole), "").describe("Job title and company."),
		photo: kit.optional(image),
		sourceUrl: kit
			.optional(webUrlSchema)
			.describe("Where the testimonial was given, such as a LinkedIn recommendation."),
		consent: z
			.literal(true, "Confirm the testimonial is genuine and its author agreed to show it.")
			.describe("The author confirmed the testimonial is genuine and may be shown. Required."),
	});

	const client = z.object({
		id: itemIdSchema,
		name: kit.field(kit.text(max.clientName), "").describe("The client's name; also the logo's alternative text."),
		logo: kit.optional(z.union([image, z.object({ brandIcon: brandIconSchema })])),
		url: kit.optional(webUrlSchema),
	});

	const customSection = z.object({
		id: itemIdSchema,
		title: kit.field(kit.text(max.customTitle), ""),
		content: kit.field(kit.richText(max.customContent), ""),
		image: kit.optional(image),
		button: kit.optional(button),
		hidden: kit.field(z.boolean(), false),
	});

	const variants = (kit.lenient
		? z
				.record(z.string(), z.unknown())
				.catch({})
				.transform((value) =>
					Object.fromEntries(Object.entries(value).filter(([key, variant]) => isPortfolioVariant(key, variant))),
				)
		: z.record(z.string(), z.string()).superRefine((value, ctx) => {
				for (const [key, variant] of Object.entries(value))
					if (!isPortfolioVariant(key, variant))
						ctx.addIssue({ code: "custom", path: [key], message: "This section has no such layout." });
			})
	).describe(
		`Layout per section (${PORTFOLIO_VARIANT_KEYS.join(", ")}). A theme that lacks the chosen one uses its own default.`,
	) as unknown as z.ZodType<Partial<Record<PortfolioVariantKey, string>>>;

	/** A map keyed by section, such as custom titles: bad keys are errors when writing and dropped when reading. */
	const sectionRecord = <T extends z.ZodType>(value: T) =>
		(kit.lenient
			? z
					.record(z.string(), z.unknown())
					.catch({})
					.transform((record) =>
						Object.fromEntries(
							Object.entries(record).flatMap(([key, entry]) => {
								const parsed = value.safeParse(entry);
								return isPortfolioSectionKey(key) && parsed.success ? [[key, parsed.data]] : [];
							}),
						),
					)
			: z.record(z.string(), value).superRefine((record, ctx) => {
					for (const key of Object.keys(record))
						if (!isPortfolioSectionKey(key))
							ctx.addIssue({ code: "custom", path: [key], message: "This isn't a portfolio section." });
				})) as unknown as z.ZodType<Partial<Record<PortfolioSectionKey, z.output<T>>>>;

	const sectionKeyList = kit.list(portfolioSectionKeySchema, PORTFOLIO_LIMITS.sectionKeys, { id: (key) => key });
	// Reading stored data, only entries that aren't text are dropped, one at a time: any text might name a hidden item,
	// so keeping it can never show something the person hid.
	const hiddenItemList = kit.list(
		kit.lenient ? z.string() : resumeItemIdSchema,
		PORTFOLIO_LIMITS.hiddenItemsPerSection,
	);

	const data = z.object({
		version: kit.field(z.literal(1), 1),
		theme: kit.field(portfolioThemeSchema, defaultPortfolioTheme),
		locale: kit.optional(localeSchema).describe("The page's language; missing uses the source resume's."),
		basics: kit
			.field(
				z.object({
					name: kit.optional(kit.text(max.name)),
					headline: kit.optional(kit.text(max.headline)),
					picture: kit
						.optional(image.nullable())
						.describe("A portfolio-only photo; null shows no photo; missing uses the resume's."),
					location: kit.optional(kit.text(max.location)),
				}),
				{},
			)
			.describe("Portfolio-only replacements for the resume's basics. Empty or missing values use the resume's."),
		design: kit.field(
			z.object({
				scheme: kit.optional(z.enum(PORTFOLIO_SCHEMES)).describe("Light, dark or auto; missing uses the theme's."),
				accent: kit.field(
					z.discriminatedUnion("source", [
						z.object({ source: z.literal("resume") }),
						z.object({ source: z.literal("preset"), id: z.enum(PORTFOLIO_ACCENT_IDS) }),
						z.object({ source: z.literal("custom"), color: z.string().regex(HEX_COLOR_PATTERN) }),
					]),
					{ source: "resume" },
				),
				fonts: kit.field(
					z.discriminatedUnion("source", [
						z.object({ source: z.literal("theme") }),
						z.object({ source: z.literal("resume") }),
						z.object({ source: z.literal("pair"), id: z.enum(PORTFOLIO_FONT_PAIR_IDS) }),
					]),
					{ source: "theme" },
				),
				variants: kit.field(variants, {}),
			}),
			{ accent: { source: "resume" }, fonts: { source: "theme" }, variants: {} },
		),
		hero: kit.field(
			z.object({
				greeting: kit.field(kit.text(max.greeting), ""),
				showPicture: kit.field(z.boolean(), true),
				showLocation: kit
					.field(z.boolean(), true)
					.describe("False keeps the resume's location off the page, for someone whose resume holds a street address."),
				availability: kit.field(
					z.object({
						show: kit.field(z.boolean(), false),
						text: kit
							.field(kit.text(max.availability), "")
							.describe("Empty shows 'Open to work' in the page's language."),
					}),
					{ show: false, text: "" },
				),
				highlights: kit.list(metric, PORTFOLIO_LIMITS.highlights, { id: (item) => item.id }),
				buttons: kit.list(button, PORTFOLIO_LIMITS.heroButtons),
				effect: kit.field(
					z.object({
						id: kit.optional(z.enum(PORTFOLIO_HERO_EFFECTS)).describe("Missing uses the theme's effect."),
						target: kit.field(z.enum(["name", "headline"]), "name"),
						phrases: kit
							.list(kit.text(max.phrase), PORTFOLIO_LIMITS.typewriterPhrases)
							.describe(
								"Up to two roles the typewriter effect types after the headline, which it types first and stops on.",
							),
					}),
					{ target: "name", phrases: [] },
				),
				background: kit.field(
					z.object({
						kind: kit.field(z.enum(PORTFOLIO_HERO_BACKGROUNDS), "plain"),
						image: kit.optional(image),
					}),
					{ kind: "plain" },
				),
			}),
			{
				greeting: "",
				showPicture: true,
				showLocation: true,
				availability: { show: false, text: "" },
				highlights: [],
				buttons: [],
				effect: { target: "name", phrases: [] },
				background: { kind: "plain" },
			},
		),
		about: kit.field(z.object({ content: kit.field(kit.richText(max.about), "") }), { content: "" }),
		works: kit.field(z.object({ items: kit.list(work, PORTFOLIO_LIMITS.works, { id: (item) => item.id }) }), {
			items: [],
		}),
		services: kit.field(z.object({ items: kit.list(service, PORTFOLIO_LIMITS.services, { id: (item) => item.id }) }), {
			items: [],
		}),
		testimonials: kit.field(
			z.object({ items: kit.list(testimonial, PORTFOLIO_LIMITS.testimonials, { id: (item) => item.id }) }),
			{ items: [] },
		),
		clients: kit.field(z.object({ items: kit.list(client, PORTFOLIO_LIMITS.clients, { id: (item) => item.id }) }), {
			items: [],
		}),
		sections: kit.field(
			z.object({
				order: sectionKeyList.describe("Section order; empty, or sections left out, follow the theme's order."),
				hidden: sectionKeyList.describe("Sections not shown."),
				titles: kit.field(sectionRecord(kit.text(max.sectionTitle)), {}).describe("Custom section titles."),
				hiddenItems: kit
					.field(sectionRecord(hiddenItemList), {})
					.describe("Resume items hidden on the portfolio only, by section, with their ids as the resume has them."),
			}),
			{ order: [], hidden: [], titles: {}, hiddenItems: {} },
		),
		custom: kit
			.list(customSection, PORTFOLIO_LIMITS.customSections, { id: (item) => item.id })
			.describe("The portfolio's own free-form sections, placed with `custom:<id>` keys."),
		location: kit.field(
			z.object({
				label: kit.field(kit.text(max.location), "").describe("Such as 'Bandung, Indonesia'; empty uses the resume's."),
				point: kit.optional(
					z.object({
						lat: z.number().min(-90).max(90),
						lng: z.number().min(-180).max(180),
						precision: z.enum(PORTFOLIO_MAP_PRECISIONS),
					}),
				),
				showMap: kit.field(z.boolean(), false),
				map: kit.optional(z.object({ light: image, dark: image })).describe("Map pictures the editor made."),
				workModes: kit.list(z.enum(PORTFOLIO_WORK_MODES), PORTFOLIO_WORK_MODES.length, { id: (mode) => mode }),
				relocate: kit.field(z.boolean(), false),
				timezone: kit.optional(z.string().max(max.timezone).refine(isTimeZone, "Use an IANA time zone.")),
				showLocalTime: kit.field(z.boolean(), false),
			}),
			{ label: "", showMap: false, workModes: [], relocate: false, showLocalTime: false },
		),
		contact: kit.field(
			z.object({
				email: kit.field(z.boolean(), true).describe("Show the resume's email address."),
				phone: kit.field(z.boolean(), false).describe("Show the resume's phone number."),
				website: kit.field(z.boolean(), true).describe("Show the resume's website."),
				whatsapp: kit.field(
					z.object({
						show: kit.field(z.boolean(), false),
						number: kit.field(
							z.string().regex(WHATSAPP_NUMBER_PATTERN, "Enter the number with its country code, digits only."),
							"",
						),
					}),
					{ show: false, number: "" },
				),
				form: kit.field(z.boolean(), false),
				profiles: kit.field(z.boolean(), true).describe("Show the resume's profile links."),
				note: kit.field(kit.text(max.contactNote), "").describe("The invitation above the contact options."),
			}),
			{
				email: true,
				phone: false,
				website: true,
				whatsapp: { show: false, number: "" },
				form: false,
				profiles: true,
				note: "",
			},
		),
		seo: kit.field(
			z.object({
				title: kit.optional(kit.text(max.seoTitle)),
				description: kit.optional(kit.text(max.seoDescription)),
			}),
			{},
		),
		credit: kit.field(z.object({ show: kit.field(z.boolean(), true) }), { show: true }),
	});

	return kit.whole(
		data,
		(value, issue) => {
			const slugs = new Set<string>();
			value.works.items.forEach((item, index) => {
				if (slugs.has(item.slug)) issue("Each work needs its own address.", ["works", "items", index, "slug"]);
				slugs.add(item.slug);
			});
		},
		(value) => {
			// Valid addresses stay (the first work keeps a repeated one), so shared links keep working; then the rest
			// get new ones from their titles.
			const taken = new Set<string>();
			const kept = value.works.items.map((item) => {
				const valid = PORTFOLIO_SLUG_PATTERN.test(item.slug) && item.slug.length <= max.slug && !taken.has(item.slug);
				if (valid) taken.add(item.slug);
				return valid;
			});
			const items = value.works.items.map((item, index) => {
				if (kept[index]) return item;
				const slug = uniquePortfolioSlug(item.title || item.id, taken);
				taken.add(slug);
				return { ...item, slug };
			});
			return { ...value, works: { items } };
		},
	);
}

function workMetricIds(work: { blocks: readonly { type: string; items?: readonly { id: string }[] }[] }) {
	return new Set(
		work.blocks.flatMap((item) => (item.type === "metrics" ? (item.items ?? []).map(({ id }) => id) : [])),
	);
}

const writeSchema = createPortfolioSchemas(createSchemaKit(false));
const storedSchema = createPortfolioSchemas(createSchemaKit(true));

/** Portfolio data, as stored and as every reader sees it. */
export type PortfolioData = z.output<typeof writeSchema>;
/** What a client sends: defaulted fields may be left out. */
export type PortfolioDataInput = z.input<typeof writeSchema>;

export type PortfolioWork = PortfolioData["works"]["items"][number];
export type PortfolioService = PortfolioData["services"]["items"][number];
export type PortfolioTestimonial = PortfolioData["testimonials"]["items"][number];
export type PortfolioClient = PortfolioData["clients"]["items"][number];
export type PortfolioCustomSection = PortfolioData["custom"][number];
export type PortfolioButton = PortfolioData["hero"]["buttons"][number];
export type PortfolioLocation = PortfolioData["location"];
export type PortfolioContact = PortfolioData["contact"];
export type PortfolioDesign = PortfolioData["design"];

/**
 * Reads stored portfolio data without failing: broken fields fall back to defaults, broken or repeated items are
 * dropped, and data that isn't a portfolio at all reads as an empty one.
 */
export const portfolioDataSchema = storedSchema.catch(() => storedSchema.parse({})) as unknown as z.ZodType<
	PortfolioData,
	unknown
>;

export function parsePortfolioData(data: unknown): PortfolioData {
	return portfolioDataSchema.parse(data);
}

/** Drops blocks of a kind this version doesn't know (written by a newer editor), before the strict check. */
function withoutUnknownBlocks(input: unknown): unknown {
	const known = new Set<string>(PORTFOLIO_BLOCK_TYPES);
	const items = (input as { works?: { items?: unknown } } | null)?.works?.items;
	if (!Array.isArray(items)) return input;
	const works = items.map((item: unknown) => {
		const blocks = (item as { blocks?: unknown } | null)?.blocks;
		if (!Array.isArray(blocks)) return item;
		return {
			...(item as object),
			blocks: blocks.filter((entry: unknown) => known.has((entry as { type?: unknown } | null)?.type as string)),
		};
	});
	const source = input as { works: object };
	return { ...source, works: { ...source.works, items: works } };
}

/**
 * Checks data a client wants to save: every limit, format and reference, with defaults filled in for fields it left
 * out. Rich text still needs the API's sanitizer, and file keys its ownership check.
 */
export const writablePortfolioDataSchema = z.transform<PortfolioDataInput, PortfolioData>((input, ctx) => {
	const parsed = writeSchema.safeParse(withoutUnknownBlocks(input));
	if (parsed.success) return parsed.data;
	for (const issue of parsed.error.issues) ctx.addIssue({ ...issue });
	return z.NEVER;
});

export function parseWritablePortfolioData(data: unknown): PortfolioData {
	return writablePortfolioDataSchema.parse(data as PortfolioDataInput);
}
