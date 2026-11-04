import { createFileRoute, redirect } from "@tanstack/react-router";
import z from "zod";

// Today is Home now, at /dashboard. Notifications, emails and older app builds still link here (with `schedule` to
// open a schedule), so this address forwards and keeps it.
export const Route = createFileRoute("/dashboard/career/")({
	validateSearch: z.object({ schedule: z.string().min(1).optional().catch(undefined) }),
	beforeLoad: ({ search }) => {
		throw redirect({ to: "/dashboard", search: search.schedule ? { schedule: search.schedule } : {}, replace: true });
	},
});
