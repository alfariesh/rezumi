// Home's reads, shared with the shell (the Home badge, the sidebar counts, the Portfolio tab). Keys carry the server,
// like every query in the app, so a switched account never sees the last one's rows.
import type { RouterOutput } from "@/api/client";
import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/api/client";
import { useSession } from "@/auth/session";

export type Notification = RouterOutput["career"]["notifications"][number];
export type Opportunity = RouterOutput["career"]["opportunities"][number];
export type Schedule = RouterOutput["career"]["schedules"][number];

function useSignedIn() {
	const session = useSession();
	return { enabled: session.status === "signed-in", server: session.server };
}

export function useNotifications() {
	const { enabled, server } = useSignedIn();
	return useQuery({
		...orpc.career.notifications.queryOptions({ input: {} }),
		enabled,
		queryKey: [...orpc.career.notifications.key(), server],
	});
}

export function useOpportunities() {
	const { enabled, server } = useSignedIn();
	return useQuery({
		...orpc.career.opportunities.queryOptions({ input: {} }),
		enabled,
		queryKey: [...orpc.career.opportunities.key(), server],
	});
}

/** The schedules' cache key. Home, its optimistic toggle and the application workspace share this one copy. */
export const schedulesKey = (server: string) => [...orpc.career.schedules.key(), server];

export function useSchedules() {
	const { enabled, server } = useSignedIn();
	return useQuery({
		...orpc.career.schedules.queryOptions({ input: {} }),
		enabled,
		queryKey: schedulesKey(server),
	});
}

export function useBriefings() {
	const { enabled, server } = useSignedIn();
	return useQuery({
		...orpc.career.savedItems.queryOptions({ input: { kind: "briefing" } }),
		enabled,
		queryKey: [...orpc.career.savedItems.key(), server, "briefing"],
	});
}

/** Unread notifications: the Home tab's badge and the "Needs you" count. Undefined until loaded. */
export function useUnreadCount() {
	const notifications = useNotifications();
	return notifications.data?.filter((row) => !row.readAt).length;
}

/** Whether portfolios are open to this account (`PORTFOLIO_MODE`); the Portfolio tab shows only then. */
export function usePortfolioEnabled() {
	const { enabled, server } = useSignedIn();
	const status = useQuery({
		...orpc.portfolio.status.queryOptions({ input: {} }),
		enabled,
		queryKey: [...orpc.portfolio.status.key(), server],
	});
	return status.data?.enabled === true;
}

/** Document counts (resumes, letters, trash), one cache copy for the sidebar and the Documents library. */
export function useDocumentCounts() {
	const { enabled, server } = useSignedIn();
	return useQuery({
		...orpc.documents.counts.queryOptions(),
		enabled,
		queryKey: [...orpc.documents.counts.key(), server],
	});
}

/** The sidebar's quiet counts, as on the web: documents (not trashed) and open applications. */
export function useSidebarCounts() {
	const { enabled, server } = useSignedIn();
	const documents = useDocumentCounts();
	const applications = useQuery({
		...orpc.applications.stats.queryOptions({ input: {} }),
		enabled,
		queryKey: [...orpc.applications.stats.key(), server],
	});
	return {
		documents: documents.data ? documents.data.resume + documents.data.letter : undefined,
		applications: applications.data?.byStage
			.filter((row) => row.status !== "closed")
			.reduce((total, row) => total + row.count, 0),
	};
}
