import type { DocsModule, DocsPageMeta } from "./types";
import { groups, loaders, pages, redirects } from "virtual:rezumi-docs";
import { DOCS_HOME, resolveDocsSlug } from "./paths";

export { groups as docsGroups };

const slugs: ReadonlySet<string> = new Set(Object.keys(pages));

/** Every page in reading order: the sidebar's, top to bottom. */
const readingOrder: DocsPageMeta[] = groups.flatMap((group) => group.slugs.flatMap((slug) => pages[slug] ?? []));

export const getDocsPage = (slug: string): DocsPageMeta | undefined => pages[slug];

/**
 * What a `/docs/…` address shows: a page, a redirect to the page an old address moved to (or `/docs` itself, for the
 * introduction), or nothing.
 */
export function matchDocsPath(splat: string): { page: DocsPageMeta } | { redirectTo: string } | undefined {
	const slug = resolveDocsSlug(splat, { slugs, redirects });
	const page = slug === undefined ? undefined : pages[slug];
	if (!page) return undefined;
	const requested = splat.replace(/^\/+|\/+$/g, "");
	return requested === page.slug && page.slug !== DOCS_HOME ? { page } : { redirectTo: page.slug };
}

/** A page's compiled content. Each page is its own chunk, fetched when it opens. */
export async function loadDocsModule(slug: string): Promise<DocsModule> {
	const load = loaders[slug];
	if (!load) throw new Error(`No docs page "${slug}"`);
	return await load();
}

/** The pages before and after this one in reading order, for the links under it. */
export function getDocsNeighbours(slug: string) {
	const index = readingOrder.findIndex((page) => page.slug === slug);
	return {
		previous: index > 0 ? readingOrder[index - 1] : undefined,
		next: index === -1 ? undefined : readingOrder[index + 1],
	};
}

/** Pages whose title, description or group contains every word of `query`. */
export function searchDocs(query: string): DocsPageMeta[] {
	const normalize = (value: string) =>
		value
			.normalize("NFKD")
			.replace(/\p{Diacritic}/gu, "")
			.toLocaleLowerCase();
	const words = normalize(query).split(/\s+/).filter(Boolean);
	if (words.length === 0) return readingOrder;
	return readingOrder.filter((page) => {
		const text = normalize(`${page.title} ${page.group} ${page.description}`);
		return words.every((word) => text.includes(word));
	});
}
