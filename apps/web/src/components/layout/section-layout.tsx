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
	/** Shown in place of `count` when the hint needs more than a number: a countdown, a coloured chip. */
	badge?: ReactNode;
	/** Starts a new group: a hairline above this item. The text only names the group in code. */
	group?: string | undefined;
	/**
	 * Overrides `match` when the address alone can't tell: items that differ only by search (Documents › Resumes is
	 * `?type=resume`).
	 */
	current?: boolean | undefined;
};

type SectionLayoutProps = {
	/** The section's name, for its menu's accessible name: "Profile", "Settings". The breadcrumb shows it. */
	title: string;
	items: SectionNavItem[];
	/** Under the menu on wide screens: small print such as the version and legal links. */
	footer?: ReactNode;
	/** The current page: its own `PageHeader` first, then its content. */
	children: ReactNode;
};

/**
 * A section of the dashboard with pages or views of its own (Profile, Settings, Documents, Applications, an
 * application's workspace): the section's menu on the left and the current page on the right. On phones the menu
 * becomes a row of chips over the page. Each page renders its own `PageHeader`, which names the page, so the menu shows no
 * heading of its own; groups are set apart by a hairline.
 */
export function SectionLayout({ title, items, footer, children }: SectionLayoutProps) {
	return (
		<Page className="md:grid md:grid-cols-[13.5rem_minmax(0,1fr)] md:items-start md:gap-x-8 lg:gap-x-12">
			<SectionNav title={title} items={items} footer={footer} />
			{/* One column for the page: its header and everything under it share the same width on every section. */}
			<div className="flex min-w-0 flex-col gap-5 max-md:mt-5">{children}</div>
		</Page>
	);
}

type SectionNavProps = {
	title: string;
	items: SectionNavItem[];
	footer?: ReactNode;
};

/**
 * The menu: a list on wide screens, sticky, starting on the app sidebar's first row; a row of chips on phones.
 */
function SectionNav({ title, items, footer }: SectionNavProps) {
	const matchRoute = useMatchRoute();
	const isCurrent = (item: SectionNavItem) =>
		item.current ?? Boolean(matchRoute({ to: item.match.to, fuzzy: item.match.fuzzy }));

	return (
		// Named for the page transition: moving between the section's pages keeps the menu in place (index.css).
		<nav
			aria-label={title}
			// Sticky where it starts: its first row, the page's title and the app sidebar's first row share a line.
			className="[view-transition-name:section-nav] md:sticky md:top-[3.75rem] md:grid md:max-h-[calc(100svh-6rem)] md:content-start md:gap-4 md:overflow-y-auto"
		>
			<ul className="grid gap-0.5 max-md:hidden">
				{items.map((item) => (
					<Fragment key={item.match.to + item.label}>
						{item.group && <li aria-hidden className="mx-2.5 my-2 h-px bg-separator first:hidden" />}
						<li>
							<SectionLink item={item} current={isCurrent(item)} />
						</li>
					</Fragment>
				))}
			</ul>

			{/* Phones: the same pages as chips, scrolled sideways when they don't fit. */}
			<ul className="-mx-4 scrollbar-none flex gap-1.5 overflow-x-auto px-4 md:hidden">
				{items.map((item) => (
					<li key={item.match.to + item.label} className="shrink-0">
						<SectionChip item={item} current={isCurrent(item)} />
					</li>
				))}
			</ul>

			{footer && <div className="px-2.5 text-body-xs text-muted max-md:hidden">{footer}</div>}
		</nav>
	);
}

type SectionLinkProps = { item: SectionNavItem; current: boolean };

/**
 * TanStack marks a link it finds active (`aria-current`, after the props), so it may only find the one `current`
 * finds: an exact match, search included. Documents' All, Resumes and Letters share one address and differ by `?type=`.
 */
const ACTIVE_OPTIONS = { exact: true, includeSearch: true } as const;

/** One row of the wide-screen menu. */
function SectionLink({ item, current }: SectionLinkProps) {
	return (
		<Link
			{...item.link}
			activeOptions={ACTIVE_OPTIONS}
			aria-current={current ? "page" : undefined}
			className={cn(
				"flex h-9 items-center gap-2.5 rounded-xl px-2.5 text-sm font-medium transition-colors duration-quick ease-enter outline-none focus-visible:ring-2 focus-visible:ring-focus",
				current ? "bg-default text-foreground" : "text-muted hover:bg-default/60 hover:text-foreground",
			)}
		>
			<Icon name={item.icon} size={18} variant={current ? "duotone" : "stroke"} className="shrink-0" />
			<span className="min-w-0 flex-1 truncate">{item.label}</span>
			{item.badge ??
				(item.count !== undefined && <span className="text-body-xs text-muted tabular-nums">{item.count}</span>)}
		</Link>
	);
}

/** One chip of the phone menu. */
function SectionChip({ item, current }: SectionLinkProps) {
	return (
		<Link
			{...item.link}
			activeOptions={ACTIVE_OPTIONS}
			aria-current={current ? "page" : undefined}
			className={cn(
				"flex h-9 items-center gap-1.5 rounded-full px-3.5 text-sm font-medium whitespace-nowrap transition-colors duration-quick ease-enter outline-none focus-visible:ring-2 focus-visible:ring-focus",
				current ? "bg-default text-foreground" : "text-muted hover:text-foreground",
			)}
		>
			<Icon name={item.icon} size={16} variant={current ? "duotone" : "stroke"} />
			{item.label}
			{item.badge ??
				(item.count !== undefined && <span className="text-body-xs text-muted tabular-nums">{item.count}</span>)}
		</Link>
	);
}
