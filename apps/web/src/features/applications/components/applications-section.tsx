import type { SectionNavItem } from "@/components/layout/section-layout";
import type { ReactNode } from "react";
import { t } from "@lingui/core/macro";
import { useQuery } from "@tanstack/react-query";
import { SectionLayout } from "@/components/layout/section-layout";
import { orpc } from "@/libs/orpc/client";

export const APPLICATION_VIEWS = ["list", "board", "insights", "calendar"] as const;
export type ApplicationView = (typeof APPLICATION_VIEWS)[number];

/** The ways to lay out the list, picked in the page's own switch. Insights is a page of the menu. */
const APPLICATION_LAYOUTS = ["list", "board", "calendar"] as const;
export type ApplicationLayout = (typeof APPLICATION_LAYOUTS)[number];

const LAYOUT_KEY = "applications-layout";

/** The layout last picked on this device; storage can be unavailable, and then it's the list. */
export function readStoredLayout(): ApplicationLayout {
	try {
		const stored = window.localStorage.getItem(LAYOUT_KEY);
		return APPLICATION_LAYOUTS.find((layout) => layout === stored) ?? "list";
	} catch {
		return "list";
	}
}

export function storeLayout(layout: ApplicationLayout) {
	try {
		window.localStorage.setItem(LAYOUT_KEY, layout);
	} catch {
		// A convenience only.
	}
}

type ApplicationsSectionProps = {
	/** The view on show, or a page of its own (Jobs, Offers). */
	view: ApplicationView | "jobs" | "offers";
	children: ReactNode;
};

/**
 * Applications as a section: All (the applications, laid out as the page's switch picks), Jobs (finding new ones),
 * Insights and Offers in the menu, the page beside it. All and Insights are one page with `?view=`, so each item says for itself whether it's
 * current.
 */
export function ApplicationsSection({ view, children }: ApplicationsSectionProps) {
	const offers = useQuery(orpc.career.savedItems.queryOptions({ input: { kind: "offer" } }));

	const items: SectionNavItem[] = [
		{
			link: { to: "/dashboard/applications" },
			match: { to: "/dashboard/applications", fuzzy: false },
			current: view !== "jobs" && view !== "offers" && view !== "insights",
			icon: "briefcase",
			label: t`All`,
		},
		{
			link: { to: "/dashboard/applications/jobs" },
			match: { to: "/dashboard/applications/jobs", fuzzy: false },
			current: view === "jobs",
			icon: "list-magnifying-glass",
			label: t({ message: "Jobs", context: "Job listings to search" }),
		},
		{
			link: { to: "/dashboard/applications", search: { view: "insights" } },
			match: { to: "/dashboard/applications", fuzzy: false },
			current: view === "insights",
			icon: "chart-line-up",
			label: t`Insights`,
		},
		{
			link: { to: "/dashboard/applications/offers" },
			match: { to: "/dashboard/applications/offers", fuzzy: false },
			current: view === "offers",
			icon: "scales",
			label: t`Offers`,
			count: offers.data?.length,
		},
	];

	return (
		<SectionLayout title={t`Applications`} items={items}>
			{children}
		</SectionLayout>
	);
}
