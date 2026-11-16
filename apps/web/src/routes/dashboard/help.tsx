import { createFileRoute } from "@tanstack/react-router";
import { HelpPage } from "@/features/help/help-page";

export const Route = createFileRoute("/dashboard/help")({
	component: HelpPage,
});
