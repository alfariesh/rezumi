// Above the results: today's searches left, the search, why the last one failed, and how many jobs, how fresh, with
// the job alert for this search and the recent searches.
import type { useJobs } from "./use-jobs";
import type { Schedule } from "@/features/home/queries";
import type { JobsSearch } from "@rezumi/career/jobs";
import { plural } from "@lingui/core/macro";
import { useLingui } from "@lingui/react/macro";
import { View } from "react-native";
import { updatedAgo } from "./format";
import { RecentSearchesButton } from "./recent-searches";
import { SearchBar } from "./search-bar";
import { Notice, SearchProblem } from "./search-problem";
import { useNow } from "@/features/career/hooks";
import { Button, Icon, Text } from "@/ui";

type Jobs = ReturnType<typeof useJobs>;

type JobsHeaderProps = {
	jobs: Jobs;
	/** The job alert that repeats this search, if any. */
	alert: Schedule | null;
	onOpenAlert: () => void;
	onSubmit: (next: JobsSearch) => void;
};

export function JobsHeader({ jobs, alert, onOpenAlert, onSubmit }: JobsHeaderProps) {
	const { t } = useLingui();
	const now = useNow();
	const status = jobs.quota.data;
	if (status && !status.available) return null;
	const quota = status?.quota;
	const left = quota ? Math.max(quota.max - quota.used, 0) : null;
	const { results, last } = jobs;
	const error = results.error;
	const moreFailed = results.isFetchNextPageError;
	const count = jobs.listings.length;

	return (
		<View className="gap-3 pb-1">
			{quota && left !== null ? (
				<Text size="sm" tone={left === 0 ? "warning" : "muted"} accessibilityRole="text" testID="jobs-quota">
					{left === 0
						? t`No searches left today (of ${quota.max})`
						: plural(left, {
								one: `# search left today (of ${quota.max})`,
								other: `# searches left today (of ${quota.max})`,
							})}
				</Text>
			) : null}
			<SearchBar
				value={jobs.form}
				onChange={jobs.setDraft}
				onSearch={() => onSubmit(jobs.form)}
				searching={results.isFetching && !results.isFetchingNextPage}
			/>
			{error && !moreFailed ? (
				<SearchProblem error={error} onRetry={() => void results.refetch()} onRestart={jobs.restart} />
			) : null}
			{jobs.offlineCopy ? (
				<Notice
					status="accent"
					message={t`You're offline. These are the results you saw last; search again when you're back online.`}
					testID="jobs-offline-copy"
				/>
			) : null}
			{last && (last.budgetLimited || last.stale) ? (
				<Notice
					status="default"
					message={
						last.budgetLimited
							? t`New searches are limited right now. These are results saved earlier; try again tomorrow.`
							: t`These are results saved earlier. Fresh ones couldn't be loaded just now.`
					}
				/>
			) : null}
			{last && (jobs.search || jobs.offlineCopy) ? (
				<View className="gap-1">
					<Text size="sm" tone="muted" testID="jobs-count">
						{`${plural(count, { one: "# job", other: "# jobs" })} · ${updatedAgo(last.fetchedAt, now)}`}
					</Text>
					<View className="flex-row flex-wrap items-center justify-end gap-2">
						<RecentSearchesButton recent={jobs.recent} onOpen={onSubmit} />
						{jobs.search ? (
							<Button
								size="sm"
								variant={alert?.enabled ? "ghost" : "secondary"}
								onPress={onOpenAlert}
								testID="jobs-alert"
							>
								<Icon
									name={alert?.enabled ? "check-circle" : "bell"}
									size={16}
									tone={alert?.enabled ? "success" : "accent"}
								/>
								<Button.Label>
									{alert?.enabled ? t`Job alert on` : alert ? t`Job alert paused` : t`Get job alerts`}
								</Button.Label>
							</Button>
						) : null}
					</View>
				</View>
			) : null}
		</View>
	);
}
