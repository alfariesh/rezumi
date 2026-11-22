// New roles from the person's job alert (career opportunities): best matches first, five at a time. Track saves the
// role to Applications with its posting (Undo for ten seconds); Not for me hides it with an Undo toast.
import type { Opportunity, Schedule } from "./queries";
import type { HomeTime } from "./time";
import { useLingui } from "@lingui/react/macro";
import { useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import { openBrowserAsync } from "expo-web-browser";
import { useState } from "react";
import { View } from "react-native";
import { useOpportunities, useSchedules } from "./queries";
import { HomeSection, LoadError, RowTile } from "./section";
import { client, orpc } from "@/api/client";
import { getServer, useSession } from "@/auth/session";
import { withUndo } from "@/features/career/undo";
import { arrangementLabel, salaryLabel } from "@/features/jobs/format";
import { Button, Chip, EmptyState, Icon, Skeleton, Text, Typography, showToast } from "@/ui";

const PAGE = 5;
// expo-image takes no className: the logo fills the 40 pt row tile (RowTile) and keeps its rounding.
const logoFrame = { width: 40, height: 40, borderRadius: 12 };
const UNDO_TRACK_MS = 10_000;

type Tracked = Record<string, { applicationId: string; undoable: boolean }>;

const companyOf = (row: Opportunity) => {
	if (row.company) return row.company;
	try {
		return new URL(row.url).hostname.replace(/^www\./, "");
	} catch {
		return "";
	}
};

type NewRolesProps = {
	now: Date;
	time: HomeTime;
	/** Schedules deleted on Home and waiting for their Undo to expire. */
	deleted: readonly string[];
	onOpenSchedule: (schedule: Schedule | "new") => void;
	/** Reported so "Review" in Needs you can scroll here. */
	onLayoutY?: ((y: number) => void) | undefined;
	expanded: boolean;
	onExpand: () => void;
};

export function NewRoles({ now, time, deleted, onOpenSchedule, onLayoutY, expanded, onExpand }: NewRolesProps) {
	const { t } = useLingui();
	const queryClient = useQueryClient();
	const { server } = useSession();
	const opportunities = useOpportunities();
	const schedules = useSchedules();
	const [hidden, setHidden] = useState<string[]>([]);
	const [tracked, setTracked] = useState<Tracked>({});
	const [pending, setPending] = useState<string | null>(null);
	const refresh = () =>
		Promise.all([
			queryClient.invalidateQueries({ queryKey: orpc.career.opportunities.key() }),
			queryClient.invalidateQueries({ queryKey: orpc.applications.key() }),
		]);

	const track = async (row: Opportunity) => {
		setPending(row.id);
		try {
			const { applicationId } = await client.career.trackOpportunity({ id: row.id });
			if (getServer() !== server) return;
			setTracked((current) => ({ ...current, [row.id]: { applicationId, undoable: true } }));
			setTimeout(
				() =>
					setTracked((current) => {
						const entry = current[row.id];
						return entry ? { ...current, [row.id]: { ...entry, undoable: false } } : current;
					}),
				UNDO_TRACK_MS,
			);
			showToast({ title: t`Saved ${companyOf(row)} to Applications`, variant: "success" });
			void queryClient.invalidateQueries({ queryKey: orpc.applications.key() });
		} catch {
			showToast({ title: t`Couldn't save this role to Applications. Try again.`, variant: "danger" });
		} finally {
			setPending(null);
		}
	};

	const untrack = async (row: Opportunity, applicationId: string) => {
		try {
			await client.applications.delete({ id: applicationId });
			await refresh();
			setTracked((current) => Object.fromEntries(Object.entries(current).filter(([id]) => id !== row.id)));
		} catch {
			showToast({ title: t`Couldn't remove it from Applications. Try again.`, variant: "danger" });
		}
	};

	const dismiss = (row: Opportunity) => {
		setHidden((current) => [...current, row.id]);
		withUndo({
			message: t`Hidden from New roles`,
			restore: () => setHidden((current) => current.filter((id) => id !== row.id)),
			failed: () => showToast({ title: t`Couldn't hide this role. Try again.`, variant: "danger" }),
			commit: async () => {
				if (getServer() !== server) return;
				await client.career.dismissOpportunity({ id: row.id });
				await refresh();
			},
		});
	};

	const rows = opportunities.data;
	const visible = (rows ?? [])
		.filter((row) => !hidden.includes(row.id) && (!row.trackedApplicationId || tracked[row.id]))
		.toSorted(
			(a, b) =>
				b.matches.length - a.matches.length || new Date(b.firstSeenAt).getTime() - new Date(a.firstSeenAt).getTime(),
		);
	const shown = expanded ? visible : visible.slice(0, PAGE);
	const alerts = schedules.data?.filter((row) => row.kind === "discovery" && !deleted.includes(row.id)) ?? [];
	const active = alerts.find((row) => row.enabled) ?? alerts[0];

	const empty = () => {
		if (!active)
			return (
				<EmptyState
					kind="inline"
					title={t`Get new jobs for your search here every morning`}
					action={{ label: t`Set up a job alert`, onPress: () => onOpenSchedule("new") }}
				/>
			);
		if (!active.enabled)
			return (
				<EmptyState
					kind="inline"
					title={t`No new roles. Your job alert is paused.`}
					action={{ label: t`Open the schedule`, onPress: () => onOpenSchedule(active) }}
				/>
			);
		const offset = time.dayOffset(active.nextRunAt, now);
		const clock = time.time(active.nextRunAt);
		const day = time.day(active.nextRunAt);
		return (
			<EmptyState
				kind="inline"
				title={
					offset === 0
						? t`No new roles. Your job alert checks again today at ${clock}.`
						: offset === 1
							? t`No new roles. Your job alert checks again tomorrow at ${clock}.`
							: t`No new roles. Your job alert checks again on ${day} at ${clock}.`
				}
			/>
		);
	};

	const found = (row: Opportunity) => {
		const offset = time.dayOffset(row.firstSeenAt, now);
		const day = time.day(row.firstSeenAt);
		return offset === 0 ? t`Found today` : offset === -1 ? t`Found yesterday` : t`Found ${day}`;
	};

	return (
		<View onLayout={(event) => onLayoutY?.(event.nativeEvent.layout.y)}>
			<HomeSection
				title={t`New roles from your search`}
				icon="globe-simple"
				count={rows ? visible.filter((row) => !tracked[row.id]).length : undefined}
				testID="home-new-roles"
			>
				{opportunities.isError || schedules.isError ? (
					<LoadError
						onRetry={() => {
							void opportunities.refetch();
							void schedules.refetch();
						}}
					/>
				) : !rows || !schedules.data ? (
					<Skeleton variant="none" className="h-32 rounded-xl" />
				) : visible.length === 0 ? (
					empty()
				) : (
					<View className="gap-5">
						{shown.map((row) => (
							<RoleCard
								key={row.id}
								row={row}
								found={found(row)}
								tracked={tracked[row.id]}
								pending={pending === row.id}
								onTrack={() => void track(row)}
								onUndo={(applicationId) => void untrack(row, applicationId)}
								onDismiss={() => dismiss(row)}
							/>
						))}
						{visible.length > shown.length ? (
							<Button size="sm" variant="ghost" className="self-start" onPress={onExpand}>
								<Button.Label>{t`Show ${visible.length - shown.length} more`}</Button.Label>
							</Button>
						) : null}
					</View>
				)}
			</HomeSection>
		</View>
	);
}

type RoleCardProps = {
	row: Opportunity;
	found: string;
	tracked: Tracked[string] | undefined;
	pending: boolean;
	onTrack: () => void;
	onUndo: (applicationId: string) => void;
	onDismiss: () => void;
};

function RoleCard({ row, found, tracked, pending, onTrack, onUndo, onDismiss }: RoleCardProps) {
	const { t, i18n } = useLingui();
	const [logoFailed, setLogoFailed] = useState(false);
	const company = companyOf(row);
	const logo = row.listing?.company.logoUrl;
	const posting = row.listing?.postingUrl ?? row.url;
	const unknownLabels = { salary: t`Salary not listed`, office: t`Office days not stated` };
	// How it's worked and the listed pay, as the web's New roles shows them.
	const listing = row.listing;
	const facts = listing
		? [
				listing.workArrangement ? arrangementLabel(listing.workArrangement) : null,
				salaryLabel(listing.salary, i18n.locale),
			].filter((fact): fact is string => Boolean(fact))
		: [];
	const openPosting = () => {
		if (!/^https?:\/\//i.test(posting)) return;
		void openBrowserAsync(posting).catch(() => showToast({ title: t`Couldn't open the posting. Try again.` }));
	};

	return (
		<View className="flex-row items-start gap-3" testID={`role-${row.id}`}>
			<RowTile>
				{logo && !logoFailed ? (
					<Image
						source={{ uri: logo }}
						contentFit="contain"
						style={logoFrame}
						onError={() => setLogoFailed(true)}
						accessibilityIgnoresInvertColors
					/>
				) : (
					<Text weight="semibold" tone="muted">
						{Array.from(company)[0]?.toLocaleUpperCase() ?? "?"}
					</Text>
				)}
			</RowTile>
			<View className="flex-1 gap-2.5">
				<View className="gap-0.5">
					<Typography.Heading type="h6">{row.role}</Typography.Heading>
					<Typography type="body-sm" className="text-muted">
						{[company, row.location, found].filter(Boolean).join(" · ")}
					</Typography>
				</View>
				{row.snippet ? (
					<Typography type="body-sm" className="text-muted" numberOfLines={3}>
						{row.snippet}
					</Typography>
				) : null}
				{facts.length + row.matches.length + row.unknowns.length > 0 ? (
					<View className="flex-row flex-wrap gap-1.5">
						{facts.map((fact) => (
							<Chip key={fact} size="sm" variant="soft" color="default">
								<Chip.Label>{fact}</Chip.Label>
							</Chip>
						))}
						{row.matches.map((match) => (
							<Chip key={match} size="sm" variant="soft" color="success">
								<Chip.Label>{match}</Chip.Label>
							</Chip>
						))}
						{row.unknowns.map((unknown) => (
							<Chip key={unknown} size="sm" variant="soft" color="warning">
								<Chip.Label>{unknownLabels[unknown]}</Chip.Label>
							</Chip>
						))}
					</View>
				) : null}
				{tracked ? (
					<View className="min-h-8 flex-row items-center gap-2">
						<Icon name="check-circle" size={16} tone="success" />
						<Text tone="success" className="flex-1">
							{t`Saved to Applications with the posting`}
						</Text>
						{tracked.undoable ? (
							<Button size="sm" variant="ghost" onPress={() => onUndo(tracked.applicationId)}>
								<Button.Label>{t`Undo`}</Button.Label>
							</Button>
						) : null}
					</View>
				) : (
					<View className="flex-row flex-wrap items-center gap-2">
						<Button size="sm" variant="secondary" isDisabled={pending} onPress={onTrack}>
							<Icon name="bookmark-simple" size={16} tone="accent" />
							<Button.Label>{t`Track in Applications`}</Button.Label>
						</Button>
						<Button size="sm" variant="ghost" onPress={openPosting}>
							<Button.Label>{t`Read posting`}</Button.Label>
							<Icon name="arrow-square-out" size={16} tone="muted" />
						</Button>
						<Button size="sm" variant="ghost" onPress={onDismiss}>
							<Button.Label>{t`Not for me`}</Button.Label>
						</Button>
					</View>
				)}
			</View>
		</View>
	);
}
