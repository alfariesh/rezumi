import { createFileRoute, Outlet } from "@tanstack/react-router";
import { SettingsSection } from "@/features/settings/settings-section";

export const Route = createFileRoute("/dashboard/settings")({ component: RouteComponent });

function RouteComponent() {
	return (
		<SettingsSection>
			<Outlet />
		</SettingsSection>
	);
}
