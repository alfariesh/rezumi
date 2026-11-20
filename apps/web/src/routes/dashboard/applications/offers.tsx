import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { createFileRoute } from "@tanstack/react-router";
import z from "zod";
import { PageHeader } from "@/components/layout/page-header";
import { ApplicationsSection } from "@/features/applications/components/applications-section";
import { OffersPage } from "@/features/career/offers";

export const Route = createFileRoute("/dashboard/applications/offers")({
	validateSearch: z.object({
		a: z.string().min(1).optional().catch(undefined),
		b: z.string().min(1).optional().catch(undefined),
	}),
	component: RouteComponent,
});

/** Offers: two saved offers side by side, a page of Applications with its own item in the menu. */
function RouteComponent() {
	const { a, b } = Route.useSearch();
	return (
		<ApplicationsSection view="offers">
			<PageHeader
				title={t`Offers`}
				description={<Trans>Compare two saved offers side by side, and decide what to ask.</Trans>}
			/>
			<OffersPage a={a} b={b} />
		</ApplicationsSection>
	);
}
