import { createFileRoute } from "@tanstack/react-router";
import { AppSettings } from "@/features/settings/page";

export const Route = createFileRoute("/dashboard/settings/app")({
	component: AppSettings,
});
