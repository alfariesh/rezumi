import { createFileRoute, redirect } from "@tanstack/react-router";
import { jobsSearchSchema } from "@/features/jobs/search";

// Jobs moved into Applications (2026-11-20); links, emails and guides with the old address keep working.
export const Route = createFileRoute("/dashboard/jobs")({
	validateSearch: jobsSearchSchema,
	beforeLoad: ({ search }) => {
		throw redirect({ to: "/dashboard/applications/jobs", search, replace: true });
	},
});
