import type { EditItem } from "./lists";
import type { PortfolioData } from "@rezumi/schema/portfolio/data";
import type { PortfolioEditList } from "@rezumi/schema/portfolio/edits";
import type { PortfolioImage } from "@rezumi/schema/portfolio/files";
import { PORTFOLIO_SLUG_PATTERN, uniquePortfolioSlug } from "@rezumi/schema/portfolio/data";
import { EMBED_PROVIDER_NAMES, parseEmbedUrl } from "@rezumi/schema/portfolio/embed";
import {
	fitsRichText,
	PORTFOLIO_ITEM_ID_PATTERN,
	PORTFOLIO_LIMITS,
	RICH_TEXT_MARKUP_FACTOR,
	richTextLength,
} from "@rezumi/schema/portfolio/limits";
import {
	PORTFOLIO_ACCENT_IDS,
	PORTFOLIO_FONT_PAIR_IDS,
	PORTFOLIO_THEME_INFO,
	PORTFOLIO_VARIANT_KEYS,
} from "@rezumi/schema/portfolio/themes";
import { parseVideoUrl, youtubeThumbnailUrl } from "@rezumi/schema/portfolio/video";
import { sanitizePortfolioHtml } from "../rich-text";
import { escapeHtmlText } from "../text";
import { refuse } from "./errors";
import { itemLabel } from "./lists";

// Strict mode's reading of what a model sends: item and value inputs become the data's own shapes. Ids are made, image
// refs looked up, rich text cleaned, links parsed. Types and limits are left to the write schema the result must pass,
// which names the field; these check what it can't (unknown and read-only fields, refs, image keys, plan-free rules).

const { text: max } = PORTFOLIO_LIMITS;

type Fields = Record<string, unknown>;

/** What reading an input needs: the data before the edit, the images it may place, ids and refs. */
export type InputEnv = {
	data: PortfolioData;
	/** The data at the start of the call (what a work's address history counts as saved). */
	original: PortfolioData;
	images: ReadonlyMap<string, PortfolioImage>;
	newId: () => string;
	/** An id or a ref from an earlier add in this call, as the item's id. */
	resolve: (id: string) => string;
	/** Records a ref given to an item created inside an add (a block, a metric). */
	claimRef: (ref: unknown, id: string, what: string) => void;
};

/** A field's value that removes it, as `null` does in an input. */
export const REMOVE: unique symbol = Symbol("remove");

const trimmed = (value: unknown) => (typeof value === "string" ? value.trim() : value);
const isObject = (value: unknown): value is Fields =>
	typeof value === "object" && value !== null && !Array.isArray(value);

function asObject(value: unknown, what: string): Fields {
	return isObject(value) ? value : refuse(`${what}: give an object with the fields the guide lists.`);
}

/** Refuses fields an input may not carry: `id` (made for it), read-only ones, and ones the list doesn't have. */
function checkFields(
	input: Fields,
	allowed: readonly string[],
	what: string,
	readOnly: Readonly<Record<string, string>> = {},
): void {
	for (const key of Object.keys(input)) {
		if (key === "id")
			refuse(
				`${what}: leave out "id"; new items get one, and an item's id never changes. Name a new item with "ref" to use it later in this call.`,
			);
		const reason = readOnly[key];
		if (reason) refuse(`${what}: "${key}" can't be set here; ${reason}`);
		if (!allowed.includes(key)) refuse(`${what}: unknown field "${key}". Use: ${allowed.join(", ")}.`);
	}
}

/** Text a person reads, trimmed; empty means removed for optional fields. */
function optionalText(value: unknown): unknown {
	const text = trimmed(value);
	return text === "" || text === null ? null : text;
}

/** Tags that make text HTML: the subset's and the spellings the sanitizer turns into them. */
const RICH_MARKUP = /<\/?(?:p|br|strong|em|u|s|a|ul|ol|li|blockquote|h[1-6]|b|i|strike|del|div|span)(?:\s[^<>]*)?\/?>/i;

/** Plain text as paragraphs: blank lines part them, single line breaks stay. */
function plainToHtml(text: string): string {
	return text
		.split(/\n\s*\n/)
		.map((paragraph) => paragraph.trim())
		.filter(Boolean)
		.map((paragraph) => `<p>${escapeHtmlText(paragraph).replace(/\n/g, "<br>")}</p>`)
		.join("");
}

/** Rich text in the portfolio's subset, from HTML or plain text, within `limit` characters of text. */
function richTextInput(value: unknown, limit: number, what: string): unknown {
	if (value === null) return null;
	if (typeof value !== "string") return refuse(`${what}: give HTML or plain text.`);
	const text = value.trim();
	// Cleaning takes time in proportion to the input: what is longer than any field's markup may run is refused unread.
	if (text.length > limit * RICH_TEXT_MARKUP_FACTOR)
		refuse(`${what}: far too long (${text.length} characters with markup). At most ${limit} characters of text.`);
	const clean = sanitizePortfolioHtml(RICH_MARKUP.test(text) ? text : plainToHtml(text));
	if (!fitsRichText(clean, limit)) {
		const length = richTextLength(clean);
		refuse(
			length > limit
				? `${what}: at most ${limit} characters of text (this has ${length}). Shorten it.`
				: `${what}: too much markup for its text (${clean.length} characters with tags, at most ${limit * RICH_TEXT_MARKUP_FACTOR}). Use fewer tags.`,
		);
	}
	return clean;
}

/**
 * An image ref (`{ key, alt?, … }`) as a stored image: the key must be one of the images the data uses or the uploads
 * given; width, height and the small copy come from there. `extras` are the fields the place adds (a caption, a focus).
 */
function imageInput(value: unknown, env: InputEnv, what: string, extras: readonly string[] = []): unknown {
	if (value === null) return null;
	const input = asObject(value, `${what} (an image: { "key": …, "alt": … })`);
	const allowed = ["key", "alt", ...extras, "width", "height", "thumbKey"];
	for (const key of Object.keys(input))
		if (!allowed.includes(key))
			refuse(`${what}: unknown image field "${key}". Use: key, alt${extras.map((extra) => `, ${extra}`).join("")}.`);
	const key = typeof input.key === "string" ? input.key.trim() : "";
	const known = env.images.get(key);
	if (!known)
		return refuse(
			`${what}: "${key}" isn't one of this portfolio's images. Use a key from the portfolio's images or uploads (as last read), or one an image tool returned.`,
		);
	const out: Fields = { ...known, alt: input.alt === undefined ? known.alt : (trimmed(input.alt) ?? "") };
	if (extras.includes("caption") && input.caption !== undefined && optionalText(input.caption) !== null)
		out.caption = optionalText(input.caption);
	if (extras.includes("focus") && input.focus !== undefined && input.focus !== null) out.focus = input.focus;
	return out;
}

/** A button: what it opens, its text, and the address profile and link buttons need. */
function buttonInput(value: unknown, what: string): unknown {
	if (value === null) return null;
	const input = asObject(value, what);
	checkFields(input, ["kind", "label", "url"], what);
	if ((input.kind === "profile" || input.kind === "link") && !trimmed(input.url))
		refuse(`${what}: a ${String(input.kind)} button needs "url".`);
	const label = optionalText(input.label);
	return {
		kind: input.kind,
		...(label === null || label === undefined ? {} : { label }),
		...(input.url === undefined || input.url === null ? {} : { url: trimmed(input.url) }),
	};
}

// Metrics: the intro's highlights and a Metrics block's numbers.

const METRIC_FIELDS = [
	"label",
	"value",
	"format",
	"currency",
	"unit",
	"prefix",
	"suffix",
	"change",
	"before",
	"series",
	"progress",
	"context",
	"icon",
] as const;

function metricFields(input: Fields, what: string, nested: boolean): Fields {
	checkFields(input, nested ? [...METRIC_FIELDS, "ref"] : METRIC_FIELDS, what);
	const out: Fields = {};
	for (const [key, raw] of Object.entries(input)) {
		if (key === "ref") continue;
		if (key === "value")
			out.value =
				typeof raw === "number"
					? { kind: "number", number: raw }
					: typeof raw === "string"
						? { kind: "text", text: raw.trim() }
						: raw;
		else if (key === "label") out.label = trimmed(raw) ?? null;
		else if (key === "context" || key === "icon") out[key] = optionalText(raw);
		else if (key === "prefix" || key === "suffix") out[key] = raw === "" ? null : raw;
		else out[key] = raw;
	}
	return out;
}

/**
 * A metric as stored: a currency format needs its currency and a duration its unit (without them it shows as a plain
 * number), and a format drops the unit it doesn't use, as the editor's format choice does.
 */
export function finishMetric(item: Fields, what: string): void {
	const format = item.format ?? "plain";
	if (format === "currency") {
		if (!item.currency) refuse(`${what}: the currency format needs "currency" (IDR or USD).`);
	} else delete item.currency;
	if (format === "duration") {
		if (!item.unit) refuse(`${what}: the duration format needs "unit" (hour, day, week or month).`);
	} else delete item.unit;
}

function newMetric(value: unknown, env: InputEnv, what: string, nested: boolean): Fields {
	const input = asObject(value, what);
	const fields = metricFields(input, what, nested);
	if (typeof fields.label !== "string" || !fields.label) refuse(`${what}: a metric needs a "label".`);
	const id = env.newId();
	if (nested && input.ref !== undefined) env.claimRef(input.ref, id, what);
	const item: Fields = { id, value: { kind: "number", number: 0 }, format: "plain", ...withoutRemoved(fields) };
	finishMetric(item, what);
	return item;
}

// Blocks: a work's detail.

const BLOCK_FIELDS: Record<string, readonly string[]> = {
	text: ["html"],
	images: ["images", "layout"],
	metrics: ["items"],
	video: ["url", "title", "thumbnail"],
	embed: ["url", "title", "thumbnail"],
	pdf: ["title"],
	link: ["url", "title", "description", "siteName", "brandIcon", "image"],
};
const ADDABLE_BLOCKS = ["text", "images", "metrics", "video", "embed", "link"];

function videoFields(url: unknown, what: string): Fields {
	const parsed = typeof url === "string" ? parseVideoUrl(url) : null;
	if (!parsed) return refuse(`${what}: ${JSON.stringify(url)} isn't a YouTube or Vimeo video link.`);
	if (parsed.provider === "youtube")
		return {
			provider: "youtube",
			videoId: parsed.videoId,
			hash: null,
			thumbnailUrl: youtubeThumbnailUrl(parsed.videoId),
		};
	return { provider: "vimeo", videoId: parsed.videoId, hash: parsed.hash ?? null, thumbnailUrl: null };
}

function embedFields(url: unknown, what: string): Fields {
	const parsed = typeof url === "string" ? parseEmbedUrl(url) : null;
	if (!parsed)
		return refuse(
			`${what}: ${JSON.stringify(url)} isn't a link that can be embedded (${Object.values(EMBED_PROVIDER_NAMES).join(", ")}). Use a link block for other sites.`,
		);
	return { provider: parsed.provider, ref: parsed.ref };
}

function imageList(value: unknown, env: InputEnv, what: string): unknown {
	if (!Array.isArray(value) || !value.length) return refuse(`${what}: give "images" as a list of at least one image.`);
	return value.map((image, index) => imageInput(image, env, `${what} › images #${index + 1}`, ["caption"]));
}

/** One field of a block input of `type`, read; links are parsed by the caller. */
function blockField(type: string, key: string, raw: unknown, env: InputEnv, what: string): unknown {
	switch (key) {
		case "html":
			return richTextInput(raw ?? "", max.blockText, `${what} › html`);
		case "images":
			return imageList(raw, env, what);
		case "thumbnail":
		case "image":
			return imageInput(raw, env, `${what} › ${key}`);
		case "title":
			return type === "pdf" || type === "link" ? (trimmed(raw) ?? "") : optionalText(raw);
		case "description":
		case "siteName":
		case "brandIcon":
			return optionalText(raw);
		default:
			return raw;
	}
}

function newBlock(value: unknown, env: InputEnv, what: string): Fields {
	const input = asObject(value, what);
	const type = typeof input.type === "string" ? input.type : "";
	if (type === "pdf")
		refuse(
			`${what}: PDF blocks can't be added here, as a PDF needs the editor's upload. Ask the user to add it in the editor.`,
		);
	if (!ADDABLE_BLOCKS.includes(type)) refuse(`${what}: "type" must be one of ${ADDABLE_BLOCKS.join(", ")}.`);
	const allowed = BLOCK_FIELDS[type] ?? [];
	checkFields(input, ["type", "ref", ...allowed], `${what} (${type} block)`);
	const id = env.newId();
	const label = `${what} (${type} block)`;
	const block: Fields = { id, type };
	for (const key of allowed) {
		if (key === "url" || key === "items" || key === "images" || input[key] === undefined) continue;
		block[key] = blockField(type, key, input[key], env, label);
	}
	if (type === "text" && block.html === undefined) block.html = "";
	if (type === "images") {
		block.images = imageList(input.images, env, label);
		block.layout ??= (block.images as unknown[]).length === 1 ? "full" : "grid";
	}
	if (type === "metrics") {
		if (!Array.isArray(input.items) || !input.items.length)
			refuse(`${label}: give "items", a list of 1 to ${PORTFOLIO_LIMITS.metricsPerBlock} metrics.`);
		block.items = input.items.map((metric, index) => newMetric(metric, env, `${label} › items #${index + 1}`, true));
	}
	if (type === "video") Object.assign(block, videoFields(input.url, label));
	if (type === "embed") Object.assign(block, embedFields(input.url, label));
	if (type === "link") {
		block.url = trimmed(input.url);
		block.title ??= "";
	}
	if (input.ref !== undefined) env.claimRef(input.ref, id, label);
	return withoutRemoved(block);
}

function blockUpdate(old: EditItem, input: Fields, env: InputEnv, what: string): Fields {
	const type = String(old.type);
	if (type === "metrics" && "items" in input)
		refuse(`${what}: change a Metrics block's numbers with the metrics list (list "metrics" with workId and blockId).`);
	checkFields(input, BLOCK_FIELDS[type] ?? [], what, {
		type: "a block's type can't change. Remove it and add a new block.",
	});
	const out: Fields = {};
	for (const [key, raw] of Object.entries(input)) {
		if (key === "url") {
			if (raw === null) refuse(`${what}: a ${type} block needs its "url".`);
			if (type === "video") Object.assign(out, videoFields(raw, what), { thumbnail: null });
			else if (type === "embed") Object.assign(out, embedFields(raw, what), { thumbnail: null });
			else out.url = trimmed(raw);
		} else if (key === "images") out.images = imageList(raw, env, what);
		else if (key !== "thumbnail") out[key] = blockField(type, key, raw, env, what);
	}
	// A thumbnail given with a new address stays; the old one showed the old content.
	if ("thumbnail" in input) out.thumbnail = blockField(type, "thumbnail", input.thumbnail, env, what);
	return out;
}

// Works.

const WORK_FIELDS = [
	"title",
	"summary",
	"role",
	"date",
	"tags",
	"featured",
	"hidden",
	"cover",
	"primaryLink",
	"highlightMetricId",
] as const;

const WORK_READ_ONLY = {
	blocks: 'change blocks with the "blocks" list (add, update, remove, move with workId).',
	previousSlugs: "a work's old addresses are kept for you when its slug changes.",
	fromResumeItemId: "it records the resume project the work was copied from.",
};

function workValues(input: Fields, env: InputEnv, what: string): Fields {
	const out: Fields = {};
	for (const [key, raw] of Object.entries(input)) {
		switch (key) {
			case "blocks":
			case "slug":
				break;
			case "title":
				if (typeof raw !== "string" || !raw.trim()) refuse(`${what}: a work needs a "title".`);
				out.title = raw.trim();
				break;
			case "summary":
			case "role":
			case "date":
				out[key] = trimmed(raw) ?? null;
				break;
			case "tags":
				out.tags = Array.isArray(raw)
					? raw.map((tag) => trimmed(tag)).filter((tag) => tag !== "")
					: raw === null
						? null
						: raw;
				break;
			case "cover":
				out.cover = imageInput(raw, env, `${what} › cover`, ["focus"]);
				break;
			case "primaryLink": {
				if (raw === null) {
					out.primaryLink = null;
					break;
				}
				const link = asObject(raw, `${what} › primaryLink`);
				checkFields(link, ["label", "url"], `${what} › primaryLink`);
				out.primaryLink = { label: trimmed(link.label) ?? "", url: trimmed(link.url) };
				break;
			}
			case "highlightMetricId":
				out.highlightMetricId = typeof raw === "string" ? env.resolve(raw) : raw;
				break;
			default:
				out[key] = raw;
		}
	}
	return out;
}

function newWork(value: unknown, env: InputEnv, what: string): Fields {
	const input = asObject(value, what);
	checkFields(input, [...WORK_FIELDS, "blocks"], what, {
		slug: "a new work's address is made from its title. Change it with an update after adding.",
		previousSlugs: WORK_READ_ONLY.previousSlugs,
		fromResumeItemId: WORK_READ_ONLY.fromResumeItemId,
	});
	if (typeof input.title !== "string" || !input.title.trim()) refuse(`${what}: a work needs a "title".`);
	const id = env.newId();
	if (input.blocks !== undefined && !Array.isArray(input.blocks)) refuse(`${what}: give "blocks" as a list.`);
	const blocks = ((input.blocks as unknown[] | undefined) ?? []).map((block, index) =>
		newBlock(block, env, `${what} › blocks #${index + 1}`),
	);
	const values = workValues(input, env, what);
	const title = values.title as string;
	return withoutRemoved({
		id,
		slug: uniquePortfolioSlug(title, new Set(env.data.works.items.map((work) => work.slug))),
		previousSlugs: [],
		title,
		summary: "",
		role: "",
		date: "",
		tags: [],
		featured: false,
		hidden: false,
		...values,
		blocks,
	});
}

/** Old addresses as stored: newest first, each once, at most the limit, none a work now uses as its address. */
function cleanSlugHistory(history: readonly string[], active: ReadonlySet<string>): string[] {
	return [...new Set(history)].filter((slug) => !active.has(slug)).slice(0, PORTFOLIO_LIMITS.previousSlugs);
}

/**
 * A work's changes, with its address as the editor keeps it: a slug given is checked and taken; a new title moves an
 * address that still is the one its old title made. The old address goes to the front of `previousSlugs` (so shared
 * links forward to the new one) when the call started with it saved as this work's address.
 */
function workUpdate(old: EditItem, input: Fields, env: InputEnv, what: string): Fields {
	checkFields(input, [...WORK_FIELDS, "slug"], what, WORK_READ_ONLY);
	const out = workValues(input, env, what);
	const work = old as unknown as PortfolioData["works"]["items"][number];
	const others = new Set(env.data.works.items.filter((item) => item.id !== work.id).map((item) => item.slug));
	let slug = work.slug;
	if ("slug" in input) {
		const given = trimmed(input.slug);
		if (typeof given !== "string" || !given || given.length > max.slug || !PORTFOLIO_SLUG_PATTERN.test(given))
			refuse(
				`${what}: "slug" must be lowercase letters and digits with single dashes, at most ${max.slug} characters.`,
			);
		if (others.has(given)) {
			const owner = env.data.works.items.find((item) => item.slug === given && item.id !== work.id);
			refuse(`${what}: the address "${given}" is taken by work "${owner?.title ?? ""}".`);
		}
		slug = given;
	} else if (typeof out.title === "string" && work.slug === uniquePortfolioSlug(work.title, others))
		slug = uniquePortfolioSlug(out.title, others);
	if (slug !== work.slug) {
		const saved = env.original.works.items.find((item) => item.id === work.id);
		const wasSaved = saved ? saved.slug === work.slug || saved.previousSlugs.includes(work.slug) : false;
		out.slug = slug;
		out.previousSlugs = cleanSlugHistory(
			wasSaved ? [work.slug, ...work.previousSlugs] : work.previousSlugs,
			new Set([...others, slug]),
		);
	}
	return out;
}

// The other lists.

const SIMPLE_FIELDS: Record<"services" | "testimonials" | "clients" | "custom", readonly string[]> = {
	services: ["title", "description", "price", "icon", "cta"],
	testimonials: ["quote", "name", "role", "photo", "sourceUrl", "consent"],
	clients: ["name", "logo", "url"],
	custom: ["title", "content", "image", "button", "hidden"],
};

const CONSENT =
	'a testimonial needs "consent": true, set only after the user confirmed its author agreed to show it (ask first). Use the author\'s own words, never invented ones.';

function simpleValues(list: keyof typeof SIMPLE_FIELDS, input: Fields, env: InputEnv, what: string): Fields {
	checkFields(input, SIMPLE_FIELDS[list], what);
	const out: Fields = {};
	for (const [key, raw] of Object.entries(input)) {
		const where = `${what} › ${key}`;
		switch (key) {
			case "cta":
				// Without one, the order button opens Contact.
				out.cta = buttonInput(raw, where);
				break;
			case "button":
				out.button = buttonInput(raw, where);
				break;
			case "photo":
			case "image":
				out[key] = imageInput(raw, env, where);
				break;
			case "logo":
				if (isObject(raw) && "brandIcon" in raw) {
					checkFields(raw, ["brandIcon"], where);
					out.logo = { brandIcon: trimmed(raw.brandIcon) };
				} else out.logo = imageInput(raw, env, where);
				break;
			case "content":
				out.content = richTextInput(raw, max.customContent, where);
				break;
			case "consent":
				if (raw !== true) refuse(`${what}: ${CONSENT}`);
				out.consent = true;
				break;
			case "price":
			case "icon":
			case "sourceUrl":
			case "url":
				out[key] = optionalText(raw);
				break;
			case "title":
			case "description":
			case "quote":
			case "name":
			case "role":
				out[key] = trimmed(raw) ?? null;
				break;
			default:
				out[key] = raw;
		}
	}
	return out;
}

function newSimpleItem(list: keyof typeof SIMPLE_FIELDS, value: unknown, env: InputEnv, what: string): Fields {
	const input = asObject(value, what);
	const values = simpleValues(list, input, env, what);
	const has = (key: string) => typeof values[key] === "string" && values[key] !== "";
	if (list === "services" && !has("title")) refuse(`${what}: a service needs a "title".`);
	if (list === "custom" && !has("title")) refuse(`${what}: a section needs a "title".`);
	if (list === "clients" && !has("name") && !values.logo) refuse(`${what}: a client needs a "name" or a "logo".`);
	if (list === "testimonials") {
		if (values.consent !== true) refuse(`${what}: ${CONSENT}`);
		if (!has("quote")) refuse(`${what}: a testimonial needs its "quote".`);
	}
	return withoutRemoved({ id: env.newId(), ...values });
}

/** Leaves out fields an add set to null: on a new item, null is the same as not giving the field. */
function withoutRemoved(item: Fields): Fields {
	return Object.fromEntries(Object.entries(item).filter(([, value]) => value !== null && value !== undefined));
}

/** A new item of `list` from a strict input, with its id and the ids of anything inside it. */
export function newItemInput(list: PortfolioEditList, value: unknown, env: InputEnv, what: string): EditItem {
	switch (list) {
		case "works":
			return newWork(value, env, what) as EditItem;
		case "blocks":
			return newBlock(value, env, what) as EditItem;
		case "highlights":
		case "metrics":
			return newMetric(value, env, what, false) as EditItem;
		default:
			return newSimpleItem(list, value, env, what) as EditItem;
	}
}

/** The fields an update of `old` writes, from a strict input: null removes a field. Derived fields are included. */
export function updateInput(list: PortfolioEditList, old: EditItem, value: unknown, env: InputEnv): Fields {
	const what = itemLabel(list, old);
	const input = asObject(value, `${what} › fields`);
	switch (list) {
		case "works":
			return workUpdate(old, input, env, what);
		case "blocks":
			return blockUpdate(old, input, env, what);
		case "highlights":
		case "metrics":
			return metricFields(input, what, false);
		default: {
			const values = simpleValues(list, input, env, what);
			if (list === "services" && values.title === "") refuse(`${what}: a service needs a "title".`);
			if (list === "custom" && values.title === "") refuse(`${what}: a section needs a "title".`);
			return values;
		}
	}
}

// Values `set` writes.

const SHORT_TEXT_PATHS = new Set(["basics.name", "basics.headline", "basics.location", "seo.title", "seo.description"]);

function themeName(data: PortfolioData): string {
	return PORTFOLIO_THEME_INFO[data.theme].name;
}

function accentInput(value: unknown): unknown {
	if (typeof value !== "string") return value;
	const text = value.trim();
	if (text === "resume") return { source: "resume" };
	if ((PORTFOLIO_ACCENT_IDS as readonly string[]).includes(text)) return { source: "preset", id: text };
	if (/^#[\da-f]{6}$/i.test(text)) return { source: "custom", color: text };
	return refuse(`design.accent: use "resume", one of ${PORTFOLIO_ACCENT_IDS.join(", ")}, or a colour as "#rrggbb".`);
}

function fontsInput(value: unknown, data: PortfolioData): unknown {
	let fonts = value;
	if (typeof value === "string") {
		const text = value.trim();
		if (text === "theme" || text === "resume") fonts = { source: text };
		else if ((PORTFOLIO_FONT_PAIR_IDS as readonly string[]).includes(text)) fonts = { source: "pair", id: text };
		else return refuse(`design.fonts: use "theme", "resume" or a font pair id: ${PORTFOLIO_FONT_PAIR_IDS.join(", ")}.`);
	}
	if (isObject(fonts) && fonts.source === "pair") {
		const offered = PORTFOLIO_THEME_INFO[data.theme].fontPairs as readonly string[];
		if (!offered.includes(String(fonts.id)))
			refuse(
				`design.fonts: the ${themeName(data)} theme offers these font pairs: ${offered.join(", ")}. Set the theme first if it changes.`,
			);
	}
	return fonts;
}

function variantInput(key: string, value: unknown, data: PortfolioData): unknown {
	if (value === null) return REMOVE;
	const supported = (PORTFOLIO_THEME_INFO[data.theme].variants as Record<string, readonly string[]>)[key];
	if (!supported)
		return refuse(`design.variants: "${key}" isn't a section with layouts. Use: ${PORTFOLIO_VARIANT_KEYS.join(", ")}.`);
	if (typeof value !== "string" || !supported.includes(value))
		refuse(`design.variants.${key}: the ${themeName(data)} theme offers ${supported.join(", ")}.`);
	return value;
}

function effectInput(value: unknown, data: PortfolioData): unknown {
	const effect = typeof value === "string" ? { ...data.hero.effect, id: value.trim() } : value;
	if (!isObject(effect)) return effect;
	for (const key of Object.keys(effect))
		if (!["id", "target", "phrases"].includes(key))
			refuse(`hero.effect: unknown field "${key}". Use: id, target, phrases.`);
	const offered = PORTFOLIO_THEME_INFO[data.theme].effects as readonly string[];
	if (effect.id !== undefined && effect.id !== null && !offered.includes(String(effect.id)))
		refuse(`hero.effect: the ${themeName(data)} theme offers these effects: ${offered.join(", ")}.`);
	const { id, ...rest } = effect;
	return id === undefined || id === null ? rest : effect;
}

/** A section key with a portfolio section's ref (`custom:<ref>`) made its id. */
export function resolveSectionKey(key: unknown, env: InputEnv): unknown {
	return typeof key === "string" && key.startsWith("custom:")
		? `custom:${env.resolve(key.slice("custom:".length))}`
		: key;
}

const resolveKeys = (value: unknown, env: InputEnv) =>
	Array.isArray(value) ? value.map((key) => resolveSectionKey(key, env)) : value;

/**
 * The value `set` writes at `path`, from a strict input. `REMOVE` deletes the field, so an optional one is gone (a
 * basics override: the page follows the resume again) and a defaulted one takes its default.
 */
export function setInput(path: string, value: unknown, env: InputEnv): unknown {
	const { data } = env;
	if (path.startsWith("design.variants.")) return variantInput(path.slice("design.variants.".length), value, data);
	if (path.startsWith("sections.titles.")) return optionalText(value) ?? REMOVE;
	if (path.startsWith("sections.hiddenItems."))
		return value === null || (Array.isArray(value) && !value.length) ? REMOVE : value;
	if (SHORT_TEXT_PATHS.has(path)) return optionalText(value) ?? REMOVE;
	switch (path) {
		case "basics.picture":
			if (value === null) return null;
			if (value === "resume") return REMOVE;
			return imageInput(value, env, "basics.picture");
		case "design.accent":
			return value === null ? REMOVE : accentInput(value);
		case "design.fonts":
			return value === null ? REMOVE : fontsInput(value, data);
		case "design.variants": {
			if (value === null) return REMOVE;
			const variants = asObject(value, "design.variants");
			return Object.fromEntries(
				Object.entries(variants).flatMap(([key, entry]) => {
					const variant = variantInput(key, entry, data);
					return variant === REMOVE ? [] : [[key, variant]];
				}),
			);
		}
		case "hero.effect":
			return value === null ? REMOVE : effectInput(value, data);
		case "hero.buttons":
			if (value === null) return REMOVE;
			if (!Array.isArray(value)) return refuse("hero.buttons: give the whole list of buttons.");
			return value.map((button, index) => buttonInput(button, `hero.buttons #${index + 1}`));
		case "hero.background": {
			if (value === null) return REMOVE;
			const background = asObject(value, "hero.background");
			checkFields(background, ["kind", "image"], "hero.background");
			if (background.kind === "image" && !background.image)
				refuse('hero.background: an "image" background needs "image".');
			const image =
				background.image === undefined ? null : imageInput(background.image, env, "hero.background › image");
			return { kind: background.kind, ...(image ? { image } : {}) };
		}
		case "hero.availability": {
			if (value === null) return REMOVE;
			const availability = asObject(value, "hero.availability");
			checkFields(availability, ["show", "text", "roles", "types"], "hero.availability");
			return {
				...availability,
				...(typeof availability.text === "string" ? { text: availability.text.trim() } : {}),
				...(Array.isArray(availability.roles)
					? { roles: availability.roles.map((role) => trimmed(role)).filter((role) => role !== "") }
					: {}),
			};
		}
		case "about.content":
			return value === null ? REMOVE : richTextInput(value, max.about, "about.content");
		case "sections.order":
		case "sections.hidden":
			return value === null ? REMOVE : resolveKeys(value, env);
		case "sections.titles": {
			if (value === null) return REMOVE;
			const titles = asObject(value, "sections.titles");
			return Object.fromEntries(
				Object.entries(titles).flatMap(([key, title]) => {
					const text = optionalText(title);
					return text === null ? [] : [[resolveSectionKey(key, env), text]];
				}),
			);
		}
		case "sections.hiddenItems": {
			if (value === null) return REMOVE;
			const hidden = asObject(value, "sections.hiddenItems");
			return Object.fromEntries(Object.entries(hidden).map(([key, ids]) => [resolveSectionKey(key, env), ids]));
		}
		case "contact.whatsapp": {
			if (value === null) return REMOVE;
			const whatsapp = asObject(value, "contact.whatsapp");
			checkFields(whatsapp, ["show", "number"], "contact.whatsapp");
			return {
				...whatsapp,
				...(typeof whatsapp.number === "string" ? { number: whatsapp.number.replace(/[\s().+-]/g, "") } : {}),
			};
		}
		case "hero.greeting":
		case "location.label":
		case "contact.note":
			return value === null ? REMOVE : trimmed(value);
		default:
			return value === null ? REMOVE : value;
	}
}

/** Checks a ref's form: the same as an id, so it can stand where an id goes. */
export function checkRefForm(ref: unknown, what: string): string {
	if (typeof ref !== "string" || !PORTFOLIO_ITEM_ID_PATTERN.test(ref))
		return refuse(`${what}: a ref is letters, digits, "-" or "_", at most ${max.id} characters.`);
	return ref;
}
