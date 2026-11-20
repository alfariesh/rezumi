import type { JobsSearch } from "./search";
import type { JobListingCard, JobListingMatch, JobSearchResult } from "@rezumi/schema/jobs/search";
import type { ReactNode } from "react";
import { Button, buttonVariants, Skeleton } from "@heroui/react";
import { t } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import { Plural, Trans } from "@lingui/react/macro";
import { ORPCError } from "@orpc/client";
import { useInfiniteQuery, useMutation, useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { Icon } from "@rezumi/ui/components/icon";
import { toast } from "@rezumi/ui/components/toast";
import { cn } from "@rezumi/utils/style";
import { JobListingItem } from "./listing-card";
import { JobListingSheet } from "./listing-sheet";
import { activeFilterCount, sameSearch, startingSearch, toSearchRequest, withoutFilters } from "./search";
import { JobsSearchBar } from "./search-bar";
import { useListingActions } from "./use-listing-actions";
import { EmptyBlock } from "@/components/layout/empty-block";
import { Page } from "@/components/layout/page";
import { PageHeader } from "@/components/layout/page-header";
import { ScheduleSheet } from "@/features/career/schedule-sheet";
import { ExtensionInstallHint } from "@/features/extension/install-links";
import { getOrpcErrorMessage, toastError } from "@/libs/error-message";
import { formatRelativeTime } from "@/libs/locale";
import { orpc } from "@/libs/orpc/client";

type JobsPageProps = {
	/** The search in the address: what was last searched, or nothing yet. */
	search: JobsSearch;
	onSearch: (next: JobsSearch) => void;
};

/**
 * Jobs (`.agents/docs/plans/lowongan/01-desain.md`): search current listings from job data providers with no setup,
 * read one in full, track it as an application, tailor a resume for it, or open the original posting. The form starts
 * from the person's preferences; nothing is searched until they press Search.
 */
export function JobsPage({ search, onSearch }: JobsPageProps) {
	const status = useQuery(orpc.jobs.quota.queryOptions());
	const defaults = useQuery({ ...orpc.jobs.defaults.queryOptions(), enabled: !search.q, staleTime: Infinity });
	// The form's own copy: changing it doesn't search. It starts from the address, or from the preferences once loaded.
	const [draft, setDraft] = useState<JobsSearch | null>(null);
	// Back and forward change the address: the form follows it.
	const [lastSearch, setLastSearch] = useState(search);
	if (lastSearch !== search) {
		setLastSearch(search);
		setDraft(null);
	}
	const form = draft ?? startingSearch(search, defaults.data);
	const [selected, setSelected] = useState<JobListingCard | null>(null);
	// The job alert sheet: "new:discovery" for this search, or the id of the alert that already repeats it.
	const [alertSheet, setAlertSheet] = useState<string | undefined>();
	const schedules = useQuery({ ...orpc.career.schedules.queryOptions({ input: {} }), enabled: Boolean(search.q) });
	const removeAlert = useMutation({
		...orpc.career.deleteSchedule.mutationOptions(),
		onSuccess: () => toast.add({ description: t`Job alert deleted` }),
		onError: (error) => toastError(error, t`Couldn't delete this job alert. Try again.`, { allowServerMessage: true }),
	});

	const request = toSearchRequest(search);
	const alert = schedules.data?.find(
		(schedule) => schedule.kind === "discovery" && schedule.search && sameSearch(schedule.search, request),
	);
	const results = useInfiniteQuery({
		...orpc.jobs.search.infiniteOptions({
			input: (cursor: string | undefined) => ({ ...request, ...(cursor ? { cursor } : {}) }),
			initialPageParam: undefined,
			getNextPageParam: (page) => page.cursor,
		}),
		enabled: search.q.length >= 2,
		// Each search counts toward the day's searches: never again on its own (focus, remount, errors).
		staleTime: 30 * 60_000,
		retry: false,
		refetchOnWindowFocus: false,
	});
	const pages = results.data?.pages ?? [];
	const last: JobSearchResult | undefined = pages.at(-1);
	const tracked = Object.assign({}, ...pages.map((page) => page.tracked)) as Record<string, string>;
	const matches = Object.assign({}, ...pages.map((page) => page.matches)) as Record<string, JobListingMatch>;
	const actions = useListingActions(tracked);
	// One listing can come back on a later page (another provider); show it once.
	const byId = new Map(pages.flatMap((page) => page.listings).map((listing) => [listing.id, listing]));
	const listings = [...byId.values()].filter((listing) => !actions.isHidden(listing.id));

	// The day's searches, from the last answer when there is one (it's newer than the status).
	const quota = last?.quota ?? status.data?.quota;

	const submit = (next: JobsSearch) => {
		setDraft(next);
		setSelected(null);
		onSearch({ ...next, q: next.q.trim(), location: next.location.trim() });
	};

	const { error } = results;
	const unavailable = status.data && !status.data.available;

	return (
		<Page width="default">
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
			) : !search.q ? (
				<FirstSearch suggestions={defaults.data?.suggestions ?? []} onPick={(q) => submit({ ...form, q })} />
			) : (
				<div className="grid gap-4">
					{error && <SearchProblem error={error} onRetry={() => void results.refetch()} />}
					{last && (
						<ResultNotes
							result={last}
							count={listings.length}
							action={
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
						<ul
							className="grid gap-3 lg:grid-cols-2"
							aria-label={t({ message: "Jobs", context: "Job listings to search" })}
						>
							{listings.map((listing) => (
								<li key={listing.id} className="grid">
									<JobListingItem
										listing={listing}
										match={matches[listing.id]}
										actions={actions}
										selected={selected?.id === listing.id}
										onOpen={() => setSelected(listing)}
									/>
								</li>
							))}
						</ul>
					)}
					{results.hasNextPage && listings.length > 0 && (
						<Button
							variant="secondary"
							className="justify-self-center"
							isPending={results.isFetchingNextPage}
							onPress={() => void results.fetchNextPage()}
						>
							<Trans>Load more</Trans>
						</Button>
					)}
				</div>
			)}

			<JobListingSheet
				listing={selected}
				matches={matches}
				actions={actions}
				onOpenChange={(open) => !open && setSelected(null)}
			/>
			<ScheduleSheet
				schedule={alertSheet}
				onScheduleChange={setAlertSheet}
				onDelete={(id) => removeAlert.mutate({ id })}
				search={request}
			/>
		</Page>
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

type SearchProblemProps = { error: unknown; onRetry: () => void };

/** Why a search gave nothing: the day's searches, the server's budget, too many at once, or the providers. */
function SearchProblem({ error, onRetry }: SearchProblemProps) {
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
			<Problem tone="muted" message={<Trans>This list can't be continued. Search again to see more jobs.</Trans>} />
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
		<div className="grid gap-3 lg:grid-cols-2" aria-busy="true" aria-label={t`Loading jobs`}>
			{Array.from({ length: 6 }, (_, index) => (
				<Skeleton key={index} className="h-44 rounded-2xl" />
			))}
		</div>
	);
}
