import { createFileRoute, redirect } from "@tanstack/react-router";

// Settings is two pages, Account and Settings; the old address redirects to the page that holds it.
export const Route = createFileRoute("/dashboard/settings/authentication/")({
	beforeLoad: () => {
		throw redirect({ to: "/dashboard/settings/account", replace: true });
	},
});
