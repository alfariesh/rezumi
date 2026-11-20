import { createFileRoute, redirect } from "@tanstack/react-router";

// Job search had its own settings once; finding roles now lives on the Jobs page and needs no setup.
export const Route = createFileRoute("/dashboard/settings/job-search")({
	beforeLoad: () => {
		throw redirect({ to: "/dashboard/applications/jobs", replace: true });
	},
});
