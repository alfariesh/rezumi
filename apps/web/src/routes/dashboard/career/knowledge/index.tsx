import { createFileRoute, redirect } from "@tanstack/react-router";

// Knowledge became the Profile's Facts, Stories and Preferences tabs; old links and bookmarks land there.
export const Route = createFileRoute("/dashboard/career/knowledge/")({
	beforeLoad: () => {
		throw redirect({ to: "/dashboard/profile/facts", replace: true });
	},
});
