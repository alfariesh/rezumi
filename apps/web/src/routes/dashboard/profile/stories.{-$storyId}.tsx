import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { createFileRoute } from "@tanstack/react-router";
import z from "zod";
import { PageHeader } from "@/components/layout/page-header";
import { StoriesPage } from "@/features/career/knowledge/stories";

export const Route = createFileRoute("/dashboard/profile/stories/{-$storyId}")({
	// `edit`: the story editor; with no story id it's a new story.
	validateSearch: z.object({ edit: z.boolean().optional().catch(undefined) }),
	component: RouteComponent,
});

function RouteComponent() {
	const { storyId } = Route.useParams();
	const { edit } = Route.useSearch();
	return (
		<>
			<PageHeader
				title={t`Stories`}
				description={<Trans>Moments from your work, told in a few lines, ready for interviews and letters.</Trans>}
			/>
			<StoriesPage storyId={storyId} edit={edit ?? false} />
		</>
	);
}
