// Jobs' reads (the web's jobs-page.tsx and recent-searches.tsx). Keys carry the server, like every query in the app.
// A search counts toward the day's searches, so it is never asked again on its own: no refetch on focus, remount or
// reconnect, no retry; the person presses Search, Try again or Load more.
import type { JobSearchCriteria, JobSearchResult } from "@rezumi/schema/jobs/search";
import { ORPCError } from "@orpc/client";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { orpc } from "@/api/client";
import { useSession } from "@/auth/session";

function useSignedIn() {
	const session = useSession();
	return { enabled: session.status === "signed-in", server: session.server };
}

/** Whether job search runs on this server, and today's searches. */
export function useJobQuota() {
	const { enabled, server } = useSignedIn();
	return useQuery({
		...orpc.jobs.quota.queryOptions(),
		enabled,
		queryKey: [...orpc.jobs.quota.key(), server],
	});
}

export const jobQuotaKey = (server: string) => [...orpc.jobs.quota.key(), server];

/** The role, place and country a first search starts from (Preferences and search regions). */
export function useJobDefaults(enabled: boolean) {
	const signedIn = useSignedIn();
	return useQuery({
		...orpc.jobs.defaults.queryOptions(),
		enabled: signedIn.enabled && enabled,
		staleTime: Infinity,
		queryKey: [...orpc.jobs.defaults.key(), signedIn.server],
	});
}

type SearchRequest = Omit<JobSearchCriteria, "cursor">;

const searchOptions = (request: SearchRequest | null) =>
	orpc.jobs.search.infiniteOptions({
		input: (cursor: string | undefined) => ({ ...(request ?? { query: "" }), ...(cursor ? { cursor } : {}) }),
		initialPageParam: undefined as string | undefined,
		getNextPageParam: (page: JobSearchResult) => page.cursor,
	});

/** The search's cache key: resetting it drops the loaded pages (a list that can't be continued). */
export const jobSearchKey = (request: SearchRequest | null, server: string) => [
	...searchOptions(request).queryKey,
	server,
];

/** The search's pages: listings, which are tracked, their skills against the Profile, and today's searches. */
export function useJobSearch(request: SearchRequest | null) {
	const { enabled, server } = useSignedIn();
	return useInfiniteQuery({
		...searchOptions(request),
		queryKey: jobSearchKey(request, server),
		enabled: enabled && request !== null,
		staleTime: 30 * 60_000,
		retry: false,
		refetchOnWindowFocus: false,
		refetchOnReconnect: false,
		refetchOnMount: false,
	});
}

/** The person's last 10 searches (kept on the server, the same on every device), newest first. */
export function useRecentSearches() {
	const queryClient = useQueryClient();
	const { enabled, server } = useSignedIn();
	const queryKey = [...orpc.jobs.recent.key(), server];
	const query = useQuery({ ...orpc.jobs.recent.queryOptions(), enabled, queryKey });
	const refresh = () => void queryClient.invalidateQueries({ queryKey });
	const forget = useMutation({ ...orpc.jobs.forgetRecent.mutationOptions(), onSettled: refresh });
	const clear = useMutation({ ...orpc.jobs.clearRecent.mutationOptions(), onSettled: refresh });
	return {
		searches: query.data?.searches,
		isPending: query.isPending && enabled,
		isError: query.isError,
		retry: () => void query.refetch(),
		forget: (id: string) => forget.mutateAsync({ id }),
		clear: () => clear.mutateAsync({}),
		refresh,
	};
}

/** A listing that is gone stays gone: it isn't asked again. */
export const isGone = (error: unknown) => error instanceof ORPCError && error.code === "NOT_FOUND";

/** One listing in full (its description); the card already holds the rest. */
export function useListing(id: string) {
	const { enabled, server } = useSignedIn();
	return useQuery({
		...orpc.jobs.listing.queryOptions({ input: { id } }),
		enabled,
		staleTime: 10 * 60_000,
		queryKey: [...orpc.jobs.listing.key({ input: { id } }), server],
		retry: (failures, error) => !isGone(error) && failures < 2,
	});
}

export const listingFitKey = (id: string, server: string) => [...orpc.jobs.fit.key({ input: { id } }), server];

/** The AI fit check run on a listing, if any, and whether the Profile changed since. Free to read. */
export function useListingFit(id: string) {
	const { enabled, server } = useSignedIn();
	return useQuery({
		...orpc.jobs.fit.queryOptions({ input: { id } }),
		enabled,
		staleTime: 5 * 60_000,
		queryKey: listingFitKey(id, server),
	});
}
