import type { ReactNode } from "react";
import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { createFileRoute, Outlet, useMatchRoute } from "@tanstack/react-router";
import { cn } from "@rezumi/utils/style";
import { Page } from "@/components/layout/page";
import { PageHeader } from "@/components/layout/page-header";

export const Route = createFileRoute("/dashboard/career")({
	component: CareerLayout,
});

/** `tabs`: the page has tabs under its title (Knowledge), so the title stays put while they switch. */
type Heading = { title: ReactNode; description: ReactNode; tabs?: boolean };

/** Knowledge and Offers: separate pages in the sidebar, under one address; each gets its own title here. */
function CareerLayout() {
	const matchRoute = useMatchRoute();
	const headings: { match: string; fuzzy: boolean; heading: Heading }[] = [
		{
			match: "/dashboard/career/knowledge",
			fuzzy: true,
			heading: {
				title: t`Knowledge`,
				description: <Trans>The facts, stories and preferences the coach works from.</Trans>,
				tabs: true,
			},
		},
		{
			match: "/dashboard/career/offers",
			fuzzy: true,
			heading: {
				title: t`Offers`,
				description: <Trans>Compare two saved offers side by side, and decide what to ask.</Trans>,
			},
		},
	];
	const current = headings.find((item) => matchRoute({ to: item.match, fuzzy: item.fuzzy }))?.heading;

	return (
		<Page>
			{current && (
				// Named for the page transition: switching Knowledge's tabs keeps the title in place while the tab's page
				// fades (index.css). Leaving for another page, it fades with the page.
				<div className={cn("grid", current.tabs && "[view-transition-name:knowledge-header]")}>
					<PageHeader title={current.title} description={current.description} />
				</div>
			)}
			<Outlet />
		</Page>
	);
}
