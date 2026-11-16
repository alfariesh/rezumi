import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { createFileRoute, Link } from "@tanstack/react-router";
import z from "zod";
import { Icon } from "@rezumi/ui/components/icon";
import { Page } from "@/components/layout/page";
import { PageHeader } from "@/components/layout/page-header";
import { OffersPage } from "@/features/career/offers";

export const Route = createFileRoute("/dashboard/applications/offers")({
	validateSearch: z.object({
		a: z.string().min(1).optional().catch(undefined),
		b: z.string().min(1).optional().catch(undefined),
	}),
	component: RouteComponent,
});

/** Offers: two saved offers side by side. Part of Applications, reached from its header. */
function RouteComponent() {
	const { a, b } = Route.useSearch();
	return (
		<Page>
			<PageHeader
				back={
					<Link
						to="/dashboard/applications"
						className="inline-flex w-fit items-center gap-1 text-sm text-muted transition-colors duration-quick hover:text-foreground"
					>
						<Icon name="caret-left" size={16} className="rtl:-scale-x-100" />
						<Trans>Applications</Trans>
					</Link>
				}
				title={t`Offers`}
				description={<Trans>Compare two saved offers side by side, and decide what to ask.</Trans>}
			/>
			<OffersPage a={a} b={b} />
		</Page>
	);
}
