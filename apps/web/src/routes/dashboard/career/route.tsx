import type { ReactNode } from "react";
import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { createFileRoute, Outlet, useMatchRoute } from "@tanstack/react-router";
import { Page } from "@/components/layout/page";
import { PageHeader } from "@/components/layout/page-header";

export const Route = createFileRoute("/dashboard/career")({
	component: CareerLayout,
});

type Heading = { title: ReactNode; description: ReactNode };

/** Offers keeps its address under /dashboard/career; it gets its title here. Old Knowledge links redirect to Profile. */
function CareerLayout() {
	const matchRoute = useMatchRoute();
	const headings: { match: string; fuzzy: boolean; heading: Heading }[] = [
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
			{current && <PageHeader title={current.title} description={current.description} />}
			<Outlet />
		</Page>
	);
}
