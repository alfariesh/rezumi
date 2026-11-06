type RssItem = {
	title: string;
	url: string;
	description: string;
	publishedAt: Date;
	categories?: readonly string[];
};

export type RssChannel = {
	title: string;
	description: string;
	/** The page the feed belongs to, such as the blog's home in this language. */
	link: string;
	/** The feed's own URL, for `atom:link rel="self"`. */
	self: string;
	/** BCP 47 language of the items. */
	language: string;
	items: readonly RssItem[];
};

const XML_ESCAPES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" };

export function escapeXml(value: string): string {
	return value.replaceAll(/[&<>"']/g, (character) => XML_ESCAPES[character] ?? character);
}

/**
 * An RSS 2.0 document. `lastBuildDate` is the newest item's date rather than the time of the request, so the body only
 * changes when an article does and caches can keep it.
 */
export function renderRss(channel: RssChannel): string {
	const newest = channel.items.reduce<Date | null>(
		(latest, item) => (!latest || item.publishedAt > latest ? item.publishedAt : latest),
		null,
	);
	const items = channel.items.map(
		(item) => `		<item>
			<title>${escapeXml(item.title)}</title>
			<link>${escapeXml(item.url)}</link>
			<guid isPermaLink="true">${escapeXml(item.url)}</guid>
			<pubDate>${item.publishedAt.toUTCString()}</pubDate>
			<description>${escapeXml(item.description)}</description>${(item.categories ?? [])
				.map((category) => `\n\t\t\t<category>${escapeXml(category)}</category>`)
				.join("")}
		</item>`,
	);

	return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
	<channel>
		<title>${escapeXml(channel.title)}</title>
		<link>${escapeXml(channel.link)}</link>
		<description>${escapeXml(channel.description)}</description>
		<language>${escapeXml(channel.language)}</language>
		<atom:link href="${escapeXml(channel.self)}" rel="self" type="application/rss+xml" />${
			newest ? `\n\t\t<lastBuildDate>${newest.toUTCString()}</lastBuildDate>` : ""
		}
${items.join("\n")}
	</channel>
</rss>
`;
}
