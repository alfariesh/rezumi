import type { IconName } from "@rezumi/ui/components/icon";
import type { LinkOptions } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Link, useMatchRoute } from "@tanstack/react-router";
import { Fragment } from "react";
import { Icon } from "@rezumi/ui/components/icon";
import { cn } from "@rezumi/utils/style";
import { Page } from "./page";

export type SectionNavItem = {
	/** Where the item goes: `to`, plus `params` and `search` when the route needs them. */
	link: LinkOptions;
	/**
	 * The address that marks the item current. `fuzzy` also counts the pages under it (Stories › one story); the
	 * section's own address uses `fuzzy: false` so it isn't current on every page of the section.
	 */
	match: { to: string; fuzzy: boolean };
	icon: IconName;
	label: string;
	/** A number after the label: what the page holds. Hidden while unknown. */
	count?: number | undefined;
	/** Starts a new group under this heading; the items after it belong to it until the next heading. */
	group?: string | undefined;
	/**
	 * Overrides `match` when the address alone can't tell: items that differ only by search (Documents › Resumes is
	 * `?type=resume`).
	 */
	current?: boolean | undefined;
};

type SectionLayoutProps = {
	/** The section's name over its menu: "Profile", "Settings". */
	title: string;
	items: SectionNavItem[];
	/**
	 * How wide the content may grow: `narrow` (720px) for forms and settings, `full` for lists, grids and boards.
	 * Defaults to `full`.
	 */
	contentWidth?: "narrow" | "full";
	/** Under the menu on wide screens: small print such as the version and legal links. */
	footer?: ReactNode;
	/** The current page: its own `PageHeader` first, then its content. */
	children: ReactNode;
};

/**
 * A section of the dashboard with pages of its own (Profile, Settings, Documents): the section's menu on the left and
 * the current page on the right, as the editors lay out their panel beside the canvas. On phones the menu becomes a
 * row of chips over the page. Each page renders its own `PageHeader`; the menu is not a tab bar, and views of the same
 * data (board, list, calendar) stay a `Segment` inside the page.
 */
export function SectionLayout({ title, items, contentWidth = "full", footer, children }: SectionLayoutProps) {
	return (
		<Page className="md:grid md:grid-cols-[13.5rem_minmax(0,1fr)] md:items-start md:gap-x-8 lg:gap-x-12">
			<SectionNav title={title} items={items} footer={footer} />
			<div
				className={cn("flex min-w-0 flex-col gap-5 max-md:mt-5", contentWidth === "narrow" && "w-full max-w-[720px]")}
			>
				{children}
			</div>
		</Page>
	);
}

type SectionNavProps = {
	title: string;
	items: SectionNavItem[];
	footer?: ReactNode;
	/** Shows the title over the menu on wide screens; off where the page already names the section above it. */
	showTitle?: boolean;
	className?: string;
};

/**
 * The section's menu on its own, for a page with its own layout (an application's workspace): a list on wide screens,
 * a row of chips on phones. Place it in the left column of a `md:grid-cols-[13.5rem_minmax(0,1fr)]` grid.
 */
export function SectionNav({ title, items, footer, showTitle = true, className }: SectionNavProps) {
	const matchRoute = useMatchRoute();
	const isCurrent = (item: SectionNavItem) =>
		item.current ?? Boolean(matchRoute({ to: item.match.to, fuzzy: item.match.fuzzy }));

	return (
		// Named for the page transition: moving between the section's pages keeps the menu in place (index.css).
		<nav
			aria-label={title}
			className={cn(
				"[view-transition-name:section-nav] md:sticky md:top-20 md:grid md:max-h-[calc(100svh-6rem)] md:content-start md:gap-4 md:overflow-y-auto",
				className,
			)}
		>
			{showTitle && <p className="px-2.5 text-lg font-semibold max-md:hidden">{title}</p>}

			<ul className="grid gap-0.5 max-md:hidden">
				{items.map((item) => (
					<Fragment key={item.match.to + String(item.label)}>
						{item.group && (
							<li aria-hidden className="px-2.5 pt-4 pb-1 text-body-xs font-medium text-muted first:pt-0">
								{item.group}
							</li>
						)}
						<li>
							<SectionLink item={item} current={isCurrent(item)} />
						</li>
					</Fragment>
				))}
			</ul>

			{/* Phones: the same pages as chips, scrolled sideways when they don't fit. */}
			<ul className="-mx-4 scrollbar-none flex gap-1.5 overflow-x-auto px-4 md:hidden">
				{items.map((item) => (
					<li key={item.match.to + String(item.label)} className="shrink-0">
						<SectionChip item={item} current={isCurrent(item)} />
					</li>
				))}
			</ul>

			{footer && <div className="px-2.5 text-body-xs text-muted max-md:hidden">{footer}</div>}
		</nav>
	);
}

type SectionLinkProps = { item: SectionNavItem; current: boolean };

/** One row of the wide-screen menu. Its own match marks it current; TanStack's exact match only adds the same state. */
function SectionLink({ item, current }: SectionLinkProps) {
	return (
		<Link
			{...item.link}
			activeOptions={{ exact: true, includeSearch: false }}
			aria-current={current ? "page" : undefined}
			className={cn(
				"flex h-9 items-center gap-2.5 rounded-xl px-2.5 text-sm font-medium transition-colors duration-quick ease-enter outline-none focus-visible:ring-2 focus-visible:ring-focus",
				current ? "bg-default text-foreground" : "text-muted hover:bg-default/60 hover:text-foreground",
			)}
		>
			<Icon name={item.icon} size={18} variant={current ? "duotone" : "stroke"} className="shrink-0" />
			<span className="min-w-0 flex-1 truncate">{item.label}</span>
			{item.count !== undefined && <span className="text-body-xs text-muted tabular-nums">{item.count}</span>}
		</Link>
	);
}

/** One chip of the phone menu. */
function SectionChip({ item, current }: SectionLinkProps) {
	return (
		<Link
			{...item.link}
			activeOptions={{ exact: true, includeSearch: false }}
			aria-current={current ? "page" : undefined}
			className={cn(
				"flex h-9 items-center gap-1.5 rounded-full px-3.5 text-sm font-medium whitespace-nowrap transition-colors duration-quick ease-enter outline-none focus-visible:ring-2 focus-visible:ring-focus",
				current ? "bg-default text-foreground" : "text-muted hover:text-foreground",
			)}
		>
			<Icon name={item.icon} size={16} variant={current ? "duotone" : "stroke"} />
			{item.label}
			{item.count !== undefined && <span className="text-body-xs text-muted tabular-nums">{item.count}</span>}
		</Link>
	);
}
