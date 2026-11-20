import { createFileRoute } from "@tanstack/react-router";
import { JobCostsPage } from "@/features/jobs/admin/costs-page";

export const Route = createFileRoute("/dashboard/admin/jobs")({
	component: JobCostsPage,
});
