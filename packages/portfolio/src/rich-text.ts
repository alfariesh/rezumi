import type { PortfolioData } from "@rezumi/schema/portfolio/data";
import sanitizeHtml from "sanitize-html";

/**
 * What a portfolio's rich text may contain: the formats the editor's toolbar offers and the page can style (bold,
 * italic, underline, strikethrough, links, lists, quotes, H2/H3). No images, tables, code, colors, classes or styles.
 */
export const PORTFOLIO_RICH_TEXT_TAGS = [
	"p",
	"br",
	"strong",
	"em",
	"u",
	"s",
	"a",
	"ul",
	"ol",
	"li",
	"blockquote",
	"h2",
	"h3",
] as const;

const options: sanitizeHtml.IOptions = {
	allowedTags: [...PORTFOLIO_RICH_TEXT_TAGS],
	allowedAttributes: { a: ["href"], ol: ["start"] },
	allowedSchemes: ["http", "https", "mailto"],
	allowedSchemesAppliedToAttributes: ["href"],
	allowProtocolRelative: false,
	// Pasted and resume HTML uses other spellings of the same formats; keep the format, not the tag.
	transformTags: {
		b: "strong",
		i: "em",
		strike: "s",
		del: "s",
		h1: "h2",
		h4: "h3",
		h5: "h3",
		h6: "h3",
		div: "p",
	},
	// Other tags go but keep their text; these lose their content too.
	nonTextTags: ["script", "style", "textarea", "option", "noscript", "template", "iframe", "object", "svg", "math"],
};

/**
 * Cleans rich text to the portfolio's subset. The API runs it on every save and the page renderer again on every
 * render, so data written any other way still can't carry markup, scripts or `javascript:` links.
 */
export function sanitizePortfolioHtml(html: string): string {
	return sanitizeHtml(html, options);
}

/** Every rich-text field of portfolio data, cleaned. Returns a new object; the input is unchanged. */
export function sanitizePortfolioData(data: PortfolioData): PortfolioData {
	return {
		...data,
		about: { ...data.about, content: sanitizePortfolioHtml(data.about.content) },
		works: {
			items: data.works.items.map((work) => ({
				...work,
				blocks: work.blocks.map((block) =>
					block.type === "text" ? { ...block, html: sanitizePortfolioHtml(block.html) } : block,
				),
			})),
		},
		custom: data.custom.map((section) => ({ ...section, content: sanitizePortfolioHtml(section.content) })),
	};
}
