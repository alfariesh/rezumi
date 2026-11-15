import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { AppShell } from "./-components/app-shell";
import { orpc } from "@/libs/orpc/client";
import { createNoindexFollowMeta } from "@/libs/seo";

export const Route = createFileRoute("/dashboard")({
	component: RouteComponent,
	beforeLoad: ({ context, location }) => {
		if (!context.session) throw redirect({ to: "/auth/login", search: { callbackURL: location.href }, replace: true });
		return { session: context.session };
	},
	// The sidebar shows Portfolio only when it's on for the account: wait for that, so the menu doesn't gain an item
	// (and shift every item below it) a moment after the shell appears. Cached after the first load. The nav's counts
	// only start here; they fill in beside their labels without moving anything.
	loader: async ({ context }) => {
		const { queryClient } = context;
		void queryClient.prefetchQuery(orpc.documents.counts.queryOptions());
		void queryClient.prefetchQuery(orpc.applications.stats.queryOptions({}));
		void queryClient.prefetchQuery(orpc.career.notifications.queryOptions({ input: {} }));
		await queryClient.ensureQueryData(orpc.portfolio.status.queryOptions()).catch(() => undefined);
	},
	head: () => ({
		meta: [createNoindexFollowMeta()],
	}),
});

function RouteComponent() {
	return (
		<AppShell>
			<Outlet />
		</AppShell>
	);
}
