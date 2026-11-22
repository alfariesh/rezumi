// Jobs' state (the web's jobs-page.tsx): the search last run and the form's own copy (changing the form doesn't
// search), the pages, today's searches, and the last results kept for offline. Opened without a search, today's last
// search comes back by itself when it's free (a page opened today doesn't count again); an older one waits in the
// recent searches, since opening it would use one of today's searches.
import type { JobsSearch } from "@rezumi/career/jobs";
import type { JobListingCard, JobListingMatch, JobSearchResult } from "@rezumi/schema/jobs/search";
import { onlineManager, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, useSyncExternalStore } from "react";
import { fromCriteria, jobsSearchSchema, startingSearch, toSearchRequest } from "@rezumi/career/jobs";
import { jobQuotaKey, jobSearchKey, useJobDefaults, useJobQuota, useJobSearch, useRecentSearches } from "./queries";
import { readSavedSearch, writeSavedSearch } from "./saved-search";
import { orpc } from "@/api/client";
import { getAccountScope, useSession } from "@/auth/session";

export const EMPTY_SEARCH: JobsSearch = jobsSearchSchema.parse({});

const subscribeOnline = (listener: () => void) => onlineManager.subscribe(listener);
const isOnlineNow = () => onlineManager.isOnline();

export function useOnline() {
	return useSyncExternalStore(subscribeOnline, isOnlineNow);
}

export function useJobs() {
	const queryClient = useQueryClient();
	const { server } = useSession();
	const online = useOnline();
	// The search last run; null until the person searches (or today's last search comes back).
	const [search, setSearch] = useState<JobsSearch | null>(null);
	const [draft, setDraft] = useState<JobsSearch | null>(null);
	const quota = useJobQuota();
	const defaults = useJobDefaults(search === null);
	const recent = useRecentSearches();
	const latest = recent.searches?.[0];
	const resume = search === null && latest?.seenToday ? latest : undefined;
	useEffect(() => {
		if (resume) setSearch(fromCriteria(resume.criteria));
	}, [resume]);

	const request = search ? toSearchRequest(search) : null;
	const results = useJobSearch(request);
	const pages = results.data?.pages ?? [];
	// Offline with nothing loaded: the last results kept on this device.
	const [saved] = useState(() => readSavedSearch(getAccountScope()));
	const offlineCopy = !online && pages.length === 0 && saved ? saved : null;
	const shownPages: JobSearchResult[] = offlineCopy ? offlineCopy.pages : pages;
	const last = shownPages.at(-1);

	// Each answer keeps the pages for offline, brings today's count into the status (a newer answer only), and moves
	// its search to the top of the recent ones (the server records it).
	const answeredAt = results.dataUpdatedAt;
	useEffect(() => {
		if (!answeredAt || !search || pages.length === 0) return;
		writeSavedSearch(getAccountScope(), search, pages);
		const latestQuota = pages.at(-1)?.quota;
		if (latestQuota && answeredAt > quota.dataUpdatedAt)
			queryClient.setQueryData(jobQuotaKey(server), (current: typeof quota.data) =>
				current ? { ...current, quota: latestQuota } : current,
			);
		void queryClient.invalidateQueries({ queryKey: [...orpc.jobs.recent.key(), server] });
		// oxlint-disable-next-line react-hooks/exhaustive-deps -- runs once per answer; the pages belong to it
	}, [answeredAt]);

	const tracked = Object.assign({}, ...shownPages.map((page) => page.tracked)) as Record<string, string>;
	const matches = Object.assign({}, ...shownPages.map((page) => page.matches)) as Record<string, JobListingMatch>;
	// One listing can come back on a later page (another provider); it shows once.
	const listings: JobListingCard[] = [
		...new Map(shownPages.flatMap((page) => page.listings).map((listing) => [listing.id, listing])).values(),
	];

	const form = draft ?? startingSearch(search ?? EMPTY_SEARCH, defaults.data);
	const submit = (next: JobsSearch) => {
		const clean = { ...next, q: next.q.trim(), location: next.location.trim() };
		setDraft(clean);
		setSearch(clean);
	};
	/** Drops the loaded pages and asks for the first one again, for a list that can't be continued. */
	const restart = () => void queryClient.resetQueries({ queryKey: jobSearchKey(request, server), exact: true });

	return {
		search,
		request,
		form,
		setDraft,
		submit,
		restart,
		resuming: Boolean(resume) && search === null,
		quota,
		defaults,
		recent,
		results,
		last,
		listings,
		tracked,
		matches,
		online,
		offlineCopy,
	};
}
