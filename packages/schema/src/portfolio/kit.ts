import z from "zod";
import { RICH_TEXT_MARKUP_FACTOR, richTextLength } from "./limits";

/**
 * Portfolio data has two schemas built from one definition. The write schema checks what a client sends: limits,
 * formats and references, filling in defaults for fields it leaves out (so an older editor still saves). The stored
 * schema reads what is in the database without ever failing: a broken field falls back to its default, a broken list
 * item is dropped, and write-only limits (text length) don't apply, so data saved under older rules still loads.
 */
export type SchemaKit = {
	lenient: boolean;
	/** A value with a default: used when it's missing, and (reading stored data) when it's broken. */
	field<T extends z.ZodType>(schema: T, fallback: z.output<T>): z.ZodDefault<T>;
	/** An optional value; reading stored data, a broken one reads as missing. */
	optional<T extends z.ZodType>(schema: T): z.ZodOptional<T>;
	/**
	 * A list of at most `max` items, empty by default. Writing, every item must be valid and, with `id`, have its own
	 * id; reading stored data, broken and repeated items are dropped and the rest cut at `max`.
	 */
	list<T extends z.ZodType>(
		item: T,
		max: number,
		options?: { id?: (item: z.output<T>) => string; min?: number },
	): z.ZodDefault<z.ZodArray<T>>;
	/** Plain text of at most `max` characters (write-only limit). */
	text(max: number): z.ZodString;
	/** HTML of at most `max` characters of visible text (write-only limit); the API sanitizes it before saving. */
	richText(max: number): z.ZodString;
	/** Checks an object as a whole: writing, problems are errors; reading stored data, `repair` fixes them instead. */
	whole<T extends z.ZodType>(
		schema: T,
		check: (value: z.output<T>, issue: (message: string, path: PropertyKey[]) => void) => void,
		repair: (value: z.output<T>) => z.output<T>,
	): T;
};

export function createSchemaKit(lenient: boolean): SchemaKit {
	return {
		lenient,
		field: (schema, fallback) => {
			const value = () => structuredClone(fallback) as never;
			// Typed as the write schema: both produce the same output, and the input of either may leave it out.
			return (lenient ? schema.catch(value).default(value) : schema.default(value)) as never;
		},
		optional: (schema) => (lenient ? schema.optional().catch(undefined) : schema.optional()) as never,
		list: (item, max, options = {}) => {
			if (lenient) {
				return z
					.array(z.unknown())
					.catch([])
					.transform((items) => {
						const seen = new Set<string>();
						const kept: z.output<typeof item>[] = [];
						for (const entry of items) {
							const parsed = item.safeParse(entry);
							if (!parsed.success) continue;
							const id = options.id?.(parsed.data);
							if (id !== undefined && seen.has(id)) continue;
							if (id !== undefined) seen.add(id);
							kept.push(parsed.data);
							if (kept.length === max) break;
						}
						return kept;
					})
					.default([]) as never;
			}
			const array = z
				.array(item)
				.min(options.min ?? 0)
				.max(max);
			const unique = options.id
				? array.superRefine((items, ctx) => {
						const seen = new Set<string>();
						items.forEach((entry, index) => {
							const id = options.id?.(entry as z.output<typeof item>) ?? "";
							if (seen.has(id))
								ctx.addIssue({ code: "custom", path: [index, "id"], message: "Each item needs its own id." });
							seen.add(id);
						});
					})
				: array;
			return unique.default([]) as never;
		},
		text: (max) => (lenient ? z.string() : z.string().max(max)),
		richText: (max) =>
			(lenient
				? z.string()
				: z
						.string()
						.max(max * RICH_TEXT_MARKUP_FACTOR)
						.refine(
							(html) => richTextLength(html) <= max,
							`Shorten this text to ${max} characters or fewer.`,
						)) as z.ZodString,
		whole: (schema, check, repair) =>
			(lenient
				? schema.transform(repair)
				: schema.superRefine((value, ctx) =>
						check(value, (message, path) => ctx.addIssue({ code: "custom", message, path })),
					)) as never,
	};
}

/** Item IDs: UUIDs and other short URL-safe identifiers. */
export const itemIdSchema = z
	.string()
	.regex(/^[\w-]{1,64}$/, "Use an id of letters, digits, '-' or '_' (at most 64).")
	.describe("A stable identifier for the item, usually a UUID.");
