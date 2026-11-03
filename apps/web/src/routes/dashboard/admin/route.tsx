import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/dashboard/admin")({
	// The pages are hidden from everyone else, and the server refuses their calls anyway.
	beforeLoad: ({ context }) => {
		if (context.session.user.role !== "admin") throw redirect({ to: "/dashboard", replace: true });
	},
	component: RouteComponent,
});

/** Internal tools for the owner; wider than Settings, for tables. No mobile version: they are not a customer feature. */
function RouteComponent() {
	return (
		<div className="mx-auto w-full max-w-7xl px-5 pt-5 pb-10 max-sm:px-4">
			<Outlet />
		</div>
	);
}
