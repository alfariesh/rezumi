// Needs you: unread notifications (new roles, follow-up drafts, finished briefings, closed postings, failed schedules),
// each with its action, marked read with an Undo toast. Read ones come back with "Show read".
import type { Notification } from "./queries";
import type { HomeTime } from "./time";
import type { AppHref } from "@/routes";
import type { IconName, ThemeColor } from "@/ui";
import { useLingui } from "@lingui/react/macro";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { useNotifications } from "./queries";
import { HomeSection, LoadError, RowTile, RowsSkeleton } from "./section";
import { client, orpc } from "@/api/client";
import { getServer, useSession } from "@/auth/session";
import { useApplications } from "@/features/applications/queries";
import { withUndo } from "@/features/career/undo";
import { parseDeepLink } from "@/linking/parse";
import { routes } from "@/routes";
import { Button, EmptyState, Icon, IconButton, Text, Typography, showToast } from "@/ui";

type Kind = { icon: IconName; tone: ThemeColor; action: string };

type NeedsYouProps = {
	now: Date;
	time: HomeTime;
	onReview: () => void;
	/** A notification's schedule link (an id, "new" or "new:<kind>"): Home opens its sheet in place. */
	onOpenSchedule: (schedule: string) => void;
};

/** Where a notification's action goes: an app screen, or a schedule's sheet on this Home. */
type Target = { href: AppHref } | { schedule: string };

/** `/home?schedule=<id>` from the deep-link map: the schedule, decoded. */
const homeSchedule = /^\/home\?schedule=([^&#]+)$/;

export function NeedsYou({ now, time, onReview, onOpenSchedule }: NeedsYouProps) {
	const { t } = useLingui();
	const router = useRouter();
	const queryClient = useQueryClient();
	const { server } = useSession();
	const notifications = useNotifications();
	const applications = useApplications();
	const [showRead, setShowRead] = useState(false);
	const key = [...orpc.career.notifications.key(), server];

	const kindOf = (type: Notification["notice"]["type"]): Kind => {
		if (type === "opportunities") return { icon: "globe-simple", tone: "accent", action: t`Review` };
		if (type === "followup") return { icon: "envelope", tone: "warning", action: t`Review draft` };
		if (type === "briefing") return { icon: "clipboard-text", tone: "success", action: t`Open briefing` };
		return { icon: "info", tone: "warning", action: t`Open` };
	};

	const setReadAt = (id: string, readAt: Date | null) =>
		queryClient.setQueryData<Notification[]>(key, (rows) =>
			rows?.map((row) => (row.id === id ? { ...row, readAt } : row)),
		);

	// The row (and the tab badge) drops at once; the server hears about it when the Undo toast closes.
	const markRead = (row: Notification) => {
		setReadAt(row.id, new Date());
		withUndo({
			message: t`Marked as read`,
			restore: () => setReadAt(row.id, null),
			failed: () => showToast({ title: t`Couldn't mark this as read. Try again.`, variant: "danger" }),
			commit: async () => {
				if (getServer() !== server) return;
				await client.career.markNotificationRead({ id: row.id });
				await queryClient.invalidateQueries({ queryKey: key });
			},
		});
	};

	// In-app paths only (the server writes `/dashboard/...`); the deep-link map turns them into app screens. Home is
	// this screen: its schedule links open the sheet here instead of pushing a second Home, and bare Home links do
	// nothing.
	const targetOf = (row: Notification): Target | null => {
		if (!row.url || !/^\/(?!\/)/.test(row.url)) return null;
		const link = parseDeepLink(row.url, getServer());
		if (link?.kind !== "target" || link.href === routes.home()) return null;
		const schedule = homeSchedule.exec(link.href)?.[1];
		return schedule === undefined ? { href: link.href } : { schedule: decodeURIComponent(schedule) };
	};
	const open = (target: Target) => {
		if ("schedule" in target) onOpenSchedule(target.schedule);
		else router.push(target.href);
	};

	const companies = new Map(applications.data?.map((application) => [application.id, application.company]));
	// Hermes has no Intl.RelativeTimeFormat: the three relative days are translated strings.
	const relativeDay = (offset: number) => (offset === 0 ? t`Today` : offset < 0 ? t`Yesterday` : t`Tomorrow`);
	const meta = (row: Notification) => {
		const source =
			row.notice.type === "opportunities"
				? t`Job alert`
				: row.notice.type === "briefing"
					? t`Interview preparation`
					: row.applicationId
						? companies.get(row.applicationId)
						: undefined;
		const offset = time.dayOffset(row.createdAt, now);
		const stamp = offset === null ? time.when(row.createdAt) : `${relativeDay(offset)}, ${time.time(row.createdAt)}`;
		return [source, stamp].filter(Boolean).join(" · ");
	};

	const data = notifications.data;
	const unread = data?.filter((row) => !row.readAt) ?? [];
	const read = data?.filter((row) => row.readAt) ?? [];
	const rows = showRead ? (data ?? []) : unread;

	return (
		<HomeSection title={t`Needs you`} icon="tray" count={data ? unread.length : undefined} testID="home-needs-you">
			{notifications.isError ? (
				<LoadError onRetry={() => void notifications.refetch()} />
			) : !data ? (
				<RowsSkeleton />
			) : rows.length === 0 ? (
				<EmptyState
					kind="inline"
					title={t`You're up to date. New roles, reminders and finished briefings appear here.`}
					action={
						read.length > 0
							? {
									label: t`Show ${read.length} read`,
									onPress: () => setShowRead(true),
								}
							: undefined
					}
				/>
			) : (
				<View className="gap-4">
					{rows.map((row) => {
						const kind = kindOf(row.notice.type);
						const target = targetOf(row);
						const actionable = row.notice.type === "opportunities" || target !== null;
						return (
							<View key={row.id} className="flex-row items-start gap-3" testID={`notification-${row.id}`}>
								<RowTile>
									<Icon name={kind.icon} tone={kind.tone} />
								</RowTile>
								<View className="flex-1 gap-2">
									<View className="gap-0.5">
										<Typography.Heading type="h6" className="text-sm">
											{row.title}
										</Typography.Heading>
										<Typography type="body-sm" className="text-muted" numberOfLines={3}>
											{row.body}
										</Typography>
										<Text size="xs" tone="muted">
											{meta(row)}
										</Text>
									</View>
									{actionable ? (
										<Button
											size="sm"
											variant="secondary"
											className="self-start"
											onPress={() => (row.notice.type === "opportunities" ? onReview() : target && open(target))}
										>
											<Button.Label>{kind.action}</Button.Label>
										</Button>
									) : null}
								</View>
								{row.readAt ? null : (
									<IconButton icon="check" label={t`Mark as read`} size="sm" onPress={() => markRead(row)} />
								)}
							</View>
						);
					})}
					{showRead ? (
						<Button size="sm" variant="ghost" className="self-start" onPress={() => setShowRead(false)}>
							<Button.Label>{t`Hide read`}</Button.Label>
						</Button>
					) : null}
				</View>
			)}
		</HomeSection>
	);
}
