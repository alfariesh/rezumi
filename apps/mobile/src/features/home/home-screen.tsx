// Home (01-desain 4), the app's first tab: what needs the person, new roles from their job alert, the next interview,
// recent documents and their schedules, as on the web's Home. Phones stack the blocks in the web's small-screen order
// (Coming up, Needs you, Recent documents, New roles, Schedules); from 700 pt the web's two columns.
import type { Schedule } from "./queries";
import type { RouterInput } from "@/api/client";
import type { KeyboardAwareScrollViewRef } from "react-native-keyboard-controller";
import { useLingui } from "@lingui/react/macro";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { ComingUp } from "./coming-up";
import { NeedsYou } from "./needs-you";
import { NewRoles } from "./new-roles";
import { useSchedules } from "./queries";
import { RecentDocuments } from "./recent-documents";
import { Schedules } from "./schedules";
import { useHomeTime } from "./time";
import { client, orpc } from "@/api/client";
import { getServer, useSession } from "@/auth/session";
import { useNow } from "@/features/career/hooks";
import { ScheduleSheet } from "@/features/career/schedule-sheet";
import { withUndo } from "@/features/career/undo";
import { useDocuments } from "@/features/documents/queries";
import { useOnboardingRedirect } from "@/features/onboarding/use-onboarding-redirect";
import { routes } from "@/routes";
import { NewFab, TabTopBar } from "@/shell/tab-chrome";
import { useIsTablet } from "@/shell/use-is-tablet";
import { EmptyState, Screen, cx, showToast } from "@/ui";

type Kind = RouterInput["career"]["saveSchedule"]["kind"];
type SheetState = { schedule: Schedule | null; kind: Kind };

const kinds = new Set<string>(["discovery", "prepare", "follow-up"]);

type HomeScreenProps = {
	/** A schedule id, "new" or "new:<kind>" from a link: opens the schedule sheet once schedules are in. */
	schedule?: string | undefined;
};

export function HomeScreen({ schedule }: HomeScreenProps) {
	const { t } = useLingui();
	const router = useRouter();
	const queryClient = useQueryClient();
	const { server } = useSession();
	const tablet = useIsTablet();
	const now = useNow();
	const time = useHomeTime();
	const documents = useDocuments();
	const schedules = useSchedules();
	const [sheet, setSheet] = useState<SheetState | null>(null);
	const [deleted, setDeleted] = useState<string[]>([]);
	const [rolesExpanded, setRolesExpanded] = useState(false);
	const scroll = useRef<KeyboardAwareScrollViewRef>(null);
	const columnY = useRef(0);
	const rolesY = useRef(0);
	const firstRun = documents.data?.length === 0;
	useOnboardingRedirect();

	const openSchedule = (target: Schedule | "new") =>
		setSheet(
			target === "new"
				? { schedule: null, kind: "discovery" }
				: { schedule: target, kind: kinds.has(target.kind) ? (target.kind as Kind) : "discovery" },
		);

	// A link's schedule opens once the list is in; the parameter is then cleared so a refresh doesn't reopen it.
	useEffect(() => {
		if (!schedule || !schedules.data) return;
		if (schedule.startsWith("new")) {
			const kind = schedule.split(":")[1];
			setSheet({ schedule: null, kind: kind && kinds.has(kind) ? (kind as Kind) : "discovery" });
		} else {
			const found = schedules.data.find((row) => row.id === schedule);
			if (found) openSchedule(found);
			else showToast({ title: t`That schedule no longer exists.` });
		}
		router.setParams({ schedule: undefined });
		// oxlint-disable-next-line react-hooks/exhaustive-deps -- runs once per link, when its schedules arrive
	}, [schedule, schedules.data]);

	const deleteSchedule = (id: string) => {
		setDeleted((current) => [...current, id]);
		withUndo({
			message: t`Schedule deleted`,
			restore: () => setDeleted((current) => current.filter((item) => item !== id)),
			failed: () => showToast({ title: t`Couldn't delete this schedule. Try again.`, variant: "danger" }),
			commit: async () => {
				if (getServer() !== server) return;
				await client.career.deleteSchedule({ id });
				await queryClient.invalidateQueries({ queryKey: orpc.career.schedules.key() });
			},
		});
	};

	const reviewRoles = () => {
		setRolesExpanded(true);
		scroll.current?.scrollTo({ y: Math.max(0, columnY.current + rolesY.current - 8), animated: true });
	};

	const refresh = () =>
		Promise.all([
			queryClient.invalidateQueries({ queryKey: orpc.career.key() }),
			queryClient.invalidateQueries({ queryKey: orpc.applications.key() }),
			queryClient.invalidateQueries({ queryKey: orpc.documents.key() }),
			queryClient.invalidateQueries({ queryKey: orpc.portfolio.status.key() }),
		]);

	const comingUp = <ComingUp now={now} time={time} />;
	// A notification's schedule goes through the same parameter as a link, so the effect above opens it.
	const needsYou = (
		<NeedsYou
			now={now}
			time={time}
			onReview={reviewRoles}
			onOpenSchedule={(value) => router.setParams({ schedule: value })}
		/>
	);
	const recent = firstRun ? null : <RecentDocuments />;
	const roles = (
		<NewRoles
			now={now}
			time={time}
			deleted={deleted}
			onOpenSchedule={openSchedule}
			onLayoutY={(y) => (rolesY.current = y)}
			expanded={rolesExpanded}
			onExpand={() => setRolesExpanded(true)}
		/>
	);
	const scheduleList = <Schedules time={time} deleted={deleted} onOpenSchedule={openSchedule} />;

	return (
		<View className="flex-1 bg-background" testID="home-screen">
			<TabTopBar title={t`Home`} />
			<Screen onRefresh={refresh} scrollRef={scroll}>
				{firstRun ? (
					<EmptyState
						kind="page"
						icon="file-arrow-up"
						title={t`Let's start with what you have`}
						description={t`Bring in your LinkedIn, GitHub or resume file and we fill in your Profile, or start a document blank or from a sample.`}
						action={{ label: t`Bring in my details`, onPress: () => router.push(routes.onboarding()) }}
						secondaryAction={{ label: t`Start a document`, onPress: () => router.push(routes.new()) }}
					/>
				) : null}
				<View
					onLayout={(event) => (columnY.current = event.nativeEvent.layout.y)}
					className={cx(tablet ? "flex-row items-start gap-6" : "gap-6")}
				>
					{tablet ? (
						<>
							<View className="flex-1 gap-7">
								{recent}
								{needsYou}
								{roles}
							</View>
							<View className="w-80 gap-5">
								{comingUp}
								{scheduleList}
							</View>
						</>
					) : (
						<>
							{comingUp}
							{needsYou}
							{recent}
							{roles}
							{scheduleList}
						</>
					)}
				</View>
				{/* Room for the floating New button over the last block. */}
				<View className="h-16" />
			</Screen>
			<NewFab />
			{sheet ? (
				<ScheduleSheet
					key={sheet.schedule?.id ?? "new"}
					schedule={sheet.schedule}
					kind={sheet.kind}
					onClose={() => setSheet(null)}
					onDelete={deleteSchedule}
				/>
			) : null}
		</View>
	);
}
