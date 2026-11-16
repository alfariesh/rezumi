import { createFileRoute, redirect } from "@tanstack/react-router";
import z from "zod";
import { openCoachPanel, useCoachPanelStore } from "@/features/coach-panel/store";

/**
 * The coach was a page; it is now a panel opened from the top bar. This address (notifications, emails, Offers'
 * "Plan what to ask", older links) opens the panel on that conversation, or a new one with those offers as context,
 * and stays on the page the person was on (Home when the address is opened directly).
 */
export const Route = createFileRoute("/dashboard/coach/{-$conversationId}")({
	// `offers`: saved offer ids to add as context ("Plan what to ask" from Offers).
	validateSearch: z.object({ offers: z.array(z.string()).max(2).optional().catch(undefined) }),
	beforeLoad: ({ params, search, preload }) => {
		// Hovering a link preloads it: only following it opens the panel.
		if (!preload) openCoachPanel({ conversationId: params.conversationId ?? null, offerIds: search.offers });
		throw redirect({ href: useCoachPanelStore.getState().lastHref ?? "/dashboard", replace: true });
	},
});
