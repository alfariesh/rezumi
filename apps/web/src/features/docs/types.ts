import type { ComponentType } from "react";

/** A heading the table of contents lists: the page's `h2`s and the `h3`s under them. */
export type DocsTocEntry = { depth: 2 | 3; id: string; title: string };

/** A page as the sidebar, search and page footer know it, without its content. */
export type DocsPageMeta = { slug: string; title: string; description: string; group: string };

/** A sidebar group: its title and its pages in reading order. */
export type DocsGroup = { title: string; slugs: string[] };

// MDX hands each element its own props; the map accepts any component.
// oxlint-disable-next-line typescript/no-explicit-any -- the MDX runtime's own type for this map is this loose
export type DocsComponents = Record<string, ComponentType<any>>;

/** A compiled page (`docs/**\/*.mdx`, through `./build.ts`). */
export type DocsModule = {
	default: ComponentType<{ components?: DocsComponents }>;
	frontmatter: { title: string; description?: string };
	toc: DocsTocEntry[];
};
