import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/layout/page-header";
import { ProfileDetailsPage, ProfileSaveStatus } from "@/features/profile/details-page";

export const Route = createFileRoute("/dashboard/profile/")({
	component: RouteComponent,
});

function RouteComponent() {
	return (
		<>
			<PageHeader
				titleAddon={<ProfileSaveStatus />}
				title={t({ message: "Details", context: "Profile page: your name, photo, contact details and links" })}
				description={
					<Trans>
						Your name, photo, contact details and links. New resumes, letters and your portfolio start from here.
					</Trans>
				}
			/>
			<ProfileDetailsPage part="details" />
		</>
	);
}
