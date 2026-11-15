/**
 * Plain text from page markup (02-teknis.md §7.5): block elements become line breaks, list items get a bullet, runs of
 * spaces and blank lines collapse. Only text ever leaves the page; no markup is kept or inserted anywhere.
 */

/** Never read: code, styling, controls, and hidden content. */
const SKIPPED = new Set([
	"SCRIPT",
	"STYLE",
	"NOSCRIPT",
	"TEMPLATE",
	"SVG",
	"CANVAS",
	"IFRAME",
	"BUTTON",
	"INPUT",
	"SELECT",
	"TEXTAREA",
	"OPTION",
]);

/** Page chrome, skipped when reading a whole page rather than a site's known description block. */
const CHROME = new Set(["NAV", "HEADER", "FOOTER", "ASIDE", "FORM", "DIALOG"]);

const BLOCK =
	/^(ADDRESS|ARTICLE|BLOCKQUOTE|BR|DD|DIV|DL|DT|FIGCAPTION|FIGURE|H[1-6]|HR|LI|MAIN|OL|P|PRE|SECTION|TABLE|TBODY|TR|UL)$/;

type TextOptions = {
	/** Also skip navigation, headers, footers, side columns, forms and dialogs (whole-page reading). */
	skipChrome?: boolean;
	/** Elements to leave out, such as a description block's own "About the job" heading. */
	skip?: (element: Element) => boolean;
};

/** Collapses spaces within lines, trims every line and keeps at most one blank line in a row. */
export function tidy(text: string): string {
	return text
		.replaceAll(" ", " ")
		.split("\n")
		.map((line) => line.replace(/[ \t\f\v\r​]+/g, " ").trim())
		.join("\n")
		.replace(/\n{3,}/g, "\n\n")
		.trim();
}

/** Cuts text to `max` characters without splitting a surrogate pair. */
export function clip(text: string, max: number): string {
	if (text.length <= max) return text;
	const cut = text.slice(0, max);
	return /[\ud800-\udbff]$/.test(cut) ? cut.slice(0, -1) : cut;
}

const isHidden = (element: Element) =>
	element.hasAttribute("hidden") ||
	element.getAttribute("aria-hidden") === "true" ||
	(element instanceof HTMLElement && element.style.display === "none");

/** The element's readable text, tidied; empty for a missing element. */
export function textOf(element: Element | null | undefined, options: TextOptions = {}): string {
	if (!element) return "";
	const parts: string[] = [];
	const walk = (node: Node) => {
		if (node.nodeType === Node.TEXT_NODE) {
			parts.push(node.textContent ?? "");
			return;
		}
		if (node.nodeType !== Node.ELEMENT_NODE) return;
		const child = node as Element;
		const tag = child.tagName.toUpperCase();
		if (SKIPPED.has(tag) || isHidden(child)) return;
		if (options.skipChrome && CHROME.has(tag)) return;
		if (options.skip?.(child)) return;
		const block = BLOCK.test(tag);
		if (block) parts.push("\n");
		if (tag === "LI") parts.push("• ");
		for (const grandchild of child.childNodes) walk(grandchild);
		if (block) parts.push("\n");
	};
	for (const child of element.childNodes) walk(child);
	return tidy(parts.join(""));
}

/** The first matching element's text, trying each selector in turn. */
export function firstText(root: ParentNode, selectors: readonly string[]): string {
	for (const selector of selectors) {
		const text = textOf(root.querySelector(selector));
		if (text) return text;
	}
	return "";
}

/** A line that starts with an amount of money (Rp 8.000.000, Rp. 8.000.000, IDR8jt, $90K/yr, S$ 5,000, RM3,500, ₱30,000). */
const MONEY = /^(?:Rp|IDR|USD|SGD|MYR|PHP|S\$|RM|US\$|[$€£₱¥₹])\.?\s?\d/i;

/** True when a short line states a pay amount (not "pay not provided", not a sentence that mentions a price). */
export const looksLikeSalary = (text: string) => text.length <= 80 && MONEY.test(text.trim());

const EMPLOYMENT_TYPES =
	/^(full[- ]time|part[- ]time|contract|temporary|internship|freelance|casual|permanent|penuh waktu|paruh waktu|kontrak|magang|lepas|harian|tetap|temporer|full time|part time)\b/i;

/** True when a short line names a kind of employment (Full-time, Kontrak, Magang, …). */
export const looksLikeEmploymentType = (text: string) => text.length <= 60 && EMPLOYMENT_TYPES.test(text);

/**
 * The company's logo in a part of the page (a board's top card): an https picture whose alt text names the company or
 * says "logo", else the first such picture inside one of `selectors`. Inline (`data:`) pictures are never sent.
 */
export function logoIn(
	root: ParentNode | null | undefined,
	company: string,
	selectors: readonly string[] = [],
): string {
	if (!root) return "";
	const https = (image: Element | null | undefined) => {
		const source = image?.getAttribute("src")?.trim() ?? "";
		return /^https:\/\/\S+$/i.test(source) ? source : "";
	};
	for (const selector of selectors) {
		const found = https(root.querySelector(selector));
		if (found) return found;
	}
	const name = company.trim().toLowerCase();
	for (const image of root.querySelectorAll("img")) {
		const alt = image.getAttribute("alt")?.toLowerCase() ?? "";
		if ((name && alt.includes(name)) || /\blogo\b/.test(alt)) {
			const found = https(image);
			if (found) return found;
		}
	}
	return "";
}
