// What Jobs shows when there are no cards: job search not on this server, today's last search coming back, the start
// (recent searches and the roles from the preferences), the first page loading, no match, or offline with nothing
// kept. Under the cards: Load more, or why the next page failed.
import type { useJobs } from "./use-jobs";
import type { JobsSearch } from "@rezumi/career/jobs";
import { useLingui } from "@lingui/react/macro";
import { useRouter } from "expo-router";
import { View } from "react-native";
import { activeFilterCount, withoutFilters } from "@rezumi/career/jobs";
import { RecentSearchesCard } from "./recent-searches";
import { SearchProblem } from "./search-problem";
import { routes } from "@/routes";
import { Button, EmptyState, Icon, Skeleton, Text } from "@/ui";

type Jobs = ReturnType<typeof useJobs>;

type JobsBodyProps = { jobs: Jobs; onSearch: (next: JobsSearch) => void; onSaveJob: () => void };

export function JobsBody({ jobs, onSearch, onSaveJob }: JobsBodyProps) {
	const { t } = useLingui();
	const { quota, results, search, recent } = jobs;
	if (quota.data && !quota.data.available)
		return (
			<EmptyState
				kind="page"
				icon="list-magnifying-glass"
				title={t`Job search isn't available here yet`}
				description={t`You can still save jobs from a link, from pasted text, or with the browser extension.`}
				action={{ label: t`Save a job`, onPress: onSaveJob }}
			/>
		);
	if (jobs.resuming) return <ResultsSkeleton />;
	if (!search && !jobs.offlineCopy) {
		if (!jobs.online)
			return (
				<EmptyState
					kind="page"
					icon="cloud-slash"
					title={t`You're offline`}
					description={t`Job search needs a connection. Your recent results show here once you've searched.`}
				/>
			);
		const suggestions = jobs.defaults.data?.suggestions ?? [];
		const pick = (q: string) => onSearch({ ...jobs.form, q });
		return (
			<View className="gap-4">
				<RecentSearchesCard recent={recent} onOpen={onSearch} />
				{recent.searches?.length ? (
					<RoleSuggestions suggestions={suggestions} onPick={pick} />
				) : recent.isPending ? null : (
					<FirstSearch suggestions={suggestions} onPick={pick} />
				)}
			</View>
		);
	}
	if (results.isPending && !jobs.offlineCopy) return results.isError ? null : <ResultsSkeleton />;
	if (results.error) return null;
	return (
		<EmptyState
			kind="filtered"
			title={t`No jobs match yet.`}
			description={t`Try a longer posting window, fewer filters or other words. For local job boards, save jobs with the browser extension.`}
			action={
				search && activeFilterCount(search) > 0
					? { label: t`Clear filters`, onPress: () => onSearch(withoutFilters(search)) }
					: undefined
			}
		/>
	);
}

type JobsFooterProps = { jobs: Jobs };

export function JobsFooter({ jobs }: JobsFooterProps) {
	const { t } = useLingui();
	const { results } = jobs;
	if (jobs.offlineCopy) return null;
	if (results.isFetchNextPageError && results.error)
		return (
			<SearchProblem error={results.error} onRetry={() => void results.fetchNextPage()} onRestart={jobs.restart} />
		);
	if (!results.hasNextPage) return null;
	return (
		<Button
			variant="secondary"
			className="self-center"
			isDisabled={results.isFetchingNextPage}
			onPress={() => void results.fetchNextPage()}
			testID="jobs-more"
		>
			<Button.Label>{results.isFetchingNextPage ? t`Loading more…` : t`Load more`}</Button.Label>
		</Button>
	);
}

type SuggestionsProps = { suggestions: string[]; onPick: (query: string) => void };

/** Before the first search: what this is, and the roles from the preferences as one-press searches. */
function FirstSearch({ suggestions, onPick }: SuggestionsProps) {
	const { t } = useLingui();
	const router = useRouter();
	return (
		<View className="gap-2">
			<EmptyState
				kind="page"
				icon="list-magnifying-glass"
				title={t`Find jobs that fit`}
				description={t`Search current openings from company careers sites and job boards, then track the ones you like.`}
				action={
					suggestions.length === 0
						? { label: t`Add the roles you want`, onPress: () => router.push(routes.profile("preferences")) }
						: undefined
				}
			/>
			<SuggestionButtons suggestions={suggestions} onPick={onPick} />
		</View>
	);
}

/** The roles from the preferences as one-press searches, under the recent searches. */
function RoleSuggestions({ suggestions, onPick }: SuggestionsProps) {
	const { t } = useLingui();
	if (suggestions.length === 0) return null;
	return (
		<View className="gap-2">
			<Text size="sm" tone="muted">{t`From your preferences:`}</Text>
			<SuggestionButtons suggestions={suggestions} onPick={onPick} />
		</View>
	);
}

function SuggestionButtons({ suggestions, onPick }: SuggestionsProps) {
	return (
		<View className="flex-row flex-wrap justify-center gap-2">
			{suggestions.map((role) => (
				<Button
					key={role}
					size="sm"
					variant="secondary"
					onPress={() => onPick(role)}
					testID={`jobs-suggestion-${role}`}
				>
					<Icon name="magnifying-glass" size={16} tone="accent" />
					<Button.Label>{role}</Button.Label>
				</Button>
			))}
		</View>
	);
}

/** Cards in the results' shape while the first page loads. */
function ResultsSkeleton() {
	const { t } = useLingui();
	return (
		<View className="gap-3" accessibilityLabel={t`Loading jobs`} testID="jobs-loading">
			{Array.from({ length: 4 }, (_, index) => (
				<Skeleton key={index} className="h-32 rounded-3xl" variant="none" />
			))}
		</View>
	);
}
