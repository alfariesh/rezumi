import type { MessageDescriptor } from "@lingui/core";
import type { PortfolioBlock } from "@rezumi/schema/portfolio/blocks";
import type { PortfolioWork } from "@rezumi/schema/portfolio/data";
import type { IconName } from "@rezumi/ui/components/icon";
import { msg } from "@lingui/core/macro";
import { insertBlocks, newMetricsBlock, newTextBlock } from "@rezumi/portfolio/editing";

/**
 * Outlines to start a work's story from, one per kind of work: headed text blocks to write under, and a Metrics block
 * where the result is usually a number. Pictures and links aren't in them: those blocks can't be empty (a Pictures
 * block holds at least one picture, a Link block an address), so the person adds them with "/" or by pasting.
 */
export const STORY_TEMPLATE_IDS = ["case-study", "design", "engineering", "marketing", "visual", "writing"] as const;

export type StoryTemplateId = (typeof STORY_TEMPLATE_IDS)[number];

/**
 * A heading to write under, with the question shown in the empty paragraph below it until the person writes there
 * (`heading-hints.ts`). The same heading has the same question in every template.
 */
export type StorySection = { heading: MessageDescriptor; hint: MessageDescriptor };

/** A section, or the Metrics block. */
type StoryPart = StorySection | "metrics";

export type StoryTemplate = {
	id: StoryTemplateId;
	icon: IconName;
	name: MessageDescriptor;
	description: MessageDescriptor;
	parts: readonly StoryPart[];
};

const HINT = "A question shown in the empty paragraph under a story outline heading, until the person writes there";

export const STORY_SECTIONS = {
	problem: {
		heading: msg({ comment: "Story outline heading", message: "The problem" }),
		hint: msg({ comment: HINT, message: "What wasn't working, and for whom?" }),
	},
	role: {
		heading: msg({ comment: "Story outline heading", message: "My role" }),
		hint: msg({ comment: HINT, message: "Your title, the team, and what you owned." }),
	},
	process: {
		heading: msg({ comment: "Story outline heading", message: "The process" }),
		hint: msg({ comment: HINT, message: "The steps you took and the choices that mattered." }),
	},
	result: {
		heading: msg({ comment: "Story outline heading", message: "The result" }),
		hint: msg({ comment: HINT, message: "What changed? Put the numbers in the metrics below." }),
	},
	research: {
		heading: msg({ comment: "Story outline heading", message: "Research and insights" }),
		hint: msg({ comment: HINT, message: "What did you learn from users or data?" }),
	},
	designProcess: {
		heading: msg({ comment: "Story outline heading", message: "The design process" }),
		hint: msg({ comment: HINT, message: "Sketches, iterations, and why you chose this direction." }),
	},
	solution: {
		heading: msg({ comment: "Story outline heading", message: "The solution" }),
		hint: msg({ comment: HINT, message: "What you designed and why it works. Type “/” to add screens." }),
	},
	context: {
		heading: msg({ comment: "Story outline heading", message: "Context" }),
		hint: msg({ comment: HINT, message: "The product, the team, and where this fits." }),
	},
	challenge: {
		heading: msg({ comment: "Story outline heading", message: "The challenge" }),
		hint: msg({ comment: HINT, message: "What was slow, hard or broken?" }),
	},
	approach: {
		heading: msg({ comment: "Story outline heading", message: "Approach and stack" }),
		hint: msg({ comment: HINT, message: "How you tackled it, and the tools and languages you used." }),
	},
	decisions: {
		heading: msg({ comment: "Story outline heading", message: "Key decisions" }),
		hint: msg({ comment: HINT, message: "The trade-offs you made, and why." }),
	},
	outcome: {
		heading: msg({ comment: "Story outline heading", message: "The outcome" }),
		hint: msg({ comment: HINT, message: "What improved: speed, cost, reliability? Put the numbers below." }),
	},
	codeAndDemo: {
		heading: msg({ comment: "Story outline heading: where to link the code or a live demo", message: "Code and demo" }),
		hint: msg({ comment: HINT, message: "Type “/” to add a link to the code or a live demo." }),
	},
	goal: {
		heading: msg({ comment: "Story outline heading", message: "The goal" }),
		hint: msg({ comment: HINT, message: "What did this need to achieve, and by when?" }),
	},
	audience: {
		heading: msg({ comment: "Story outline heading", message: "The audience" }),
		hint: msg({ comment: HINT, message: "Who were you trying to reach?" }),
	},
	strategy: {
		heading: msg({ comment: "Story outline heading", message: "The strategy" }),
		hint: msg({ comment: HINT, message: "The idea behind it, and the channels you chose." }),
	},
	campaign: {
		heading: msg({ comment: "Story outline heading", message: "The campaign" }),
		hint: msg({ comment: HINT, message: "What went out, and when. Type “/” to add the creative." }),
	},
	results: {
		heading: msg({ comment: "Story outline heading", message: "The results" }),
		hint: msg({ comment: HINT, message: "Reach, sign-ups, sales: what moved? Put the numbers below." }),
	},
	brief: {
		heading: msg({ comment: "Story outline heading", message: "The brief" }),
		hint: msg({ comment: HINT, message: "What was asked for, in a line or two." }),
	},
	concept: {
		heading: msg({ comment: "Story outline heading", message: "The concept" }),
		hint: msg({ comment: HINT, message: "The idea or mood behind the work." }),
	},
	finalPieces: {
		heading: msg({
			comment: "Story outline heading: where the pictures of the finished work go",
			message: "The final pieces",
		}),
		hint: msg({ comment: HINT, message: "Type “/” to add your pictures or a video." }),
	},
	behindTheScenes: {
		heading: msg({ comment: "Story outline heading", message: "Behind the scenes" }),
		hint: msg({ comment: HINT, message: "Optional: sketches, the setup, the tools." }),
	},
	angle: {
		heading: msg({ comment: "Story outline heading", message: "The angle" }),
		hint: msg({ comment: HINT, message: "The hook or point of view that made it yours." }),
	},
	piece: {
		heading: msg({ comment: "Story outline heading: where to link or quote the written piece", message: "The piece" }),
		hint: msg({ comment: HINT, message: "Type “/” to link to it, or quote a short part." }),
	},
	reception: {
		heading: msg({ comment: "Story outline heading: how readers and the client responded", message: "The reception" }),
		hint: msg({ comment: HINT, message: "Reads, shares, feedback or awards." }),
	},
} as const satisfies Record<string, StorySection>;

const S = STORY_SECTIONS;

export const STORY_TEMPLATES: Record<StoryTemplateId, StoryTemplate> = {
	"case-study": {
		id: "case-study",
		icon: "list-numbers",
		name: msg({ comment: "Story outline for any kind of work", message: "Case study" }),
		description: msg`Problem, role, process and result. Fits any field`,
		parts: [S.problem, S.role, S.process, S.result, "metrics"],
	},
	design: {
		id: "design",
		icon: "palette",
		name: msg({ comment: "Story outline for product, UX and UI designers", message: "Product or UX design" }),
		description: msg`Research and insights, design process, solution and impact`,
		parts: [S.problem, S.role, S.research, S.designProcess, S.solution, S.result, "metrics"],
	},
	engineering: {
		id: "engineering",
		icon: "code",
		name: msg({ comment: "Story outline for developers and engineers", message: "Software or engineering" }),
		description: msg`Challenge, approach and stack, key decisions, outcome`,
		parts: [S.context, S.challenge, S.approach, S.decisions, S.outcome, "metrics", S.codeAndDemo],
	},
	marketing: {
		id: "marketing",
		icon: "trend-up",
		name: msg({ comment: "Story outline for marketing and growth work", message: "Marketing or growth" }),
		description: msg`Goal, audience, strategy, campaign and results`,
		parts: [S.goal, S.audience, S.strategy, S.campaign, S.results, "metrics"],
	},
	visual: {
		id: "visual",
		icon: "camera",
		name: msg({
			comment: "Story outline for photographers, illustrators and other visual work",
			message: "Photo, illustration or visual",
		}),
		description: msg`A short brief and concept, then room for your pictures`,
		parts: [S.brief, S.concept, S.finalPieces, S.behindTheScenes],
	},
	writing: {
		id: "writing",
		icon: "note-pencil",
		name: msg({ comment: "Story outline for writers, journalists and content work", message: "Writing or content" }),
		description: msg`Brief, angle, the piece and how it was received`,
		parts: [S.brief, S.angle, S.piece, S.reception, "metrics"],
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
 * The question to show under each outline heading, by the heading's text in the app's language. A heading the person
 * wrote themselves, or renamed, has none.
 */
export function storyHints(translate: Translate): Map<string, string> {
	const hints = new Map<string, string>();
	for (const section of Object.values(STORY_SECTIONS))
		hints.set(normalizeHeading(translate(section.heading)), translate(section.hint));
	return hints;
}

/** A heading's text as `storyHints` keys it: trimmed, spaces collapsed, case ignored. */
export function normalizeHeading(text: string): string {
	return text.replace(/\s+/g, " ").trim().toLowerCase();
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
