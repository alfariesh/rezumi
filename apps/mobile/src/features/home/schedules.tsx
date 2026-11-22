// Schedules: job alerts, interview preparation and follow-up reminders, each with its next run and a switch. Turning
// one on or off saves at once (optimistic, restored on failure); Edit and Add open the schedule sheet.
import type { Schedule } from "./queries";
import type { HomeTime } from "./time";
import type { RouterInput } from "@/api/client";
import { useLingui } from "@lingui/react/macro";
import { useQueryClient } from "@tanstack/react-query";
import { View } from "react-native";
import { schedulesKey, useSchedules } from "./queries";
import { HomeSection, LoadError, RowsSkeleton } from "./section";
import { client, orpc } from "@/api/client";
import { getServer, useSession } from "@/auth/session";
import { useApplications } from "@/features/applications/queries";
import { scheduleTitle } from "@/features/career/schedule-sheet";
import { rollForward } from "@/features/career/scheduling";
import { Button, EmptyState, Icon, Separator, Switch, Text, showToast } from "@/ui";

type Input = RouterInput["career"]["saveSchedule"];

const KIND_ORDER = ["discovery", "prepare", "follow-up"];

type SchedulesProps = {
	time: HomeTime;
	deleted: readonly string[];
	onOpenSchedule: (schedule: Schedule | "new") => void;
};

export function Schedules({ time, deleted, onOpenSchedule }: SchedulesProps) {
	const { t } = useLingui();
	const queryClient = useQueryClient();
	const { server } = useSession();
	const schedules = useSchedules();
	const applications = useApplications();
	const key = schedulesKey(server);

	const replace = (row: Schedule) =>
		queryClient.setQueryData<Schedule[]>(key, (rows) => rows?.map((item) => (item.id === row.id ? row : item)));

	const toggle = async (row: Schedule, enabled: boolean) => {
		// A finished one-off reminder has nothing left to run: switching it on means picking a new time.
		if (enabled && !row.intervalDays && row.lastQueuedAt && new Date(row.nextRunAt).getTime() <= Date.now())
			return onOpenSchedule(row);
		// Turning a repeating schedule back on starts from its next future run, at the same time of day.
		const nextRunAt =
			enabled && row.intervalDays
				? rollForward(new Date(row.nextRunAt), row.intervalDays, row.timezone)
				: new Date(row.nextRunAt);
		replace({ ...row, enabled, nextRunAt });
		const title = scheduleTitle(row.kind);
		try {
			// `search` is left out on purpose: the server keeps a saved job alert's search when it is (career/jobs.ts).
			const saved = await client.career.saveSchedule({
				id: row.id,
				kind: row.kind as Input["kind"],
				applicationId: row.applicationId,
				query: row.query,
				interviewId: row.interviewId,
				lead: row.lead as Input["lead"],
				enabled,
				email: row.email,
				nextRunAt,
				timezone: row.timezone,
				intervalDays: row.intervalDays,
				aiProviderId: row.aiProviderId,
			});
			if (getServer() !== server) return;
			const next = time.when(saved.nextRunAt);
			showToast({ title: enabled ? t`${title} is on · next ${next}` : t`${title} paused` });
		} catch {
			replace(row);
			showToast({ title: t`Couldn't change this schedule. Try again.`, variant: "danger" });
		} finally {
			void queryClient.invalidateQueries({ queryKey: orpc.career.schedules.key() });
		}
	};

	// A stable order (kind, then newest): an update must not reshuffle rows that share a creation time.
	const rows = schedules.data
		?.filter((row) => !deleted.includes(row.id))
		.toSorted(
			(a, b) =>
				KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind) ||
				new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime() ||
				a.id.localeCompare(b.id),
		);

	const describe = (row: Schedule) => {
		const application = applications.data?.find((item) => item.id === row.applicationId);
		if (row.kind === "discovery") return [row.query, row.search?.location].filter(Boolean).join(" · ");
		if (row.kind === "follow-up") return application ? `${application.company} · ${application.role}` : "";
		return application?.company ?? "";
	};

	const status = (row: Schedule) => {
		const day = time.day(row.nextRunAt);
		if (!row.intervalDays && row.lastQueuedAt) return t`Done · ${day}`;
		let line = time.when(row.nextRunAt);
		if (row.kind === "discovery") {
			const clock = time.time(row.nextRunAt);
			const days = row.intervalDays ?? 1;
			line =
				days === 1
					? t`Daily at ${clock} · next ${day}`
					: days === 7
						? t`Weekly at ${clock} · next ${day}`
						: t`Every ${days} days at ${clock} · next ${day}`;
		} else if (row.kind === "prepare") {
			const lead = row.lead === "2h" ? t`2 hours before` : row.lead === "morning" ? t`Morning of` : t`24 hours before`;
			line = `${lead} · ${line}`;
		}
		return row.enabled ? line : t`Paused · ${line}`;
	};

	return (
		<HomeSection
			title={t`Schedules`}
			icon="clock"
			testID="home-schedules"
			trailing={
				<Button size="sm" variant="ghost" onPress={() => onOpenSchedule("new")}>
					<Icon name="plus" size={16} tone="accent" />
					<Button.Label>{t`Add`}</Button.Label>
				</Button>
			}
		>
			{schedules.isError ? (
				<LoadError onRetry={() => void schedules.refetch()} />
			) : !rows ? (
				<RowsSkeleton />
			) : rows.length === 0 ? (
				<EmptyState
					kind="inline"
					title={t`Nothing scheduled yet.`}
					action={{ label: t`Add`, onPress: () => onOpenSchedule("new") }}
				/>
			) : (
				<View>
					{rows.map((row, index) => {
						const title = scheduleTitle(row.kind);
						const detail = describe(row);
						// Several rows can share a kind: the labels name the row by its detail too.
						const name = detail ? `${title}, ${detail}` : title;
						return (
							<View key={row.id}>
								{index > 0 ? <Separator className="my-3" /> : null}
								<View className="flex-row items-center gap-3">
									<View className="flex-1 gap-0.5">
										<Text weight="semibold">{title}</Text>
										{detail ? (
											<Text tone="muted" numberOfLines={1}>
												{detail}
											</Text>
										) : null}
										<Text size="xs" tone="muted">
											{status(row)}
										</Text>
										<Button
											size="sm"
											variant="ghost"
											className="-ms-3 self-start"
											accessibilityLabel={t`Edit ${name}`}
											onPress={() => onOpenSchedule(row)}
										>
											<Button.Label>{t`Edit`}</Button.Label>
										</Button>
									</View>
									<Switch
										isSelected={row.enabled}
										onSelectedChange={(enabled) => void toggle(row, enabled)}
										accessibilityLabel={name}
									/>
								</View>
							</View>
						);
					})}
				</View>
			)}
		</HomeSection>
	);
}
