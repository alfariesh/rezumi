import { createFileRoute } from "@tanstack/react-router";
import z from "zod";
import { Coach } from "@/features/career/coach";
import { openCoachPanel, useCoachPanelStore } from "@/features/coach-panel/store";

/**
 * Coach full screen: the conversations beside the chat, opened from the panel's expand button and from older links
 * (notifications, emails, `/dashboard/career/coach/…`). Collapse goes back to the panel, on the same conversation,
 * over the page the person came from (Home when this address was opened directly).
 */
export const Route = createFileRoute("/dashboard/coach/{-$conversationId}")({
	// `offers`: saved offer ids to add as context ("Plan what to ask" from Offers).
	validateSearch: z.object({ offers: z.array(z.string()).max(2).optional().catch(undefined) }),
	component: RouteComponent,
});

function RouteComponent() {
	const { conversationId } = Route.useParams();
	const { offers } = Route.useSearch();
	const navigate = Route.useNavigate();

	// Not keyed by the conversation: a new conversation's chat stays mounted (and streaming) when the address moves to
	// its id, and any other change starts a fresh one.
	return (
		<Coach
			layout="page"
			conversationId={conversationId}
			offerIds={offers ?? []}
			onConversationChange={(id, change) =>
				void navigate({
					to: "/dashboard/coach/{-$conversationId}",
					params: { conversationId: id },
					search: change?.offerIds?.length ? { offers: change.offerIds } : {},
					replace: change?.created === true,
				})
			}
			onClose={() => {
				openCoachPanel({ conversationId: conversationId ?? null, offerIds: offers });
				void navigate({ href: useCoachPanelStore.getState().lastHref ?? "/dashboard" });
			}}
		/>
	);
}
