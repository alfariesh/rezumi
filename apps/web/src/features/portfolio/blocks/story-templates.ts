import type { MessageDescriptor } from "@lingui/core";
import type { PortfolioBlock } from "@rezumi/schema/portfolio/blocks";
import type { PortfolioWork } from "@rezumi/schema/portfolio/data";
import type { IconName } from "@rezumi/ui/components/icon";
import { msg } from "@lingui/core/macro";
import { insertBlocks, newMetricsBlock, newTextBlock } from "./blocks";

/**
 * Outlines to start a work's story from, one per kind of work: headed text blocks to write under, and a Metrics block
 * where the result is usually a number. Pictures and links aren't in them: those blocks can't be empty (a Pictures
 * block holds at least one picture, a Link block an address), so the person adds them with "/" or by pasting.
 */
export const STORY_TEMPLATE_IDS = ["case-study", "design", "engineering", "marketing", "visual", "writing"] as const;

export type StoryTemplateId = (typeof STORY_TEMPLATE_IDS)[number];

/** A heading to write under, or the Metrics block. */
export type StoryPart = { heading: MessageDescriptor } | "metrics";

export type StoryTemplate = {
	id: StoryTemplateId;
	icon: IconName;
	name: MessageDescriptor;
	description: MessageDescriptor;
	parts: readonly StoryPart[];
};

const heading = (descriptor: MessageDescriptor): StoryPart => ({ heading: descriptor });

export const STORY_TEMPLATES: Record<StoryTemplateId, StoryTemplate> = {
	"case-study": {
		id: "case-study",
		icon: "list-numbers",
		name: msg({ comment: "Story outline for any kind of work", message: "Case study" }),
		description: msg`Problem, role, process and result. Fits any field`,
		parts: [
			heading(msg({ comment: "Story outline heading", message: "The problem" })),
			heading(msg({ comment: "Story outline heading", message: "My role" })),
			heading(msg({ comment: "Story outline heading", message: "The process" })),
			heading(msg({ comment: "Story outline heading", message: "The result" })),
			"metrics",
		],
	},
	design: {
		id: "design",
		icon: "palette",
		name: msg({ comment: "Story outline for product, UX and UI designers", message: "Product or UX design" }),
		description: msg`Research and insights, design process, solution and impact`,
		parts: [
			heading(msg({ comment: "Story outline heading", message: "The problem" })),
			heading(msg({ comment: "Story outline heading", message: "My role" })),
			heading(msg({ comment: "Story outline heading", message: "Research and insights" })),
			heading(msg({ comment: "Story outline heading", message: "The design process" })),
			heading(msg({ comment: "Story outline heading", message: "The solution" })),
			heading(msg({ comment: "Story outline heading", message: "The result" })),
			"metrics",
		],
	},
	engineering: {
		id: "engineering",
		icon: "code",
		name: msg({ comment: "Story outline for developers and engineers", message: "Software or engineering" }),
		description: msg`Challenge, approach and stack, key decisions, outcome`,
		parts: [
			heading(msg({ comment: "Story outline heading", message: "Context" })),
			heading(msg({ comment: "Story outline heading", message: "The challenge" })),
			heading(msg({ comment: "Story outline heading", message: "Approach and stack" })),
			heading(msg({ comment: "Story outline heading", message: "Key decisions" })),
			heading(msg({ comment: "Story outline heading", message: "The outcome" })),
			"metrics",
			heading(
				msg({ comment: "Story outline heading: where to link the code or a live demo", message: "Code and demo" }),
			),
		],
	},
	marketing: {
		id: "marketing",
		icon: "trend-up",
		name: msg({ comment: "Story outline for marketing and growth work", message: "Marketing or growth" }),
		description: msg`Goal, audience, strategy, campaign and results`,
		parts: [
			heading(msg({ comment: "Story outline heading", message: "The goal" })),
			heading(msg({ comment: "Story outline heading", message: "The audience" })),
			heading(msg({ comment: "Story outline heading", message: "The strategy" })),
			heading(msg({ comment: "Story outline heading", message: "The campaign" })),
			heading(msg({ comment: "Story outline heading", message: "The results" })),
			"metrics",
		],
	},
	visual: {
		id: "visual",
		icon: "camera",
		name: msg({
			comment: "Story outline for photographers, illustrators and other visual work",
			message: "Photo, illustration or visual",
		}),
		description: msg`A short brief and concept, then room for your pictures`,
		parts: [
			heading(msg({ comment: "Story outline heading", message: "The brief" })),
			heading(msg({ comment: "Story outline heading", message: "The concept" })),
			heading(
				msg({
					comment: "Story outline heading: where the pictures of the finished work go",
					message: "The final pieces",
				}),
			),
			heading(msg({ comment: "Story outline heading", message: "Behind the scenes" })),
		],
	},
	writing: {
		id: "writing",
		icon: "note-pencil",
		name: msg({ comment: "Story outline for writers, journalists and content work", message: "Writing or content" }),
		description: msg`Brief, angle, the piece and how it was received`,
		parts: [
			heading(msg({ comment: "Story outline heading", message: "The brief" })),
			heading(msg({ comment: "Story outline heading", message: "The angle" })),
			heading(
				msg({ comment: "Story outline heading: where to link or quote the written piece", message: "The piece" }),
			),
			heading(
				msg({ comment: "Story outline heading: how readers and the client responded", message: "The reception" }),
			),
			"metrics",
		],
	},
};

/** Turns a message into text in the app's language (`i18n._` in the editor). */
export type Translate = (descriptor: MessageDescriptor) => string;

const escapeHtml = (text: string) => text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");

/** A template's blocks: each heading as a text block with an empty paragraph under it, and the Metrics block. */
export function storyTemplateBlocks(id: StoryTemplateId, translate: Translate): PortfolioBlock[] {
	return STORY_TEMPLATES[id].parts.map((part) =>
		part === "metrics" ? newMetricsBlock() : newTextBlock(`<h2>${escapeHtml(translate(part.heading))}</h2><p></p>`),
	);
}

/**
 * Adds a template's outline after the work's blocks, as far as the work has room (`blockRoom`). Returns the blocks that
 * went in, so the caret can go to the first one.
 */
export function addStoryTemplate(work: PortfolioWork, id: StoryTemplateId, translate: Translate): PortfolioBlock[] {
	const blocks = storyTemplateBlocks(id, translate);
	return blocks.slice(0, insertBlocks(work, work.blocks.length, blocks));
}

// Checked in order: "graphic designer" and "video editor" are visual work, "UX writer" writing before design, "content
// marketer" marketing (writing only matches content writers).
const FIELD_PATTERNS: [StoryTemplateId, RegExp][] = [
	[
		"visual",
		/photo|foto|illustrat|ilustra|graphic|grafis|\bvideo|videograph|\bmotion|animat|artist|seniman|painter|pelukis|cinematograph/,
	],
	[
		"writing",
		/writer|writing|penulis|copywrit|journalis|jurnalis|\beditor|wartawan|author|blogger|content (writ|strateg)/,
	],
	["design", /design|desain|\bux\b|\bui\b|interaction|interaksi/],
	[
		"marketing",
		/market|pemasar|growth|\bbrand (manager|strateg)|\bseo\b|social media|media sosial|promo|campaign|kampanye|advertis|iklan/,
	],
	[
		"engineering",
		/develop|engineer|programmer|software|front-?end|back-?end|full-?stack|devops|data scien|machine learning|pengembang|insinyur|\bsre\b/,
	],
];

/**
 * The template that most likely fits someone, from their role on the work, then their headline: only the picker's
 * suggestion, never added without them choosing it. The generic case study when nothing matches.
 */
export function suggestStoryTemplate(...descriptions: (string | null | undefined)[]): StoryTemplateId {
	for (const description of descriptions) {
		const text = description?.trim().toLowerCase();
		if (!text) continue;
		const match = FIELD_PATTERNS.find(([, pattern]) => pattern.test(text));
		if (match) return match[0];
	}
	return "case-study";
}
