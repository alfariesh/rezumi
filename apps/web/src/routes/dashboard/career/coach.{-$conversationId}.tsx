import { createFileRoute, redirect } from "@tanstack/react-router";
import z from "zod";

// Coach moved out of Career; old links and bookmarks land on the new page.
export const Route = createFileRoute("/dashboard/career/coach/{-$conversationId}")({
	validateSearch: z.object({ offers: z.array(z.string()).max(2).optional().catch(undefined) }),
	beforeLoad: ({ params, search }) => {
		throw redirect({
			to: "/dashboard/coach/{-$conversationId}",
			params: { conversationId: params.conversationId },
			search,
			replace: true,
		});
	},
});
