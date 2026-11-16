import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { createFileRoute } from "@tanstack/react-router";
import z from "zod";
import { PageHeader } from "@/components/layout/page-header";
import { FactsPage } from "@/features/career/knowledge/facts";

export const Route = createFileRoute("/dashboard/profile/facts")({
	// `highlight`: a fact to scroll to and tint ("View" after remembering, a story's backing fact).
	validateSearch: z.object({ highlight: z.string().min(1).optional().catch(undefined) }),
	component: RouteComponent,
});

function RouteComponent() {
	const { highlight } = Route.useSearch();
	return (
		<>
			<PageHeader
				title={t`Facts`}
				description={
					<Trans>Things that are true about your work. The coach and AI quote them, and never invent their own.</Trans>
				}
			/>
			<FactsPage highlight={highlight} />
		</>
	);
}
