import z from "zod";
import { PORTFOLIO_ITEM_ID_PATTERN } from "./limits";
import { isPortfolioSectionKey } from "./sections";
import { PORTFOLIO_VARIANT_KEYS } from "./themes";

/**
 * The edit language AI writes portfolios in (Phase 14, `phase-14-asisten-ai.md`): the in-app assistant, MCP and WebMCP
 * all send the same edits, and `@rezumi/portfolio/edits` applies them. Edits address list items by id, never by
 * position, so an edit stays right when the person changed something else in between. Item and value shapes are
 * checked by the engine against the portfolio's write schema; they are open records here so a model can read one
 * reference (`PORTFOLIO_EDIT_GUIDE`) instead of a deeply nested JSON Schema.
 */

/** Lists an edit can add to, change, remove from and reorder. */
export const PORTFOLIO_EDIT_LISTS = [
	"works",
	"services",
	"testimonials",
	"clients",
	"custom",
	"highlights",
	"blocks",
	"metrics",
] as const;
export type PortfolioEditList = (typeof PORTFOLIO_EDIT_LISTS)[number];

/** Most edits one call may carry. */
export const PORTFOLIO_EDITS_MAX = 40;

/**
 * Fields `set` writes whole. Lists with ids (works, services, …) are changed with add/update/remove/move instead.
 * `design.variants`, `sections.titles` and `sections.hiddenItems` also take one key: `design.variants.work`,
 * `sections.titles.experience`, `sections.hiddenItems.experience`.
 */
export const PORTFOLIO_SETTABLE_PATHS = [
	"theme",
	"locale",
	"basics.name",
	"basics.headline",
	"basics.location",
	"basics.picture",
	"design.scheme",
	"design.accent",
	"design.fonts",
	"design.variants",
	"hero.greeting",
	"hero.showPicture",
	"hero.showLocation",
	"hero.availability",
	"hero.buttons",
	"hero.effect",
	"hero.background",
	"about.content",
	"sections.order",
	"sections.hidden",
	"sections.titles",
	"sections.hiddenItems",
	"location.label",
	"location.workModes",
	"location.relocate",
	"location.timezone",
	"location.showLocalTime",
	"contact.email",
	"contact.phone",
	"contact.website",
	"contact.profiles",
	"contact.saveContact",
	"contact.form",
	"contact.note",
	"contact.whatsapp",
	"seo.title",
	"seo.description",
	"credit.show",
] as const;
export type PortfolioSettablePath = (typeof PORTFOLIO_SETTABLE_PATHS)[number];

const SETTABLE = new Set<string>(PORTFOLIO_SETTABLE_PATHS);
const KEYED_PATHS = {
	"design.variants.": (key: string) => (PORTFOLIO_VARIANT_KEYS as readonly string[]).includes(key),
	"sections.titles.": isPortfolioSectionKey,
	"sections.hiddenItems.": isPortfolioSectionKey,
} as const;

/** Whether `set` may write `path`: one of `PORTFOLIO_SETTABLE_PATHS`, or a keyed path such as `sections.titles.work`. */
export function isPortfolioSettablePath(path: string): boolean {
	if (SETTABLE.has(path)) return true;
	return Object.entries(KEYED_PATHS).some(
		([prefix, isKey]) => path.startsWith(prefix) && isKey(path.slice(prefix.length)),
	);
}

/** An item id, or a `ref` an earlier `add` in the same call gave the item it created. */
const idOrRefSchema = z
	.string()
	.regex(
		PORTFOLIO_ITEM_ID_PATTERN,
		"Use an id from the portfolio as you last read it, or a ref from an earlier add in this call.",
	);

export const portfolioEditPositionSchema = z
	.union([
		z.enum(["first", "last"]),
		z.strictObject({ before: idOrRefSchema }),
		z.strictObject({ after: idOrRefSchema }),
	])
	.describe('Where in the list: "first", "last", { "before": id } or { "after": id }. Missing adds at the end.');
export type PortfolioEditPosition = z.infer<typeof portfolioEditPositionSchema>;

const target = {
	list: z
		.enum(PORTFOLIO_EDIT_LISTS)
		.describe(
			"works, services, testimonials, clients, custom (the portfolio's own sections), highlights (the intro's numbers), blocks (a work's blocks: needs workId) or metrics (the numbers in a Metrics block: needs workId and blockId).",
		),
	workId: idOrRefSchema.optional().describe("For blocks and metrics: the work."),
	blockId: idOrRefSchema.optional().describe("For metrics: the Metrics block."),
};

const itemSchema = z
	.record(z.string(), z.unknown())
	.describe(
		"The item's fields, as PORTFOLIO_EDIT_GUIDE describes them for this list. Ids are made for you: never send one.",
	);

export const portfolioEditSchema = z
	.discriminatedUnion("op", [
		z.strictObject({
			op: z.literal("set"),
			path: z
				.string()
				.refine(
					isPortfolioSettablePath,
					"This field can't be set. Lists with ids change with add, update, remove or move.",
				)
				.describe(
					`A field to write whole: ${PORTFOLIO_SETTABLE_PATHS.join(", ")}; or one key of a map: design.variants.<section>, sections.titles.<section key>, sections.hiddenItems.<section key>.`,
				),
			value: z
				.unknown()
				.describe(
					'The field\'s new value, whole. null removes an optional field (a basics override: the page follows the resume again) or resets one to its default. Shorthands: design.accent "toska", "#0f766e" or "resume"; design.fonts a font pair id, "theme" or "resume"; hero.effect an effect id.',
				),
		}),
		z.strictObject({
			op: z.literal("add"),
			...target,
			item: itemSchema,
			ref: idOrRefSchema
				.optional()
				.describe('A name for the new item that later edits in this call can use as its id, e.g. "new-work".'),
			at: portfolioEditPositionSchema.optional(),
		}),
		z.strictObject({
			op: z.literal("update"),
			...target,
			id: idOrRefSchema,
			fields: itemSchema.describe(
				"Only the fields to change; the others keep their value. null removes an optional field.",
			),
		}),
		z.strictObject({ op: z.literal("remove"), ...target, id: idOrRefSchema }),
		z.strictObject({ op: z.literal("move"), ...target, id: idOrRefSchema, to: portfolioEditPositionSchema }),
	])
	.superRefine((edit, ctx) => {
		if (edit.op === "set") return;
		const needsWork = edit.list === "blocks" || edit.list === "metrics";
		if (needsWork && !edit.workId) ctx.addIssue({ code: "custom", path: ["workId"], message: "Name the work." });
		if (!needsWork && edit.workId)
			ctx.addIssue({ code: "custom", path: ["workId"], message: "Only blocks and metrics take a work." });
		if (edit.list === "metrics" && !edit.blockId)
			ctx.addIssue({ code: "custom", path: ["blockId"], message: "Name the Metrics block." });
		if (edit.list !== "metrics" && edit.blockId)
			ctx.addIssue({ code: "custom", path: ["blockId"], message: "Only metrics take a block." });
	});
export type PortfolioEdit = z.infer<typeof portfolioEditSchema>;

export const portfolioEditsInputSchema = z.object({
	title: z
		.string()
		.trim()
		.min(1)
		.max(200)
		.describe(
			'A short title (a few words) for what the edits do together, in the user\'s language, e.g. "Add the Lumen redesign as a work".',
		),
	edits: z.array(portfolioEditSchema).min(1).max(PORTFOLIO_EDITS_MAX),
});
export type PortfolioEditsInput = z.infer<typeof portfolioEditsInputSchema>;
