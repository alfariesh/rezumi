import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/layout/page-header";
import { ProfileDetailsPage } from "@/features/profile/details-page";

export const Route = createFileRoute("/dashboard/profile/")({
	component: RouteComponent,
});

function RouteComponent() {
	return (
		<>
			<PageHeader
				title={t`Details & career`}
				description={
					<Trans>
						Your details and career, kept in one place. New resumes, letters and your portfolio start from here.
					</Trans>
				}
			/>
			<ProfileDetailsPage />
		</>
	);
}
