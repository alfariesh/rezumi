import { SearchField } from "@heroui/react";
import { t } from "@lingui/core/macro";
import { useState } from "react";
import { cn } from "@rezumi/utils/style";
import { docsGroups, getDocsPage, searchDocs } from "./content";
import { DocsLink } from "./link";
import { docsPath } from "./paths";

type DocsSidebarProps = {
	/** The page open now. */
	slug: string;
	/** Beside the page on the desk, or in the menu drawer, a white surface. */
	placement: "aside" | "drawer";
	/** Called after a page is chosen, so the drawer can close. */
	onNavigate?: () => void;
};

/** Every page by group, with a search that narrows the list to pages whose title or summary match. */
export function DocsSidebar({ slug, placement, onNavigate }: DocsSidebarProps) {
	const inDrawer = placement === "drawer";
	const [query, setQuery] = useState("");
	const term = query.trim();
	const filtering = term !== "";
	const matches = new Set(searchDocs(query).map((page) => page.slug));

	return (
		<div className="flex min-h-0 flex-1 flex-col">
			<div className={inDrawer ? "pb-4" : "px-6 pt-6 pb-4"}>
				<SearchField
					value={query}
					onChange={setQuery}
					aria-label={t`Search the docs`}
					variant={inDrawer ? "secondary" : "primary"}
				>
					<SearchField.Group>
						<SearchField.SearchIcon />
						<SearchField.Input placeholder={t`Search the docs`} />
						<SearchField.ClearButton />
					</SearchField.Group>
				</SearchField>
			</div>

			<nav
				aria-label={t`Documentation`}
				className={cn("min-h-0 flex-1 overflow-y-auto overscroll-contain", inDrawer ? "-mx-3" : "px-4 pb-8")}
			>
				{docsGroups.map((group) => {
					const slugs = filtering ? group.slugs.filter((page) => matches.has(page)) : group.slugs;
					if (slugs.length === 0) return null;
					return (
						<section key={group.title} className="mt-6 first:mt-0">
							<h2 className="mb-1 px-3 text-xs font-semibold text-muted">{group.title}</h2>
							<ul className="grid gap-px">
								{slugs.map((page) => {
									const current = page === slug;
									return (
										<li key={page}>
											<DocsLink
												href={docsPath(page)}
												aria-current={current ? "page" : undefined}
												onClick={onNavigate}
												className={cn(
													"block rounded-lg px-3 py-1.5 text-sm text-muted hover:bg-default hover:text-foreground",
													current && "bg-default font-medium text-foreground",
												)}
											>
												{getDocsPage(page)?.title}
											</DocsLink>
										</li>
									);
								})}
							</ul>
						</section>
					);
				})}
				{filtering && matches.size === 0 && (
					<p role="status" className="px-3 text-body-sm text-pretty text-muted">
						{t`No pages match “${term}”.`}
					</p>
				)}
			</nav>
		</div>
	);
}
