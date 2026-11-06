import { t } from "@lingui/core/macro";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, redirect, useBlocker } from "@tanstack/react-router";
import { useEffect } from "react";
import z from "zod";
import { toast } from "@rezumi/ui/components/toast";
import { PortfolioShell } from "./-components/portfolio-shell";
import { usePortfolioEditorStore } from "@/features/portfolio/editor/store";
import { usePortfolioEditorUi } from "@/features/portfolio/editor/ui";
import { orpc } from "@/libs/orpc/client";
import { createNoindexFollowMeta } from "@/libs/seo";

const searchSchema = z.object({
	// Content is the default and stays out of the URL.
	mode: z.enum(["design", "share"]).optional().catch(undefined),
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
	head: () => ({ meta: [{ title: "Portfolio - Rezumi" }, createNoindexFollowMeta()] }),
});

function RouteComponent() {
	const { data } = useSuspenseQuery(orpc.portfolio.get.queryOptions());
	const loaded = usePortfolioEditorStore((state) => state.portfolio !== null);

	// Leaving waits for what's still being saved; a failed save keeps the editor open.
	useBlocker({
		shouldBlockFn: async ({ next }) => {
			if (next.pathname.startsWith("/builder/portfolio")) return false;
			const { status, dirty } = usePortfolioEditorStore.getState();
			if (status === "saved" && !dirty) return false;
			if (status === "conflict") return false;
			const saved = await usePortfolioEditorStore.getState().flush();
			if (!saved) toast.add({ type: "error", description: t`Couldn't save your changes. Try again before leaving.` });
			return !saved;
		},
		enableBeforeUnload: false,
	});

	// The editor owns the portfolio from here; later refetches don't overwrite what's being typed.
	useEffect(() => {
		const current = usePortfolioEditorStore.getState().portfolio;
		if (data.portfolio && current?.id !== data.portfolio.id) usePortfolioEditorStore.getState().load(data.portfolio);
	}, [data.portfolio]);

	useEffect(
		() => () => {
			usePortfolioEditorStore.getState().reset();
			usePortfolioEditorUi.getState().openWork(null);
		},
		[],
	);

	if (!loaded) return null;
	return <PortfolioShell />;
}
