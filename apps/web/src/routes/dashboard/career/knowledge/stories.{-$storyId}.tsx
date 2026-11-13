import { createFileRoute, redirect } from "@tanstack/react-router";
import z from "zod";

// Knowledge became the Profile's tabs; old links to a story open it there.
export const Route = createFileRoute("/dashboard/career/knowledge/stories/{-$storyId}")({
	validateSearch: z.object({ edit: z.boolean().optional().catch(undefined) }),
	beforeLoad: ({ params, search }) => {
		throw redirect({
			to: "/dashboard/profile/stories/{-$storyId}",
			params: { storyId: params.storyId },
			search,
			replace: true,
		});
	},
});
