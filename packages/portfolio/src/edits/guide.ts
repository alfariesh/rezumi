import { FREE_PORTFOLIO_HERO_EFFECTS } from "@rezumi/schema/billing";
import { IMAGE_BLOCK_LAYOUTS } from "@rezumi/schema/portfolio/blocks";
import {
	PORTFOLIO_BUTTON_KINDS,
	PORTFOLIO_HERO_BACKGROUNDS,
	PORTFOLIO_JOB_TYPES,
	PORTFOLIO_WORK_MODES,
} from "@rezumi/schema/portfolio/data";
import { PORTFOLIO_EDITS_MAX } from "@rezumi/schema/portfolio/edits";
import { EMBED_PROVIDER_NAMES } from "@rezumi/schema/portfolio/embed";
import { PORTFOLIO_LIMITS } from "@rezumi/schema/portfolio/limits";
import {
	METRIC_CURRENCIES,
	METRIC_DIRECTIONS,
	METRIC_DURATION_UNITS,
	METRIC_FORMATS,
} from "@rezumi/schema/portfolio/metric";
import { PORTFOLIO_STANDARD_SECTIONS } from "@rezumi/schema/portfolio/sections";
import {
	PORTFOLIO_ACCENT_IDS,
	PORTFOLIO_FONT_PAIR_IDS,
	PORTFOLIO_HERO_EFFECTS,
	PORTFOLIO_SCHEMES,
	PORTFOLIO_THEME_INFO,
	PORTFOLIO_THEMES,
	PORTFOLIO_VARIANT_OPTIONS,
} from "@rezumi/schema/portfolio/themes";
import { PORTFOLIO_RICH_TEXT_TAGS } from "../rich-text";

const { text: max } = PORTFOLIO_LIMITS;
const list = (values: readonly string[]) => values.map((value) => `\`${value}\``).join(", ");
const free = new Set<string>(FREE_PORTFOLIO_HERO_EFFECTS);

const themes = PORTFOLIO_THEMES.map(
	(id) => `\`${id}\`${PORTFOLIO_THEME_INFO[id].plan === "plus" ? " (Plus)" : ""}`,
).join(", ");
const effects = PORTFOLIO_HERO_EFFECTS.map((id) => `\`${id}\`${free.has(id) ? "" : " (Plus)"}`).join(", ");
const variants = Object.entries(PORTFOLIO_VARIANT_OPTIONS)
	.map(([key, options]) => `${key}: ${options.join("/")}`)
	.join("; ");

const example = (title: string, edits: readonly object[]) =>
	`**${title}**\n\`\`\`json\n${JSON.stringify(edits)}\n\`\`\``;

const EXAMPLES = [
	example("Add a work with blocks and a cover from an upload", [
		{
			op: "add",
			list: "works",
			ref: "lumen",
			item: {
				title: "Lumen app redesign",
				summary: "A calmer checkout for a fintech app.",
				role: "Lead product designer",
				date: "2025",
				tags: ["Mobile", "Fintech"],
				cover: { key: "uploads/u1/pictures/portfolio/k3.webp", alt: "Lumen checkout screens" },
				blocks: [
					{ type: "text", html: "<h2>Problem</h2><p>Checkout took six steps.</p>" },
					{
						type: "images",
						images: [
							{ key: "uploads/u1/pictures/portfolio/k4.webp", alt: "Before and after", caption: "Before and after" },
						],
					},
				],
			},
		},
		{ op: "move", list: "works", id: "lumen", to: "first" },
	]),
	example("Rewrite About", [{ op: "set", path: "about.content", value: "<p>I design calm apps for busy people.</p>" }]),
	example("Change theme, accent and fonts (theme first: fonts and layouts are checked against it)", [
		{ op: "set", path: "theme", value: "prima" },
		{ op: "set", path: "design.accent", value: "toska" },
		{ op: "set", path: "design.fonts", value: "manrope" },
	]),
	example("Hide a CV item and rename a section", [
		{ op: "set", path: "sections.hiddenItems.experience", value: ["e2", "e7"] },
		{ op: "set", path: "sections.titles.experience", value: "Where I've worked" },
	]),
	example("Reorder and hide sections", [
		{ op: "set", path: "sections.order", value: ["work", "about", "experience", "services", "contact"] },
		{ op: "set", path: "sections.hidden", value: ["profiles", "interests"] },
	]),
	example("Add a metrics block, then highlight its metric on the work's card", [
		{
			op: "add",
			list: "blocks",
			workId: "w1",
			item: {
				type: "metrics",
				items: [
					{
						ref: "conv",
						label: "Checkout conversion",
						value: 2.8,
						format: "percent",
						change: { direction: "up", text: "+35%", good: true },
					},
				],
			},
		},
		{ op: "update", list: "works", id: "w1", fields: { highlightMetricId: "conv" } },
	]),
	example("Remove a work", [{ op: "remove", list: "works", id: "w3" }]),
];

/**
 * The edit language's reference for a model, in English Markdown: lists and their item fields, settable paths,
 * positions and refs, image refs, rich text, examples. One text for the assistant's prompt, the MCP resource and docs.
 * Its enumerations come from the schema's constants, so it can't drift from what the engine accepts.
 */
export const PORTFOLIO_EDIT_GUIDE = `# Portfolio edit language

Edits change the portfolio through \`edit_portfolio\`: \`{ "title": "<what they do, in the user's language>", "edits": [ … ] }\`, at most ${PORTFOLIO_EDITS_MAX} edits. They apply in order; each applies whole or fails alone with a reason (fix and resend only the failed ones). Read the portfolio first and use its ids.

## Ops
- \`{"op":"set","path":P,"value":V}\` writes one field whole. \`null\` removes an optional field (a \`basics.*\` override: the page follows the CV again) or resets a field to its default.
- \`{"op":"add","list":L,"item":{…},"ref":"name","at":POS}\` adds an item. Ids are made for it and everything inside it; never send \`id\`. \`ref\` (optional) names it: later edits in the same call use the ref wherever an id goes. Blocks and metrics inside an add may carry their own \`ref\`. Missing \`at\` adds at the end.
- \`{"op":"update","list":L,"id":ID,"fields":{…}}\` changes only the fields given; \`null\` removes an optional field.
- \`{"op":"remove","list":L,"id":ID}\` and \`{"op":"move","list":L,"id":ID,"to":POS}\`.
- POS: \`"first"\`, \`"last"\`, \`{"before":ID}\`, \`{"after":ID}\` (an item of the same list).
- Lists: \`works\`, \`services\`, \`testimonials\`, \`clients\`, \`custom\` (the portfolio's own sections), \`highlights\` (the intro's numbers), \`blocks\` (a work's detail; add \`"workId"\`), \`metrics\` (the numbers of one Metrics block; add \`"workId"\` and \`"blockId"\`).

## Values
- **Image ref**: \`{"key":K,"alt":"what it shows"}\`. K must come from the portfolio's \`images\` or \`uploads\` as you last read it, or from the tool that stored a new picture (save_attachment_image in the app, add_portfolio_image over MCP). A work's \`cover\` also takes \`"focus":{"x":0.5,"y":0.3}\` (0–1); pictures in an images block take \`"caption"\`.
- **Rich text** (\`about.content\`, a text block's \`html\`, a custom section's \`content\`): HTML with only ${PORTFOLIO_RICH_TEXT_TAGS.map((tag) => `<${tag}>`).join(" ")} (links: \`href\` http/https/mailto), or plain text (blank lines make paragraphs). Other markup is removed. Limits count visible text.
- **Button**: \`{"kind":K,"label":"optional text","url":"…"}\`; kinds ${list(PORTFOLIO_BUTTON_KINDS)}. \`profile\` and \`link\` need \`url\`; the others use the CV's or page's own address.
- **Metric**: \`{"label":"Checkout conversion","value":2.8,"format":"percent"}\`. \`value\`: a number, or short text (≤${max.metricText} characters, e.g. "Top 3"). \`format\`: ${list(METRIC_FORMATS)}; \`currency\` needs \`"currency"\` (${list(METRIC_CURRENCIES)}), \`duration\` needs \`"unit"\` (${list(METRIC_DURATION_UNITS)}). Optional: \`prefix\` (≤${max.metricPrefix}), \`suffix\` (≤${max.metricSuffix}), \`change\` \`{"direction":${METRIC_DIRECTIONS.map((value) => `"${value}"`).join("|")},"text":"+35%","good":true}\`, \`before\` (a number, drawn against the value), \`series\` (${PORTFOLIO_LIMITS.sparklinePoints.min}–${PORTFOLIO_LIMITS.sparklinePoints.max} numbers), \`progress\` (0–100), \`context\` (≤${max.metricContext}), \`icon\` (a Hugeicons name).

## Lists and their item fields
- **works** (≤${PORTFOLIO_LIMITS.works}, or the plan's limit): \`title\` (required, ≤${max.workTitle}), \`summary\` (≤${max.workSummary}), \`role\` (≤${max.workRole}), \`date\` (free text, ≤${max.workDate}), \`tags\` (≤${PORTFOLIO_LIMITS.tagsPerWork}), \`featured\`, \`hidden\`, \`cover\` (image ref), \`primaryLink\` \`{"label","url"}\`, \`highlightMetricId\` (a metric in this work's Metrics blocks, shown on its card), \`blocks\` (add only). The address (\`slug\`) is made from the title and follows a new title; \`update\` may set \`slug\` itself (lowercase letters, digits, single dashes); old addresses keep forwarding. Change blocks with the \`blocks\` list, never through \`update\`.
- **blocks** (≤${PORTFOLIO_LIMITS.blocksPerWork} per work), by \`type\`: \`text\` \`{"html"}\` (≤${max.blockText}); \`images\` \`{"images":[image refs],"layout":${IMAGE_BLOCK_LAYOUTS.map((value) => `"${value}"`).join("|")}}\` (1–${PORTFOLIO_LIMITS.imagesPerBlock}); \`metrics\` \`{"items":[metrics]}\` (1–${PORTFOLIO_LIMITS.metricsPerBlock}; later change them with the \`metrics\` list); \`video\` \`{"url"}\` (YouTube or Vimeo, optional \`title\`); \`embed\` \`{"url"}\` (${Object.values(EMBED_PROVIDER_NAMES).join(", ")}; optional \`title\`); \`link\` \`{"url","title","description","siteName","brandIcon","image"}\`. PDF blocks can't be added (the editor uploads them); they can be retitled, moved or removed. A block's type never changes.
- **highlights** (≤${PORTFOLIO_LIMITS.highlights}) and **metrics** (≤${PORTFOLIO_LIMITS.metricsPerBlock} per block): metrics. A Metrics block keeps at least one.
- **services** (≤${PORTFOLIO_LIMITS.services}): \`title\` (required, ≤${max.serviceTitle}), \`description\` (≤${max.serviceDescription}), \`price\` (free text, ≤${max.servicePrice}), \`icon\`, \`cta\` (a button; default opens Contact).
- **testimonials** (≤${PORTFOLIO_LIMITS.testimonials}): \`quote\` (required, ≤${max.quote}), \`name\`, \`role\`, \`photo\` (image ref), \`sourceUrl\`, \`consent\`: true. Only the author's real words, and only after the user confirmed the author agreed: then \`"consent": true\` (required).
- **clients** (≤${PORTFOLIO_LIMITS.clients}): \`name\`, \`logo\` (image ref or \`{"brandIcon":"github"}\`), \`url\`.
- **custom** (≤${PORTFOLIO_LIMITS.customSections}): \`title\` (required, ≤${max.customTitle}), \`content\` (rich text, ≤${max.customContent}), \`image\`, \`button\`, \`hidden\`. Its section key is \`custom:<id>\`.

## Settable paths (\`set\`)
- \`theme\`: ${themes}. Layouts, fonts and effects a theme doesn't offer are refused: read \`design.offered\` (or set the theme first).
- \`locale\`: the page's language, e.g. "id-ID"; \`null\` follows the CV.
- \`basics.name\` (≤${max.name}), \`basics.headline\` (≤${max.headline}), \`basics.location\` (≤${max.location}): portfolio-only overrides; \`null\` follows the CV. \`basics.picture\`: an image ref, \`null\` (no photo) or \`"resume"\` (the CV's photo).
- \`design.scheme\`: ${list(PORTFOLIO_SCHEMES)}, \`null\` = the theme's. \`design.accent\`: \`"resume"\`, a preset (${list(PORTFOLIO_ACCENT_IDS)}) or \`"#rrggbb"\`. \`design.fonts\`: \`"theme"\`, \`"resume"\` or a pair the theme offers (${PORTFOLIO_FONT_PAIR_IDS.length} pairs, e.g. ${list(PORTFOLIO_FONT_PAIR_IDS.slice(0, 3))}). \`design.variants.<section>\`: a layout the theme offers, \`null\` = the theme's default (${variants}).
- \`hero.greeting\` (≤${max.greeting}), \`hero.showPicture\`, \`hero.showLocation\` (booleans), \`hero.availability\` \`{"show":true,"text":"","roles":["Product Designer"],"types":["freelance"]}\` (whole; types: ${list(PORTFOLIO_JOB_TYPES)}; empty text says "Open to work"), \`hero.buttons\` (the whole list, ≤${PORTFOLIO_LIMITS.heroButtons} buttons), \`hero.effect\` \`{"id":E,"target":"name"|"headline","phrases":[≤${PORTFOLIO_LIMITS.typewriterPhrases}]}\` or just the effect id; effects ${effects}. \`hero.background\` \`{"kind":${PORTFOLIO_HERO_BACKGROUNDS.map((value) => `"${value}"`).join("|")},"image":ref}\`.
- \`about.content\`: rich text (≤${max.about}).
- \`sections.order\` and \`sections.hidden\`: lists of section keys (${list(PORTFOLIO_STANDARD_SECTIONS)}, \`custom:<id>\` (or \`custom:<ref>\` for a section added earlier in the call), \`resume:<id>\`); sections left out of the order go where the theme puts them. \`sections.titles.<key>\`: a custom title (≤${max.sectionTitle}), \`null\` restores the default. \`sections.hiddenItems.<key>\`: the ids of CV items hidden on the portfolio only (the whole list for that section; \`null\` shows all).
- \`location.label\`, \`location.workModes\` (${list(PORTFOLIO_WORK_MODES)}), \`location.relocate\`, \`location.timezone\` (IANA, e.g. "Asia/Jakarta"), \`location.showLocalTime\`.
- \`contact.email\`, \`contact.phone\`, \`contact.website\`, \`contact.profiles\`, \`contact.saveContact\`, \`contact.form\` (booleans: show the CV's detail), \`contact.note\` (≤${max.contactNote}), \`contact.whatsapp\` \`{"show":true,"number":"6281234567890"}\` (country code, digits only).
- \`seo.title\` (≤${max.seoTitle}), \`seo.description\` (≤${max.seoDescription}); \`credit.show\` (the "Made with Rezumi" badge).
- Lists with ids (\`hero.highlights\`, works, …) change only with add/update/remove/move; \`hero.buttons\` has no ids and is set whole.

## Rules
- Career sections (${list(["experience", "education", "skills", "languages", "certifications", "awards", "publications", "volunteer", "interests", "profiles"])}, \`resume:<id>\`) are read live from the CV or Profile: hide items or whole sections, rename or reorder them, never rewrite them here.
- Plan: what the portfolio you read marks \`locked\` (Plus themes, effects, hiding the badge, works past the plan's limit) is refused; suggest Plus instead of applying it. Keeping what the portfolio already has is fine.
- Never invent facts, numbers, clients, links or testimonials. Text limits count characters; longer values are refused with the limit.

## Examples
${EXAMPLES.join("\n\n")}
`;
