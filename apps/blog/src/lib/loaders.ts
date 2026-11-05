/**
 * What each page shows, read from EmDash. A route file calls its loader and turns `not-found` and `redirect` into a
 * response, which only pages can do; the view then renders `props`. Every loader passes its queries' cache hints to
 * the route cache, so a publish purges the pages that show the entry.
 */

import type { LocaleLinks } from "../components/LanguageSwitcher.astro";
import type { Locale } from "../i18n/config";
import type { CtaKind } from "./cta";
import type { PostEntry } from "./entries";
import type { HeadingAnchor } from "./portable-text";
import type { BlogSettings } from "./site-settings";
import type { AstroGlobal } from "astro";
import type { CacheHint, SeoMeta, TaxonomyTerm } from "emdash";
import {
	decodeSlug,
	getEditMeta,
	getEmDashCollection,
	getEmDashEntry,
	getSeoMeta,
	getTaxonomyTermsWithCacheHint,
	getTerm,
	getTranslations,
	search,
} from "emdash";
import { defaultLocale, isLocale, locales } from "../i18n/config";
import { resolveCta } from "./cta";
import { bylineNames } from "./entries";
import { imageUrl } from "./media";
import { categoryPath, homePath, postPath, tagPath } from "./paths";
import { anchorHeadings, readingMinutes } from "./portable-text";
import { SITE_URL } from "./site";
import { loadSettings } from "./site-settings";

export type LoadResult<P> = { type: "ok"; props: P } | { type: "not-found" } | { type: "redirect"; location: string };

const PAGE_SIZE = 12;
const RELATED_COUNT = 3;
/** Search queries are cut to this length; longer input is noise for full-text search. */
const MAX_QUERY_LENGTH = 100;

function cache(Astro: AstroGlobal, ...hints: CacheHint[]) {
	if (!Astro.cache?.enabled) return;
	for (const hint of hints) Astro.cache.set(hint);
}

function cursorParam(Astro: AstroGlobal): string | undefined {
	return Astro.url.searchParams.get("cursor") || undefined;
}

function listPosts(
	locale: Locale,
	options: { limit: number; cursor?: string | undefined; where?: Record<string, string> },
) {
	return getEmDashCollection("posts", {
		locale,
		orderBy: { published_at: "desc" },
		limit: options.limit,
		...(options.cursor ? { cursor: options.cursor } : {}),
		...(options.where ? { where: options.where } : {}),
	});
}

/** A term tree flattened, parents first. */
function flattenTerms(terms: readonly TaxonomyTerm[]): TaxonomyTerm[] {
	return terms.flatMap((term) => [term, ...flattenTerms(term.children ?? [])]);
}

// ---------------------------------------------------------------------------------------------------------------
// Home

export type HomeProps = {
	locale: Locale;
	settings: BlogSettings;
	posts: PostEntry[];
	nextCursor: string | undefined;
	isPaged: boolean;
};

export async function loadHome(Astro: AstroGlobal, locale: Locale): Promise<LoadResult<HomeProps>> {
	const cursor = cursorParam(Astro);
	const [settings, posts] = await Promise.all([
		loadSettings(),
		// The first page leads with one article above a full grid.
		listPosts(locale, { limit: cursor ? PAGE_SIZE : PAGE_SIZE + 1, cursor }),
	]);
	// A cursor that no longer parses (edited by hand, or from an old link) falls back to the first page.
	if (posts.error && cursor) return { type: "redirect", location: homePath(locale) };
	if (posts.error) throw posts.error;
	cache(Astro, posts.cacheHint);

	return {
		type: "ok",
		props: { locale, settings, posts: posts.entries, nextCursor: posts.nextCursor, isPaged: Boolean(cursor) },
	};
}

// ---------------------------------------------------------------------------------------------------------------
// Article

export type PostProps = {
	locale: Locale;
	settings: BlogSettings;
	post: PostEntry;
	slug: string;
	seo: SeoMeta;
	/** The body to render: heading blocks carry their anchor, unless the page is in visual-editing mode. */
	content: PostEntry["data"]["content"];
	headings: HeadingAnchor[];
	readingMinutes: number;
	authors: string[];
	topic: TaxonomyTerm | undefined;
	tags: TaxonomyTerm[];
	related: PostEntry[];
	cta: CtaKind | null;
	localeLinks: LocaleLinks;
	isPreview: boolean;
};

export async function loadPost(Astro: AstroGlobal, locale: Locale): Promise<LoadResult<PostProps>> {
	const slug = decodeSlug(Astro.params.slug);
	if (!slug) return { type: "not-found" };

	const [settings, result] = await Promise.all([loadSettings(), getEmDashEntry("posts", slug, { locale })]);
	if (result.error) throw result.error;
	const post = result.entry;
	if (!post) return { type: "not-found" };
	// Not translated yet: EmDash fell back to another language, so send the reader to that article's own address.
	if (result.fallbackLocale && result.fallbackLocale !== locale && isLocale(result.fallbackLocale)) {
		return { type: "redirect", location: postPath(result.fallbackLocale, slug) };
	}
	cache(Astro, result.cacheHint);

	const topic = post.data.terms?.category?.[0];
	const tags = post.data.terms?.tag ?? [];
	const [translations, related] = await Promise.all([
		getTranslations("posts", post.data.id),
		loadRelated(Astro, locale, post, topic),
	]);

	const localeLinks: LocaleLinks = {};
	for (const translation of translations.translations) {
		if (translation.status === "published" && translation.slug && isLocale(translation.locale)) {
			localeLinks[translation.locale] = postPath(translation.locale, translation.slug);
		}
	}
	const source = translations.translations.find(
		(translation) => translation.locale === defaultLocale && translation.status === "published",
	);
	const authors = await loadAuthors(Astro, locale, post, source?.slug ?? undefined);

	const path = postPath(locale, slug);
	const featuredImage = imageUrl(post.data.featured_image);
	const seo = getSeoMeta(post, {
		siteTitle: settings.siteTitle,
		siteUrl: SITE_URL,
		titleSeparator: settings.titleSeparator,
		path,
		...(featuredImage ? { defaultOgImage: featuredImage } : {}),
	});

	// Visual editing renders the body in an inline editor that needs the queried value as it is.
	const editing = getEditMeta(post.data.content) !== undefined;
	const anchored = anchorHeadings(post.data.content ?? []);

	return {
		type: "ok",
		props: {
			locale,
			settings,
			post,
			slug,
			seo,
			content: editing ? post.data.content : anchored.blocks,
			headings: anchored.headings,
			readingMinutes: readingMinutes(post.data.content),
			authors,
			topic,
			tags,
			related,
			cta: resolveCta(post.data.cta),
			localeLinks,
			isPreview: result.isPreview,
		},
	};
}

/**
 * The article's credits. A byline is shown only in the languages it has a version in, so a translation whose bylines
 * were never translated would lose its credit; it borrows the default-language article's instead.
 */
async function loadAuthors(
	Astro: AstroGlobal,
	locale: Locale,
	post: PostEntry,
	sourceSlug: string | undefined,
): Promise<string[]> {
	const names = bylineNames(post);
	if (names.length > 0 || locale === defaultLocale || !sourceSlug) return names;
	const source = await getEmDashEntry("posts", sourceSlug, { locale: defaultLocale });
	if (!source.entry) return names;
	cache(Astro, source.cacheHint);
	return bylineNames(source.entry);
}

/** Articles to read next: the same topic first, topped up with the latest. */
async function loadRelated(
	Astro: AstroGlobal,
	locale: Locale,
	post: PostEntry,
	topic: TaxonomyTerm | undefined,
): Promise<PostEntry[]> {
	const others = (entries: PostEntry[]) => entries.filter((entry) => entry.data.id !== post.data.id);
	const sameTopic = topic
		? await listPosts(locale, { limit: RELATED_COUNT + 1, where: { category: topic.slug } })
		: null;
	const picked = sameTopic && !sameTopic.error ? others(sameTopic.entries).slice(0, RELATED_COUNT) : [];
	if (sameTopic && !sameTopic.error) cache(Astro, sameTopic.cacheHint);
	if (picked.length >= RELATED_COUNT) return picked;

	const latest = await listPosts(locale, { limit: RELATED_COUNT * 2 + 1 });
	if (latest.error) return picked;
	cache(Astro, latest.cacheHint);
	const seen = new Set(picked.map((entry) => entry.data.id));
	return [...picked, ...others(latest.entries).filter((entry) => !seen.has(entry.data.id))].slice(0, RELATED_COUNT);
}

// ---------------------------------------------------------------------------------------------------------------
// Topic and tag archives

export type TermTaxonomy = "category" | "tag";

export type TermProps = {
	locale: Locale;
	settings: BlogSettings;
	taxonomy: TermTaxonomy;
	term: TaxonomyTerm;
	posts: PostEntry[];
	nextCursor: string | undefined;
	isPaged: boolean;
	localeLinks: LocaleLinks;
};

export const termPath = (taxonomy: TermTaxonomy, locale: Locale, slug: string) =>
	taxonomy === "category" ? categoryPath(locale, slug) : tagPath(locale, slug);

export async function loadTerm(
	Astro: AstroGlobal,
	locale: Locale,
	taxonomy: TermTaxonomy,
): Promise<LoadResult<TermProps>> {
	const slug = decodeSlug(Astro.params.slug);
	if (!slug) return { type: "not-found" };

	const [settings, term, termsByLocale] = await Promise.all([
		loadSettings(),
		getTerm(taxonomy, slug, { locale, includeCounts: false }),
		Promise.all(
			locales.map(
				async (other) =>
					[other, await getTaxonomyTermsWithCacheHint(taxonomy, { locale: other, includeCounts: false })] as const,
			),
		),
	]);
	if (!term) return { type: "not-found" };

	// The translation of each term shares its group; find this term's address in every language.
	const localeLinks: LocaleLinks = {};
	for (const [other, terms] of termsByLocale) {
		cache(Astro, terms.cacheHint);
		const match = flattenTerms(terms.data).find((candidate) =>
			term.translationGroup ? candidate.translationGroup === term.translationGroup : candidate.id === term.id,
		);
		if (match) localeLinks[other] = termPath(taxonomy, other, match.slug);
	}

	// A slug from another language (the fallback chain found it there): go to this language's version, or that one.
	if (term.locale !== locale) {
		const location = localeLinks[locale] ?? (isLocale(term.locale) ? termPath(taxonomy, term.locale, term.slug) : null);
		return location ? { type: "redirect", location } : { type: "not-found" };
	}

	const cursor = cursorParam(Astro);
	const posts = await listPosts(locale, { limit: PAGE_SIZE, cursor, where: { [taxonomy]: term.slug } });
	if (posts.error && cursor) return { type: "redirect", location: termPath(taxonomy, locale, term.slug) };
	if (posts.error) throw posts.error;
	cache(Astro, posts.cacheHint);

	return {
		type: "ok",
		props: {
			locale,
			settings,
			taxonomy,
			term,
			posts: posts.entries,
			nextCursor: posts.nextCursor,
			isPaged: Boolean(cursor),
			localeLinks,
		},
	};
}

// ---------------------------------------------------------------------------------------------------------------
// Search

type SearchHit = { title: string; path: string; snippetHtml: string | undefined };

export type SearchProps = {
	locale: Locale;
	settings: BlogSettings;
	query: string;
	hits: SearchHit[];
};

export async function loadSearch(Astro: AstroGlobal, locale: Locale): Promise<LoadResult<SearchProps>> {
	const query = (Astro.url.searchParams.get("q") ?? "").trim().slice(0, MAX_QUERY_LENGTH);
	const [settings, results] = await Promise.all([
		loadSettings(),
		query ? search(query, { collections: ["posts"], locale, limit: 20 }) : null,
	]);

	const hits = (results?.items ?? []).flatMap((item) =>
		item.slug
			? [
					{
						title: item.title ?? item.slug,
						path: postPath(locale, item.slug),
						// Sanitized by EmDash: the source text is escaped and only <mark> is added around matches.
						snippetHtml: item.snippet,
					},
				]
			: [],
	);

	return { type: "ok", props: { locale, settings, query, hits } };
}
