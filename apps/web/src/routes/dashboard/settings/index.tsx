import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useBreakpoint } from "@rezumi/ui/hooks/use-breakpoint";
import { SettingsRoot } from "@/features/settings/root";

// Phones (below 640px) get the root with the two pages; wider screens open Account.
export const Route = createFileRoute("/dashboard/settings/")({
	component: RouteComponent,
});

function RouteComponent() {
	return useBreakpoint() === "mobile" ? <SettingsRoot /> : <Navigate to="/dashboard/settings/account" replace />;
}
