import type { JobsSearch } from "./search";
import type { JobListingCard, JobListingMatch, JobSearchResult } from "@rezumi/schema/jobs/search";
import type { ReactNode } from "react";
import { Button, buttonVariants, Skeleton } from "@heroui/react";
import { t } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import { Plural, Trans } from "@lingui/react/macro";
import { ORPCError } from "@orpc/client";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Icon } from "@rezumi/ui/components/icon";
import { useBreakpoint } from "@rezumi/ui/hooks/use-breakpoint";
import { cn } from "@rezumi/utils/style";
import { JobListingItem } from "./listing-card";
import { JobListingSheet, ListingDetail } from "./listing-sheet";
import { RecentSearchesButton, RecentSearchesWidget, useRecentSearches } from "./recent-searches";
import { activeFilterCount, fromCriteria, sameSearch, startingSearch, toSearchRequest, withoutFilters } from "./search";
import { JobsSearchBar } from "./search-bar";
import { useListingActions } from "./use-listing-actions";
import { EmptyBlock } from "@/components/layout/empty-block";
import { PageHeader } from "@/components/layout/page-header";
import { ScheduleSheet } from "@/features/career/schedule-sheet";
import { withUndo } from "@/features/career/shared";
import { ExtensionInstallHint } from "@/features/extension/install-links";
import { getOrpcErrorMessage, toastError } from "@/libs/error-message";
import { formatRelativeTime } from "@/libs/locale";
import { orpc } from "@/libs/orpc/client";

type JobsPageProps = {
	/** The search in the address: what was last searched, or nothing yet. */
	search: JobsSearch;
	/** Shows another search; `replace` swaps the address instead of adding a step (restoring today's last search). */
	onSearch: (next: JobsSearch, options?: { replace?: boolean }) => void;
};

/**
 * Jobs, a page of Applications (`.agents/docs/plans/lowongan/01-desain.md`): search current listings from job data
 * providers with no setup, read one in full, track it as an application, tailor a resume for it, or open the original
 * posting. The results are a column of widgets; on wide screens the open one (the first, until another is picked) reads
 * beside them, on others it opens in a sheet. Opened without a search, it shows today's last search again when that's
 * free (a page opened today doesn't count again), else the recent searches and the roles from the preferences; nothing
 * is searched that would use one of the day's searches until the person asks.
 */
export function JobsPage({ search, onSearch }: JobsPageProps) {
	const queryClient = useQueryClient();
	// A query shorter than a search takes (a hand-edited address) shows the start, as no query does.
	const searched = search.q.length >= 2;
	const status = useQuery(orpc.jobs.quota.queryOptions());
	const defaults = useQuery({ ...orpc.jobs.defaults.queryOptions(), enabled: !searched, staleTime: Infinity });
	const recent = useRecentSearches();
	// Today's last search comes back by itself when it's free (coming back to Jobs from another page); an older one
	// waits in the recent searches, since opening it would use one of today's searches.
	const resume = !searched && recent.searches?.[0]?.seenToday ? recent.searches[0] : undefined;
	useEffect(() => {
		if (resume) onSearch(fromCriteria(resume.criteria), { replace: true });
	}, [resume, onSearch]);
	// The form's own copy: changing it doesn't search. It starts from the address, or from the preferences once loaded.
	const [draft, setDraft] = useState<JobsSearch | null>(null);
	// Back and forward change the address: the form follows it.
	const [lastSearch, setLastSearch] = useState(search);
	if (lastSearch !== search) {
		setLastSearch(search);
		setDraft(null);
	}
	const form = draft ?? startingSearch(search, defaults.data);
	// The listing open: beside the results on wide screens (the first one until another is picked), in a sheet on others.
	const wide = useBreakpoint() === "wide";
	const [selectedId, setSelectedId] = useState<string | null>(null);
	// The job alert sheet: "new:discovery" for this search, or the id of the alert that already repeats it.
	const [alertSheet, setAlertSheet] = useState<string | undefined>();
	const schedules = useQuery({ ...orpc.career.schedules.queryOptions({ input: {} }), enabled: searched });
	// Alerts deleted here while their Undo is offered.
	const [deletedAlerts, setDeletedAlerts] = useState<string[]>([]);
	const removeAlert = useMutation({
		...orpc.career.deleteSchedule.mutationOptions(),
		onError: (error, { id }) => {
			setDeletedAlerts((current) => current.filter((item) => item !== id));
			toastError(error, t`Couldn't delete this job alert. Try again.`, { allowServerMessage: true });
		},
	});
	const deleteAlert = (id: string) => {
		setDeletedAlerts((current) => [...current, id]);
		withUndo({
			description: t`Job alert deleted`,
			commit: () => removeAlert.mutate({ id }),
			onUndo: () => setDeletedAlerts((current) => current.filter((item) => item !== id)),
		});
	};

	const request = toSearchRequest(search);
	const alert = schedules.data?.find(
		(schedule) =>
			schedule.kind === "discovery" &&
			schedule.search &&
			!deletedAlerts.includes(schedule.id) &&
			sameSearch(schedule.search, request),
	);
	const searchOptions = orpc.jobs.search.infiniteOptions({
		input: (cursor: string | undefined) => ({ ...request, ...(cursor ? { cursor } : {}) }),
		initialPageParam: undefined,
		getNextPageParam: (page) => page.cursor,
	});
	const results = useInfiniteQuery({
		...searchOptions,
		enabled: searched,
		// Each search counts toward the day's searches: never again on its own (focus, remount, errors, or another
		// change on the page such as tracking a job, which refetches everything else).
		staleTime: 30 * 60_000,
		retry: false,
		refetchOnWindowFocus: false,
		meta: { keepOnMutation: true },
	});
	/** Drops the loaded pages and asks for the first one again, for a list that can't be continued. */
	const restart = () => void queryClient.resetQueries({ queryKey: searchOptions.queryKey, exact: true });
	const pages = results.data?.pages ?? [];
	const last: JobSearchResult | undefined = pages.at(-1);
	const tracked = Object.assign({}, ...pages.map((page) => page.tracked)) as Record<string, string>;
	const matches = Object.assign({}, ...pages.map((page) => page.matches)) as Record<string, JobListingMatch>;
	const actions = useListingActions(tracked);
	// One listing can come back on a later page (another provider); show it once.
	const byId = new Map(pages.flatMap((page) => page.listings).map((listing) => [listing.id, listing]));
	const listings = [...byId.values()].filter((listing) => !actions.isHidden(listing.id));
	const picked = listings.find((listing) => listing.id === selectedId);
	const open: JobListingCard | undefined = picked ?? (wide ? listings[0] : undefined);

	// The day's searches have one source, the status. A newer answer brings its count into it; an earlier search shown
	// again (the back button) is older than the status and leaves it alone.
	const latest = last?.quota;
	const answeredAt = results.dataUpdatedAt;
	const statusAt = status.dataUpdatedAt;
	useEffect(() => {
		if (!latest || answeredAt <= statusAt) return;
		queryClient.setQueryData(orpc.jobs.quota.queryKey(), (current) => current && { ...current, quota: latest });
	}, [latest, answeredAt, statusAt, queryClient]);
	// Each answer moves its search to the top of the recent ones (the server records it).
	useEffect(() => {
		if (answeredAt) void queryClient.invalidateQueries({ queryKey: orpc.jobs.recent.key() });
	}, [answeredAt, queryClient]);
	const quota = status.data?.quota;

	const submit = (next: JobsSearch) => {
		setDraft(next);
		setSelectedId(null);
		onSearch({ ...next, q: next.q.trim(), location: next.location.trim() });
	};

	// A failed "load more" is told beside its button; the pages already shown stay.
	const { error, isFetchNextPageError: moreFailed } = results;
	const unavailable = status.data && !status.data.available;

	return (
		<>
			<PageHeader
				title={t({ message: "Jobs", context: "Job listings to search" })}
				actions={quota && !unavailable ? <QuotaNote used={quota.used} max={quota.max} /> : null}
			>
				{!unavailable && (
					<JobsSearchBar
						value={form}
						onChange={setDraft}
						onSearch={() => submit(form)}
						searching={results.isFetching && !results.isFetchingNextPage}
					/>
				)}
			</PageHeader>

			{unavailable ? (
				<EmptyBlock
					kind="page"
					icon="list-magnifying-glass"
					title={<Trans>Job search isn't available here yet</Trans>}
					description={
						<Trans>You can still save jobs from a link, from pasted text, or with the browser extension.</Trans>
					}
					action={
						<Link to="/dashboard/applications" search={{ create: true }} className={buttonVariants({})}>
							<Trans>Save a job</Trans>
						</Link>
					}
				/>
			) : resume ? (
				<ResultsSkeleton />
			) : !searched ? (
				<div className="grid gap-4">
					<RecentSearchesWidget recent={recent} onOpen={submit} />
					{recent.searches?.length ? (
						<RoleSuggestions suggestions={defaults.data?.suggestions ?? []} onPick={(q) => submit({ ...form, q })} />
					) : recent.isPending ? null : (
						<FirstSearch suggestions={defaults.data?.suggestions ?? []} onPick={(q) => submit({ ...form, q })} />
					)}
				</div>
			) : (
				<div className="grid gap-4">
					{error && !moreFailed && (
						<SearchProblem error={error} onRetry={() => void results.refetch()} onRestart={restart} />
					)}
					{last && (
						<ResultNotes
							result={last}
							count={listings.length}
							action={
								<div className="flex flex-wrap items-center gap-2">
									<RecentSearchesButton recent={recent} onOpen={submit} />
									<Button
										size="sm"
										variant={alert?.enabled ? "ghost" : "secondary"}
										onPress={() => setAlertSheet(alert?.id ?? "new:discovery")}
									>
										<Icon name={alert?.enabled ? "check-circle" : "bell"} size={16} />
										{alert?.enabled ? (
											<Trans>Job alert on</Trans>
										) : alert ? (
											<Trans>Job alert paused</Trans>
										) : (
											<Trans>Get job alerts</Trans>
										)}
									</Button>
								</div>
							}
						/>
					)}
					{results.isPending ? (
						<ResultsSkeleton />
					) : listings.length === 0 && !error ? (
						<EmptyBlock
							kind="filtered"
							title={<Trans>No jobs match yet.</Trans>}
							description={
								<Trans>
									Try a longer posting window, fewer filters or other words. For local job boards, save jobs with the
									browser extension.
								</Trans>
							}
							action={
								<>
									{activeFilterCount(search) > 0 && (
										<Button size="sm" variant="secondary" onPress={() => submit(withoutFilters(search))}>
											<Trans>Clear filters</Trans>
										</Button>
									)}
									<ExtensionInstallHint className="basis-full justify-center pt-2" />
								</>
							}
						/>
					) : (
						// One column of widgets; on wide screens the open listing reads beside it, staying in view while the
						// list scrolls.
						<div className="grid items-start gap-4 xl:grid-cols-[minmax(18rem,24rem)_minmax(0,1fr)] xl:gap-5">
							<div className="grid gap-3">
								<ul className="grid gap-2" aria-label={t({ message: "Jobs", context: "Job listings to search" })}>
									{listings.map((listing) => (
										<li key={listing.id} className="grid">
											<JobListingItem
												listing={listing}
												match={matches[listing.id]}
												actions={actions}
												selected={open?.id === listing.id}
												onOpen={() => setSelectedId(listing.id)}
											/>
										</li>
									))}
								</ul>
								{moreFailed && error ? (
									<SearchProblem error={error} onRetry={() => void results.fetchNextPage()} onRestart={restart} />
								) : (
									results.hasNextPage && (
										<Button
											variant="secondary"
											className="justify-self-center"
											isPending={results.isFetchingNextPage}
											onPress={() => void results.fetchNextPage()}
										>
											<Trans>Load more</Trans>
										</Button>
									)
								)}
							</div>
							{wide && open && (
								<aside
									aria-label={t`Job details`}
									className="sticky top-[3.75rem] h-[calc(100svh-4.75rem)] overflow-hidden rounded-2xl border border-separator bg-surface"
								>
									<ListingDetail key={open.id} listing={open} match={matches[open.id]} actions={actions} />
								</aside>
							)}
						</div>
					)}
				</div>
			)}

			<JobListingSheet
				listing={wide ? null : (picked ?? null)}
				matches={matches}
				actions={actions}
				onOpenChange={(isOpen) => !isOpen && setSelectedId(null)}
			/>
			<ScheduleSheet schedule={alertSheet} onScheduleChange={setAlertSheet} onDelete={deleteAlert} search={request} />
		</>
	);
}

type QuotaNoteProps = { used: number; max: number };

/** Today's searches left; a page opened again the same day doesn't count. */
function QuotaNote({ used, max }: QuotaNoteProps) {
	const left = Math.max(max - used, 0);
	return (
		<p className={cn("text-body-sm", left === 0 ? "text-warning-soft-foreground" : "text-muted")} role="status">
			<Plural
				value={left}
				_0={`No searches left today (of ${max})`}
				one={`# search left today (of ${max})`}
				other={`# searches left today (of ${max})`}
			/>
		</p>
	);
}

type FirstSearchProps = { suggestions: string[]; onPick: (query: string) => void };

/** Before the first search: what this is, and the roles from the preferences as one-press searches. */
function FirstSearch({ suggestions, onPick }: FirstSearchProps) {
	return (
		<EmptyBlock
			kind="page"
			icon="list-magnifying-glass"
			title={<Trans>Find jobs that fit</Trans>}
			description={
				<Trans>Search current openings from company careers sites and job boards, then track the ones you like.</Trans>
			}
			action={
				suggestions.length > 0 ? (
					<>
						{suggestions.map((role) => (
							<Button key={role} size="sm" variant="secondary" onPress={() => onPick(role)}>
								<Icon name="magnifying-glass" size={16} />
								{role}
							</Button>
						))}
					</>
				) : (
					<Link to="/dashboard/profile/preferences" className={buttonVariants({ size: "sm", variant: "secondary" })}>
						<Trans>Add the roles you want</Trans>
					</Link>
				)
			}
		/>
	);
}

type RoleSuggestionsProps = { suggestions: string[]; onPick: (query: string) => void };

/** The roles from the preferences as one-press searches, under the recent searches. */
function RoleSuggestions({ suggestions, onPick }: RoleSuggestionsProps) {
	if (suggestions.length === 0) return null;
	return (
		<div className="flex flex-wrap items-center gap-2">
			<p className="text-body-sm text-muted">
				<Trans>From your preferences:</Trans>
			</p>
			{suggestions.map((role) => (
				<Button key={role} size="sm" variant="secondary" onPress={() => onPick(role)}>
					<Icon name="magnifying-glass" size={16} />
					{role}
				</Button>
			))}
		</div>
	);
}

type ResultNotesProps = { result: JobSearchResult; count: number; action?: ReactNode };

/** How many, how fresh, and whether these are saved results because new ones couldn't be fetched just now. */
function ResultNotes({ result, count, action }: ResultNotesProps) {
	const { i18n } = useLingui();
	const updated = formatRelativeTime(result.fetchedAt, i18n.locale);
	return (
		<div className="grid gap-2">
			{(result.budgetLimited || result.stale) && (
				<p role="status" className="flex items-start gap-2 rounded-xl bg-default px-3 py-2 text-body-sm text-muted">
					<Icon name="info" size={18} className="mt-px shrink-0" />
					{result.budgetLimited ? (
						<Trans>New searches are limited right now. These are results saved earlier; try again tomorrow.</Trans>
					) : (
						<Trans>These are results saved earlier. Fresh ones couldn't be loaded just now.</Trans>
					)}
				</p>
			)}
			<div className="flex flex-wrap items-center justify-between gap-2">
				<p className="text-body-sm text-muted" role="status">
					<Plural value={count} one="# job" other="# jobs" /> · <Trans>updated {updated}</Trans>
				</p>
				{action}
			</div>
		</div>
	);
}

type SearchProblemProps = {
	error: unknown;
	/** Asks for the same page again. */
	onRetry: () => void;
	/** Starts the list over from its first page, when a later page can't be continued. */
	onRestart: () => void;
};

/** Why a search gave nothing: the day's searches, the server's budget, too many at once, or the providers. */
function SearchProblem({ error, onRetry, onRestart }: SearchProblemProps) {
	const code = error instanceof ORPCError ? error.code : undefined;
	if (code === "PLAN_LIMIT_REACHED")
		return (
			<Problem
				tone="warning"
				message={
					<Trans>
						You've reached today's search limit. Results you already opened stay available. Try again tomorrow.
					</Trans>
				}
				action={
					<Link to="/dashboard/settings/billing" className={buttonVariants({ size: "sm", variant: "secondary" })}>
						<Trans>See plans</Trans>
					</Link>
				}
			/>
		);
	if (code === "JOBS_BUDGET_LIMITED")
		return (
			<Problem
				tone="muted"
				message={<Trans>New searches are limited right now. Results you already opened stay available.</Trans>}
			/>
		);
	if (code === "BAD_REQUEST")
		return (
			<Problem
				tone="muted"
				message={<Trans>This list can't be continued. Search again to see more jobs.</Trans>}
				action={
					<Button size="sm" variant="secondary" onPress={onRestart}>
						<Trans>Search again</Trans>
					</Button>
				}
			/>
		);
	return (
		<Problem
			tone="danger"
			message={
				code === "RATE_LIMIT_EXCEEDED"
					? getOrpcErrorMessage(error, {
							fallback: t`Too many searches in a short time. Wait a minute, then try again.`,
						})
					: t`Jobs couldn't be loaded. Try again in a moment.`
			}
			action={
				<Button size="sm" variant="secondary" onPress={onRetry}>
					<Trans>Try again</Trans>
				</Button>
			}
		/>
	);
}

type ProblemProps = { tone: "warning" | "danger" | "muted"; message: ReactNode; action?: ReactNode };

function Problem({ tone, message, action }: ProblemProps) {
	return (
		<div
			role="alert"
			className={cn(
				"flex flex-wrap items-center justify-between gap-3 rounded-2xl px-4 py-3 text-body-sm",
				tone === "warning" && "bg-warning-soft text-warning-soft-foreground",
				tone === "danger" && "border border-separator text-danger-soft-foreground",
				tone === "muted" && "bg-default text-muted",
			)}
		>
			<p className="flex min-w-0 flex-1 items-start gap-2">
				<Icon name={tone === "muted" ? "info" : "warning-circle"} size={18} className="mt-px shrink-0" />
				<span>{message}</span>
			</p>
			{action}
		</div>
	);
}

/** Cards in the results' shape while the first page loads. */
function ResultsSkeleton() {
	return (
		<div
			className="grid items-start gap-4 xl:grid-cols-[minmax(18rem,24rem)_minmax(0,1fr)] xl:gap-5"
			aria-busy="true"
			aria-label={t`Loading jobs`}
		>
			<div className="grid gap-2">
				{Array.from({ length: 5 }, (_, index) => (
					<Skeleton key={index} className="h-32 rounded-2xl" />
				))}
			</div>
			<Skeleton className="h-[calc(100svh-4.75rem)] rounded-2xl max-xl:hidden" />
		</div>
	);
}
