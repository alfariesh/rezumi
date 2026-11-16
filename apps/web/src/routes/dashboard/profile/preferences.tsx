import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/layout/page-header";
import { PreferencesPage } from "@/features/career/knowledge/preferences";

export const Route = createFileRoute("/dashboard/profile/preferences")({
	component: RouteComponent,
});

function RouteComponent() {
	return (
		<>
			<PageHeader
				title={t({
					message: "Preferences",
					context: "Career preferences: the roles, places, pay and ways of working you want",
				})}
				description={
					<Trans>The roles, places, pay and ways of working you want. Job matches and the coach follow them.</Trans>
				}
			/>
			<PreferencesPage />
		</>
	);
}
