import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/layout/page-header";
import { ProfileDetailsPage } from "@/features/profile/details-page";

export const Route = createFileRoute("/dashboard/profile/career")({
	component: RouteComponent,
});

function RouteComponent() {
	return (
		<>
			<PageHeader
				title={t`Career`}
				description={
					<Trans>
						Your summary, experience, education, skills and the rest. New resumes and your portfolio start from here.
					</Trans>
				}
			/>
			<ProfileDetailsPage part="career" />
		</>
	);
}
