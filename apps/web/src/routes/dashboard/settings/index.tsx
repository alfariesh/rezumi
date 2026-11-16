import { createFileRoute, redirect } from "@tanstack/react-router";

// Settings opens on Account on every screen; phones reach the other pages through the section's chips.
export const Route = createFileRoute("/dashboard/settings/")({
	beforeLoad: () => {
		throw redirect({ to: "/dashboard/settings/account", replace: true });
	},
});
