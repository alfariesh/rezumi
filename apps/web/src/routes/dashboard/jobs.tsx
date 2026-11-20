import type { JobsSearch } from "@/features/jobs/search";
import { createFileRoute, stripSearchParams } from "@tanstack/react-router";
import { JobsPage } from "@/features/jobs/jobs-page";
import { JOBS_SEARCH_DEFAULTS, jobsSearchSchema } from "@/features/jobs/search";
import { orpc } from "@/libs/orpc/client";

export const Route = createFileRoute("/dashboard/jobs")({
	validateSearch: jobsSearchSchema,
	search: { middlewares: [stripSearchParams(JOBS_SEARCH_DEFAULTS)] },
	// Hovering the link starts the status and the starting search; neither searches.
	loader: ({ context }) => {
		void context.queryClient.prefetchQuery(orpc.jobs.quota.queryOptions());
		void context.queryClient.prefetchQuery({ ...orpc.jobs.defaults.queryOptions(), staleTime: Infinity });
	},
	component: RouteComponent,
});

function RouteComponent() {
	const search = Route.useSearch();
	const navigate = Route.useNavigate();
	return (
		<JobsPage search={search} onSearch={(next: JobsSearch) => void navigate({ search: next, resetScroll: false })} />
	);
}
