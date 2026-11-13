import { createFileRoute } from "@tanstack/react-router";
import { ProfileDetailsPage } from "@/features/profile/details-page";

export const Route = createFileRoute("/dashboard/profile/")({
	component: ProfileDetailsPage,
});
