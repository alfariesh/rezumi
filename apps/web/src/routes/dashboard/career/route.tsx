import type { ReactNode } from "react";
import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { createFileRoute, Outlet, useMatchRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/layout/page-header";

export const Route = createFileRoute("/dashboard/career")({
	component: CareerLayout,
});

type Heading = { title: ReactNode; description: ReactNode };

/** Career: Today, Knowledge and Offers are separate pages in the sidebar; each gets its own title here. */
function CareerLayout() {
	const matchRoute = useMatchRoute();
	const headings: { match: string; fuzzy: boolean; heading: Heading }[] = [
		{
			match: "/dashboard/career/knowledge",
			fuzzy: true,
			heading: {
				title: t`Knowledge`,
				description: <Trans>The facts, stories and preferences the coach works from.</Trans>,
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
		{
			match: "/dashboard/career/",
			fuzzy: false,
			heading: {
				title: t`Today`,
				description: <Trans>What needs you, new roles from your search, your next interview and your schedules.</Trans>,
			},
		},
	];
	const current = headings.find((item) => matchRoute({ to: item.match, fuzzy: item.fuzzy }))?.heading;

	return (
		<div className="mx-auto flex min-h-svh w-full max-w-[1180px] flex-col gap-5 px-8 py-8 max-sm:px-4 max-sm:py-5">
			{current && <PageHeader title={current.title} description={current.description} />}
			<Outlet />
		</div>
	);
}
