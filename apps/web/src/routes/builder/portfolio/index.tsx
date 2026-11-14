import { t } from "@lingui/core/macro";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, redirect, useBlocker } from "@tanstack/react-router";
import { useEffect } from "react";
import z from "zod";
import { PortfolioShell } from "./-components/portfolio-shell";
import { forgetPortfolioChanges } from "@/features/portfolio/assistant/records";
import { shouldStayInEditor } from "@/features/portfolio/editor/leave";
import { usePortfolioEditorStore } from "@/features/portfolio/editor/store";
import { usePortfolioEditorUi } from "@/features/portfolio/editor/ui";
import { useConfirm } from "@/hooks/use-confirm";
import { orpc } from "@/libs/orpc/client";
import { createNoindexFollowMeta } from "@/libs/seo";

const searchSchema = z.object({
	// Content is the default and stays out of the URL.
	mode: z.enum(["design", "share"]).optional().catch(undefined),
	// The assistant on a conversation ("new" for a fresh one), and a link's message for its composer (sent on Send).
	assistant: z.string().optional().catch(undefined),
	ask: z.string().optional().catch(undefined),
});

/**
 * The portfolio editor. A static segment, so it wins over `/builder/$resumeId`. Accounts the switch (`PORTFOLIO_MODE`)
 * leaves out go home; an account without a portfolio goes to the Portfolio page to make one.
 */
export const Route = createFileRoute("/builder/portfolio/")({
	component: RouteComponent,
	validateSearch: searchSchema,
	beforeLoad: ({ context, location }) => {
		if (!context.session) throw redirect({ to: "/auth/login", search: { callbackURL: location.href }, replace: true });
		return { session: context.session };
	},
	loader: async ({ context }) => {
		void import("@/features/portfolio/editor/preview");
		// Always fresh: another tab or device may have saved since.
		const result = await context.queryClient.fetchQuery({ ...orpc.portfolio.get.queryOptions(), staleTime: 0 });
		if (!result.enabled) throw redirect({ to: "/dashboard", replace: true });
		if (!result.portfolio) throw redirect({ to: "/dashboard/portfolio", replace: true });
	},
	head: () => ({ meta: [{ title: `${t`Portfolio`} - Rezumi` }, createNoindexFollowMeta()] }),
});

function RouteComponent() {
	const { data } = useSuspenseQuery(orpc.portfolio.get.queryOptions());
	const loaded = usePortfolioEditorStore((state) => state.portfolio !== null);
	const confirm = useConfirm();

	// Leaving saves what's pending first; when that can't be done, the person decides (`shouldStayInEditor`).
	useBlocker({
		shouldBlockFn: ({ next }) => (next.pathname.startsWith("/builder/portfolio") ? false : shouldStayInEditor(confirm)),
		enableBeforeUnload: false,
	});

	// The editor owns the portfolio from here; later refetches don't overwrite what's being typed.
	useEffect(() => {
		const current = usePortfolioEditorStore.getState().portfolio;
		if (data.portfolio && current?.id !== data.portfolio.id) usePortfolioEditorStore.getState().load(data.portfolio);
	}, [data.portfolio]);

	// Leaving: edits still waiting for the pause in typing go out on their own, and the next visit starts fresh.
	useEffect(
		() => () => {
			usePortfolioEditorStore.getState().close();
			usePortfolioEditorUi.getState().reset();
			forgetPortfolioChanges();
		},
		[],
	);

	if (!loaded) return null;
	return <PortfolioShell />;
}
