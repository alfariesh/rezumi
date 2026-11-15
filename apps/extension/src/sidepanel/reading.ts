import type { pageReadingSchema } from "../shared/messages";
import type { HtmlToText, PagePosting } from "@rezumi/job-sites/json-ld";
import type { z } from "zod";
import { jobPostingsInJson, toPagePosting } from "@rezumi/job-sites/json-ld";

export type PageReading = z.infer<typeof pageReadingSchema>;

/** Where a shown value came from: the board's reader, the page's JSON-LD, the page's text, or the person's selection. */
type FieldSource = "site" | "json-ld" | "page" | "selection";

type ShownField = { value: string; source: FieldSource };

/** The fields the panel shows, in order; `description` is the posting text. */
export const SHOWN_FIELDS = [
	"role",
	"company",
	"location",
	"salary",
	"employmentType",
	"validThrough",
	"description",
] as const;
export type ShownFieldName = (typeof SHOWN_FIELDS)[number];

/** Fields a posting should always have; the ones left empty go in a page report (aturan turunan #8). */
const EXPECTED_FIELDS = ["role", "company", "location", "description"] as const satisfies readonly ShownFieldName[];

export type ReadingSummary = {
	/** `posting`: a board posting or a page with a JobPosting; `page`: some other page with text; `none`: no text. */
	kind: "posting" | "page" | "none";
	fields: Partial<Record<ShownFieldName, ShownField>>;
	/** Expected fields nothing could read. */
	missing: ShownFieldName[];
};

/** Plain text from an HTML fragment, through an inert document (nothing loads, nothing runs). */
const domHtmlToText: HtmlToText = (html) => {
	const body = new DOMParser().parseFromString(html, "text/html").body;
	for (const block of body.querySelectorAll("p, li, br, div, h1, h2, h3, h4, h5, h6, tr")) block.append("\n");
	return (body.textContent ?? "")
		.replace(/[ \t]+/g, " ")
		.replace(/\n\s*\n\s*\n+/g, "\n\n")
		.trim();
};

/** The one JobPosting the page's JSON-LD describes, or null (none, several, or unreadable), as the server reads it. */
function jsonLdPosting(blocks: readonly string[], htmlToText: HtmlToText = domHtmlToText): PagePosting | null {
	const values = blocks.flatMap((block) => {
		try {
			return [JSON.parse(block) as unknown];
		} catch {
			return [];
		}
	});
	const postings = jobPostingsInJson(values);
	return postings.length === 1 && postings[0] ? toPagePosting(postings[0], htmlToText) : null;
}

/**
 * What the panel shows for a reading, merged as the server merges it (02-teknis.md §17): fields from the board's reader,
 * then JSON-LD; the description from the selection, then JSON-LD, then the page's text.
 */
export function summarizeReading(reading: PageReading, htmlToText?: HtmlToText): ReadingSummary {
	const posting = jsonLdPosting(reading.jsonLd, htmlToText);
	const fields: ReadingSummary["fields"] = {};
	const put = (name: ShownFieldName, value: string | undefined, source: FieldSource) => {
		const text = value?.trim();
		if (text && !fields[name]) fields[name] = { value: text, source };
	};

	for (const name of SHOWN_FIELDS) if (name !== "description") put(name, reading.fields[name], "site");
	put("role", posting?.role, "json-ld");
	put("company", posting?.company, "json-ld");
	put("location", posting?.location, "json-ld");
	put("validThrough", posting?.closesAt, "json-ld");
	put("description", reading.selection, "selection");
	put("description", posting?.description, "json-ld");
	put("description", reading.text, reading.textSource === "site" ? "site" : "page");

	const kind = (reading.site && reading.key) || posting ? "posting" : fields.description ? "page" : "none";
	const missing = kind === "posting" ? EXPECTED_FIELDS.filter((name) => !fields[name]) : [...EXPECTED_FIELDS];
	return { kind, fields, missing };
}
