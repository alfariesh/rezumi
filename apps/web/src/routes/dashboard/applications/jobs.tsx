import type { JobsSearch } from "@rezumi/career/jobs";
import { createFileRoute, stripSearchParams } from "@tanstack/react-router";
import { JOBS_SEARCH_DEFAULTS, jobsSearchSchema } from "@rezumi/career/jobs";
import { ApplicationsSection } from "@/features/applications/components/applications-section";
import { JobsPage } from "@/features/jobs/jobs-page";
import { orpc } from "@/libs/orpc/client";

export const Route = createFileRoute("/dashboard/applications/jobs")({
	validateSearch: jobsSearchSchema,
	search: { middlewares: [stripSearchParams(JOBS_SEARCH_DEFAULTS)] },
	// Hovering the link starts the status and the starting search; neither searches.
	loader: ({ context }) => {
		void context.queryClient.prefetchQuery(orpc.jobs.quota.queryOptions());
		void context.queryClient.prefetchQuery({ ...orpc.jobs.defaults.queryOptions(), staleTime: Infinity });
	},
	component: RouteComponent,
});

/** Jobs: searching current listings, a page of Applications with its own item in the menu (2026-11-20, owner). */
function RouteComponent() {
	const search = Route.useSearch();
	const navigate = Route.useNavigate();
	return (
		<ApplicationsSection view="jobs">
			<JobsPage
				search={search}
				onSearch={(next: JobsSearch, options) =>
					void navigate({ search: next, resetScroll: false, replace: options?.replace ?? false })
				}
			/>
		</ApplicationsSection>
	);
}
