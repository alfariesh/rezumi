import type { DocsModule, DocsPageMeta } from "./types";
import { buttonVariants, Skeleton, Typography } from "@heroui/react";
import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { Link } from "@tanstack/react-router";
import { Icon } from "@rezumi/ui/components/icon";
import { cn } from "@rezumi/utils/style";
import { getDocsNeighbours } from "./content";
import { DocsLink } from "./link";
import { docsComponents } from "./mdx-components";
import { docsPath } from "./paths";
import { DocsToc, DocsTocDisclosure } from "./toc";
import { renderAsH1 } from "@/libs/typography";

type PagerLinkProps = { page: DocsPageMeta; direction: "previous" | "next" };

function PagerLink({ page, direction }: PagerLinkProps) {
	const next = direction === "next";
	return (
		<DocsLink
			href={docsPath(page.slug)}
			rel={direction}
			className={cn(
				"group/pager flex flex-col gap-1 rounded-2xl bg-surface p-4 shadow-surface hover:bg-surface-secondary",
				next && "items-end text-end sm:col-start-2",
			)}
		>
			<span className="flex items-center gap-1.5 text-xs font-medium text-muted">
				{!next && <Icon name="arrow-left" size={14} />}
				{next ? t`Next` : t`Previous`}
				{next && <Icon name="arrow-right" size={14} />}
			</span>
			<span className="text-sm font-semibold text-foreground">{page.title}</span>
		</DocsLink>
	);
}

type DocsArticleProps = { page: DocsPageMeta; module: DocsModule };

/** One page: its title and summary, the content, the pages before and after it, and its sections beside it. */
export function DocsArticle({ page, module }: DocsArticleProps) {
	const { default: Content, toc } = module;
	const { previous, next } = getDocsNeighbours(page.slug);

	return (
		<div className="flex justify-center gap-12 px-4 pt-6 pb-20 sm:px-8 lg:pt-10 xl:ps-10">
			<article className="w-full max-w-3xl min-w-0">
				<header className="pb-8">
					<p className="text-sm font-medium text-accent">{page.group}</p>
					<Typography type="h2" render={renderAsH1} className="mt-2 text-balance">
						{page.title}
					</Typography>
					{page.description && <p className="mt-3 text-lg text-pretty text-muted">{page.description}</p>}
				</header>

				{toc.length > 0 && (
					<div className="mb-8 xl:hidden">
						<DocsTocDisclosure entries={toc} />
					</div>
				)}

				<div className="docs-flow text-base leading-7">
					<Content components={docsComponents} />
				</div>

				{(previous ?? next) && (
					<nav aria-label={t`More pages`} className="mt-16 grid gap-4 sm:grid-cols-2">
						{previous && <PagerLink page={previous} direction="previous" />}
						{next && <PagerLink page={next} direction="next" />}
					</nav>
				)}
			</article>

			<aside className="hidden w-56 shrink-0 xl:block">
				<div className="sticky top-24 max-h-[calc(100dvh-8rem)] overflow-y-auto pb-4">
					<DocsToc entries={toc} />
				</div>
			</aside>
		</div>
	);
}

/** While a page's chunk downloads: the title and a few lines where they will be. */
export function DocsArticlePending() {
	return (
		<div className="flex justify-center px-4 pt-6 pb-20 sm:px-8 lg:pt-10 xl:justify-start xl:ps-10">
			<div className="grid w-full max-w-3xl gap-3" aria-busy="true">
				<Skeleton className="h-5 w-28 rounded-lg" />
				<Skeleton className="h-9 w-2/3 rounded-lg" />
				<Skeleton className="mb-6 h-6 w-full rounded-lg" />
				{["w-full", "w-11/12", "w-4/5", "w-full", "w-3/4"].map((width, index) => (
					<Skeleton key={index} className={cn("h-4 rounded-lg", width)} />
				))}
			</div>
		</div>
	);
}

/** An address under /docs with no page. */
export function DocsNotFound() {
	return (
		<div className="mx-auto flex max-w-md flex-col items-center px-4 py-24 text-center">
			<span className="grid size-12 place-items-center rounded-2xl bg-surface text-muted shadow-surface">
				<Icon name="book-open" size={24} />
			</span>
			<Typography type="h4" render={renderAsH1} className="mt-5">
				<Trans>Page not found</Trans>
			</Typography>
			<p className="mt-2 text-sm text-pretty text-muted">
				<Trans>This page may have moved. Search the list of pages, or start from the introduction.</Trans>
			</p>
			<Link to="/docs" className={cn(buttonVariants({ variant: "secondary" }), "mt-6")}>
				<Trans>Go to the introduction</Trans>
			</Link>
		</div>
	);
}
