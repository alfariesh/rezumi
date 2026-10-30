import { createFileRoute, redirect } from "@tanstack/react-router";

// Settings is two pages, Account and Settings; the old address redirects to the group it held.
export const Route = createFileRoute("/dashboard/settings/api-keys")({
	beforeLoad: () => {
		throw redirect({ to: "/dashboard/settings/app", hash: "api-keys", replace: true });
	},
});
