// The application workspace (web career/workspace/shell.tsx): a full-screen editor with the bar, the seven parts as
// a tab row, the read-only banner for a saved version, and on tablets the job's context beside the part. The parts
// switch in place (the route is replaced), so Back returns to where the workspace was opened from.
import type { WorkspacePartProps, WorkspaceSearch } from "./part";
import type { WorkspaceTab } from "@rezumi/schema/career";
import { useLingui } from "@lingui/react/macro";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { currentInterview } from "@rezumi/career/workspace";
import { WorkspaceBar } from "./bar";
import { CoachSheet } from "./coach-sheet";
import { ContextColumn } from "./context-column";
import { defaultPart, workspaceHref } from "./part";
import { PartBody } from "./part-body";
import { PartsRow, partBadges } from "./parts-row";
import { useSavedItems, useWorkspace } from "./queries";
import { useOnline } from "@/api/online";
import { applicationError } from "@/features/applications/error";
import { InterviewSheet } from "@/features/applications/interview-sheet";
import { useApplication } from "@/features/applications/queries";
import { useNow } from "@/features/career/hooks";
import { routes } from "@/routes";
import { OfflineStrip } from "@/shell/offline-strip";
import { useIsTablet } from "@/shell/use-is-tablet";
import { EmptyState, Screen, Skeleton, SkeletonGroup } from "@/ui";

type WorkspaceScreenProps = {
	id: string;
	/** The part to show; null opens the one that fits the application's stage. */
	tab: WorkspaceTab | null;
};

export function WorkspaceScreen({ id, tab: requested }: WorkspaceScreenProps) {
	const { t } = useLingui();
	const router = useRouter();
	const params = useLocalSearchParams<{ version?: string; speak?: string; story?: string }>();
	const now = useNow();
	const tablet = useIsTablet();
	const online = useOnline();
	const query = useApplication(id);
	const saved = useSavedItems(id);
	const workspace = useWorkspace(id);
	const [coach, setCoach] = useState(false);
	const [addingInterview, setAddingInterview] = useState(false);
	const application = query.data;
	const back = () => (router.canGoBack() ? router.back() : router.replace(routes.applications()));

	if (!application)
		return (
			<View className="flex-1 bg-background">
				<WorkspaceBar title={t`Application`} application={undefined} onBack={back} onDetails={back} onCoach={back} />
				{query.isPending ? (
					<Screen testID="workspace-loading">
						<SkeletonGroup isLoading variant="none" className="gap-4">
							<Skeleton className="h-10 w-full rounded-xl" />
							<Skeleton className="h-40 w-full rounded-2xl" />
							<Skeleton className="h-24 w-full rounded-2xl" />
						</SkeletonGroup>
					</Screen>
				) : (
					<EmptyState
						kind="page"
						icon="warning-circle"
						title={t`This application couldn't be opened`}
						description={query.error ? applicationError(query.error) : undefined}
						action={{ label: t`Try again`, onPress: () => void query.refetch() }}
						secondaryAction={{ label: t`Back to applications`, onPress: () => router.replace(routes.applications()) }}
					/>
				)}
			</View>
		);

	const tab = requested ?? defaultPart(application, now);
	const interview = currentInterview(application.activity, now);
	const props: WorkspacePartProps = {
		application,
		version: params.version ? saved.data?.find((item) => item.id === params.version) : undefined,
		interview,
		now,
		go: (next: WorkspaceTab, search: WorkspaceSearch = {}) => router.push(workspaceHref(id, next, search)),
		speak: params.speak === "1",
		story: params.story,
		addInterview: () => setAddingInterview(true),
	};

	return (
		<View className="flex-1 bg-background">
			<WorkspaceBar
				title={application.company}
				application={application}
				onBack={back}
				onDetails={() => router.navigate(routes.applicationDetails(id))}
				onCoach={() => setCoach(true)}
			/>
			<PartsRow
				current={tab}
				badges={partBadges(saved.data, interview, now)}
				onChange={(next) => router.replace(workspaceHref(id, next))}
			/>
			{online ? null : <OfflineStrip />}
			<View className="flex-1 flex-row">
				{tablet ? (
					<ContextColumn application={application} interview={interview} now={now} onInterview={props.addInterview} />
				) : null}
				<View className="flex-1">
					<PartBody
						tab={tab}
						props={props}
						saved={saved}
						workspace={workspace}
						archived={params.version !== undefined}
						showNextStep={!tablet}
						backToCurrent={() => router.replace(workspaceHref(id, tab))}
					/>
				</View>
			</View>
			<CoachSheet application={application} tab={tab} isOpen={coach} onOpenChange={setCoach} />
			<InterviewSheet applicationId={id} interview={null} isOpen={addingInterview} onOpenChange={setAddingInterview} />
		</View>
	);
}
