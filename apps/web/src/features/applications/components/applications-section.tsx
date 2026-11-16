import type { SectionNavItem } from "@/components/layout/section-layout";
import type { ReactNode } from "react";
import { t } from "@lingui/core/macro";
import { useQuery } from "@tanstack/react-query";
import { useBreakpoint } from "@rezumi/ui/hooks/use-breakpoint";
import { SectionLayout } from "@/components/layout/section-layout";
import { orpc } from "@/libs/orpc/client";

export const APPLICATION_VIEWS = ["list", "board", "insights", "calendar"] as const;
export type ApplicationView = (typeof APPLICATION_VIEWS)[number];

type ApplicationsSectionProps = {
	/** The view on show, or null on a page of its own (Offers). */
	view: ApplicationView | null;
	children: ReactNode;
};

/**
 * Applications as a section: the views of the list (List, Board, Insights, Calendar) and Offers in the menu, the page
 * in the card. The views are one page with `?view=`, so each item says for itself whether it's current. Phones have no
 * room for the board or the calendar, so their items are left out there.
 */
export function ApplicationsSection({ view, children }: ApplicationsSectionProps) {
	const phone = useBreakpoint() === "mobile";
	const offers = useQuery(orpc.career.savedItems.queryOptions({ input: { kind: "offer" } }));

	const viewItem = (value: ApplicationView, icon: SectionNavItem["icon"], label: string): SectionNavItem => ({
		link: { to: "/dashboard/applications", search: { view: value } },
		match: { to: "/dashboard/applications", fuzzy: false },
		current: view === value,
		icon,
		label,
	});

	const items: SectionNavItem[] = [
		viewItem("list", "rows", t`List`),
		...(phone ? [] : [viewItem("board", "kanban", t`Board`)]),
		viewItem("insights", "chart-line-up", t`Insights`),
		...(phone ? [] : [viewItem("calendar", "calendar-dots", t`Calendar`)]),
		{
			link: { to: "/dashboard/applications/offers" },
			match: { to: "/dashboard/applications/offers", fuzzy: false },
			current: view === null,
			icon: "scales",
			label: t`Offers`,
			count: offers.data?.length,
			group: t`Offers`,
		},
	];

	return (
		<SectionLayout title={t`Applications`} items={items}>
			{children}
		</SectionLayout>
	);
}
