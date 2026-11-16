import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { SettingsSection } from "@/features/settings/settings-section";

export const Route = createFileRoute("/dashboard/admin")({
	// The pages are hidden from everyone else, and the server refuses their calls anyway.
	beforeLoad: ({ context }) => {
		if (context.session.user.role !== "admin") throw redirect({ to: "/dashboard", replace: true });
	},
	component: RouteComponent,
});

/** Internal tools for the owner, in Settings' section (its admin group). No mobile version: not a customer feature. */
function RouteComponent() {
	return (
		<SettingsSection>
			<Outlet />
		</SettingsSection>
	);
}
