// Jobs, a view of Applications (plans/mobile Phase 09; the web's jobs-page.tsx, lowongan 01-desain): search current
// listings from job data providers with no setup, read one in full, check your fit, track it as an application,
// tailor a resume for it, or open the original posting. Phones open a listing in a sheet; tablets read it beside the
// results. Nothing that would use one of the day's searches runs until the person presses Search.
import type { Schedule } from "@/features/home/queries";
import type { JobListingCard } from "@rezumi/schema/jobs/search";
import { useLingui } from "@lingui/react/macro";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useRef, useState } from "react";
import { FlatList, View } from "react-native";
import { sameSearch } from "@rezumi/career/jobs";
import { JobsHeader } from "./jobs-header";
import { JobsBody, JobsFooter } from "./jobs-states";
import { ListingCard } from "./listing-card";
import { ListingPane, ListingSheet } from "./listing-detail";
import { useJobs } from "./use-jobs";
import { useListingActions } from "./use-listing-actions";
import { client, orpc } from "@/api/client";
import { getServer, useSession } from "@/auth/session";
import { ApplicationsViewsRow } from "@/features/applications-board/views-row";
import { AddApplicationSheet } from "@/features/applications/add-sheet";
import { useNow } from "@/features/career/hooks";
import { ScheduleSheet } from "@/features/career/schedule-sheet";
import { withUndo } from "@/features/career/undo";
import { useSchedules } from "@/features/home/queries";
import { routes } from "@/routes";
import { TabTopBar } from "@/shell/tab-chrome";
import { useIsTablet } from "@/shell/use-is-tablet";
import { showToast } from "@/ui";

export function JobsScreen() {
	const { t } = useLingui();
	const queryClient = useQueryClient();
	const { server } = useSession();
	const tablet = useIsTablet();
	const now = useNow();
	const jobs = useJobs();
	const router = useRouter();
	const [selectedId, setSelectedId] = useState<string | null>(null);
	// New → Copy for a job waits for the listing's sheet to finish closing (iOS drops a presentation made over it).
	const afterSheet = useRef<string | null>(null);
	const actions = useListingActions(jobs.tracked, {
		onTailor: (applicationId) => {
			const href = routes.newCopyForJob(applicationId);
			if (!tablet && selectedId) {
				afterSheet.current = href;
				setSelectedId(null);
			} else router.push(href);
		},
	});
	const [alertSheet, setAlertSheet] = useState<{ schedule: Schedule | null } | null>(null);
	const [adding, setAdding] = useState(false);
	const [deletedAlerts, setDeletedAlerts] = useState<string[]>([]);
	const schedules = useSchedules();
	const alert = jobs.request
		? schedules.data?.find(
				(schedule) =>
					schedule.kind === "discovery" &&
					schedule.search &&
					!deletedAlerts.includes(schedule.id) &&
					sameSearch(schedule.search, jobs.request ?? { query: "" }),
			)
		: undefined;

	const listings = jobs.listings.filter((listing) => !actions.isHidden(listing.id));
	const picked = listings.find((listing) => listing.id === selectedId);
	const open: JobListingCard | undefined = picked ?? (tablet ? listings[0] : undefined);

	const deleteAlert = (id: string) => {
		setDeletedAlerts((current) => [...current, id]);
		withUndo({
			message: t`Job alert deleted`,
			restore: () => setDeletedAlerts((current) => current.filter((item) => item !== id)),
			failed: () => showToast({ title: t`Couldn't delete this job alert. Try again.`, variant: "danger" }),
			commit: async () => {
				if (getServer() !== server) return;
				await client.career.deleteSchedule({ id });
				await queryClient.invalidateQueries({ queryKey: orpc.career.schedules.key() });
			},
		});
	};

	const header = (
		<JobsHeader
			jobs={jobs}
			alert={alert ?? null}
			onOpenAlert={() => setAlertSheet({ schedule: alert ?? null })}
			onSubmit={(next) => {
				setSelectedId(null);
				jobs.submit(next);
			}}
		/>
	);
	const list = (
		<FlatList
			data={listings}
			keyExtractor={(listing) => listing.id}
			renderItem={({ item }) => (
				<ListingCard
					listing={item}
					match={jobs.matches[item.id]}
					actions={actions}
					selected={tablet && open?.id === item.id}
					now={now}
					onOpen={() => setSelectedId(item.id)}
				/>
			)}
			ListHeaderComponent={header}
			ListEmptyComponent={<JobsBody jobs={jobs} onSearch={jobs.submit} onSaveJob={() => setAdding(true)} />}
			ListFooterComponent={listings.length > 0 ? <JobsFooter jobs={jobs} /> : undefined}
			contentContainerClassName="gap-3 p-4 pb-12"
			keyboardShouldPersistTaps="handled"
			keyboardDismissMode="on-drag"
			accessibilityLabel={t({ message: "Jobs", context: "Job listings to search" })}
			testID="jobs-list"
		/>
	);

	return (
		<View className="flex-1 bg-background">
			<TabTopBar title={t`Applications`} />
			<ApplicationsViewsRow current="jobs" />
			{tablet ? (
				<View className="flex-1 flex-row gap-4 pe-4">
					<View className="w-2/5 max-w-[420px] min-w-[300px]">{list}</View>
					<View className="flex-1 py-4">
						{open ? <ListingPane listing={open} match={jobs.matches[open.id]} actions={actions} now={now} /> : null}
					</View>
				</View>
			) : (
				list
			)}
			<ListingSheet
				listing={tablet ? null : (picked ?? null)}
				match={picked ? jobs.matches[picked.id] : undefined}
				actions={actions}
				now={now}
				onClose={() => setSelectedId(null)}
				onDidDismiss={() => {
					const href = afterSheet.current;
					afterSheet.current = null;
					if (href) router.push(href);
				}}
			/>
			{alertSheet ? (
				<ScheduleSheet
					key={alertSheet.schedule?.id ?? "new"}
					schedule={alertSheet.schedule}
					kind="discovery"
					search={jobs.request ?? undefined}
					onClose={() => setAlertSheet(null)}
					onDelete={deleteAlert}
				/>
			) : null}
			{adding ? <AddApplicationSheet onClose={() => setAdding(false)} /> : null}
		</View>
	);
}
