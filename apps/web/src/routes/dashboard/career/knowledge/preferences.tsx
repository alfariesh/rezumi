import { createFileRoute, redirect } from "@tanstack/react-router";

// Knowledge became the Profile's tabs.
export const Route = createFileRoute("/dashboard/career/knowledge/preferences")({
	beforeLoad: () => {
		throw redirect({ to: "/dashboard/profile/preferences", replace: true });
	},
});
