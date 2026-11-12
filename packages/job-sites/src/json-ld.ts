/**
 * Reading schema.org `JobPosting` data (the JSON-LD job boards publish for Google for Jobs) without any AI. Shared by
 * the server, which reads fetched HTML, and the browser extension, which reads the JSON-LD blocks of the open page.
 *
 * HTML-to-text conversion differs per runtime (sanitize-html on the server, the DOM in the extension), so callers pass
 * their own `htmlToText`.
 */

/** Turns an HTML fragment into plain text, one line per block. */
export type HtmlToText = (html: string) => string;

export type PagePosting = {
	role: string;
	company: string;
	location: string;
	description: string;
	/** When the employer stops taking applications (ISO), or "". */
	closesAt: string;
};

const asText = (value: unknown): string => (typeof value === "string" ? value.trim() : "");

function readLocation(value: unknown): string {
	const place = (Array.isArray(value) ? value[0] : value) as { address?: Record<string, unknown> } | undefined;
	const address = place?.address;
	if (!address || typeof address !== "object") return "";
	return (
		[address.addressLocality, address.addressRegion, address.addressCountry]
			.map((part) => (typeof part === "object" && part ? asText((part as { name?: unknown }).name) : asText(part)))
			// "State not Applicable" and the like are placeholders, not places.
			.filter((part) => part && !/not applicable|^n\/?a$/i.test(part))
			.join(", ")
	);
}

/**
 * Every JobPosting in already-parsed JSON-LD values (an object, an array of objects, or a `@graph`), the same posting
 * published twice (an SEO plugin beside the tracking system's own) counted once.
 */
export function jobPostingsInJson(values: readonly unknown[]): Record<string, unknown>[] {
	const postings: Record<string, unknown>[] = [];
	for (const json of values) {
		const graph = (json as { "@graph"?: unknown } | null)?.["@graph"];
		const candidates = [json, ...(Array.isArray(json) ? json : []), ...(Array.isArray(graph) ? graph : [])];
		for (const item of candidates) {
			const type = (item as { "@type"?: unknown } | null)?.["@type"];
			if (type === "JobPosting" || (Array.isArray(type) && type.includes("JobPosting")))
				postings.push(item as Record<string, unknown>);
		}
	}
	return [
		...new Map(
			postings.map((item) => [`${asText(item.title)}|${JSON.stringify(item.hiringOrganization)}`, item]),
		).values(),
	];
}

/**
 * Every JobPosting a page describes in its JSON-LD (most job boards publish one per posting). Openers are matched with
 * bounded attributes and each body is found with indexOf, so a hostile page can't make the scan quadratic.
 */
export function jobPostingsIn(html: string): Record<string, unknown>[] {
	const values: unknown[] = [];
	const lower = html.toLowerCase();
	const opener = /<script[^<>]{0,500}type=["']application\/ld\+json["'][^<>]{0,500}>/gi;
	let match: RegExpExecArray | null;
	while ((match = opener.exec(html))) {
		const start = match.index + match[0].length;
		const end = lower.indexOf("</script>", start);
		if (end === -1) break;
		opener.lastIndex = end + "</script>".length;
		try {
			values.push(JSON.parse(html.slice(start, end)));
		} catch {
			continue;
		}
	}
	return jobPostingsInJson(values);
}

/** Some boards escape the description's HTML ("&lt;p&gt;"), so the first pass leaves tags behind. */
const richText = (html: string, htmlToText: HtmlToText) => {
	const text = htmlToText(html);
	return /<\/?[a-z][^<>]*>/i.test(text) ? htmlToText(text) : text;
};

/** One JobPosting's title, hiring organisation, location, description (as text) and closing date. */
export function toPagePosting(posting: Record<string, unknown>, htmlToText: HtmlToText): PagePosting {
	const organization = posting.hiringOrganization as { name?: unknown } | string | undefined;
	const remote = asText(posting.jobLocationType).toUpperCase() === "TELECOMMUTE";
	return {
		role: asText(posting.title),
		company: typeof organization === "string" ? organization.trim() : asText(organization?.name),
		location: [readLocation(posting.jobLocation), remote ? "Remote" : ""].filter(Boolean).join(" · "),
		description: richText(asText(posting.description), htmlToText),
		closesAt: asText(posting.validThrough),
	};
}

/**
 * The JobPosting a page describes in its JSON-LD, read without any AI: title, hiring organisation, location and the
 * description as text. Null when the page describes none, or several (a list is not one posting).
 */
export function readJobPosting(html: string, htmlToText: HtmlToText): PagePosting | null {
	const postings = jobPostingsIn(html);
	return postings.length === 1 && postings[0] ? toPagePosting(postings[0], htmlToText) : null;
}
