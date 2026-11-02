import { createFileRoute } from "@tanstack/react-router";
import { PlanSettings } from "@/features/billing/plan-page";

export const Route = createFileRoute("/dashboard/settings/billing")({ component: PlanSettings });
