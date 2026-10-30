import type { Kind, Lead, Schedule } from "./schedule-sheet";
import type { RouterOutput } from "@/libs/orpc/client";
import type { IconName } from "@rezumi/ui/components/icon";
import type { Ref } from "react";
import { EmptyState } from "@heroui-pro/react";
import { Button, buttonVariants, Chip, Skeleton, Spinner, Switch } from "@heroui/react";
import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useRouter } from "@tanstack/react-router";
import { AnimatePresence } from "motion/react";
import { useRef, useState } from "react";
import { Icon } from "@rezumi/ui/components/icon";
import { IconButton } from "@rezumi/ui/components/icon-button";
import { toast } from "@rezumi/ui/components/toast";
import { getInitials } from "@rezumi/utils/string";
import { cn } from "@rezumi/utils/style";
import { CareerLoadError } from "./load-state";
import { rollForward, ScheduleSheet, scheduleKind } from "./schedule-sheet";
import {
	CareerWidget,
	CollapseRow,
	CountdownChip,
	flash,
	InfoChip,
	Swap,
	useCareerTime,
	useNow,
	withUndo,
} from "./shared";
import { RowIcon, RowSeparator } from "@/components/layout/icon-row";
import {
	collectInterviews,
	formatDuration,
	interviewKindOf,
	upcomingInterviews,
} from "@/features/applications/interviews";
import { applicationsListQueryOptions } from "@/features/applications/queries";
import { toastError } from "@/libs/error-message";
import { orpc } from "@/libs/orpc/client";

type Notification = RouterOutput["career"]["notifications"][number];
type Opportunity = RouterOutput["career"]["opportunities"][number];

type TodayPageProps = { schedule: string | undefined; onScheduleChange: (schedule: string | undefined) => void };

/**
 * Career → Today: what needs you, roles found by discovery, the next interview and the schedules that produce them.
 * Below 1024px it's one column: Coming up, Needs you, New roles, Schedules.
 */
export function TodayPage({ schedule, onScheduleChange }: TodayPageProps) {
	const now = useNow();
	const rolesRef = useRef<HTMLDivElement>(null);
	// Deleted schedules stay hidden locally until the Undo toast closes; any mutation refetches every query.
	const [deleted, setDeleted] = useState<string[]>([]);
	const remove = useMutation({
		...orpc.career.deleteSchedule.mutationOptions(),
		onError: (error, { id }) => {
			setDeleted((current) => current.filter((item) => item !== id));
			toastError(error, t`Couldn't delete this schedule. Try again.`, { allowServerMessage: true });
		},
	});
	const deleteSchedule = (id: string) => {
		setDeleted((current) => [...current, id]);
		withUndo({
			description: t`Schedule deleted`,
			commit: () => remove.mutate({ id }),
			onUndo: () => setDeleted((current) => current.filter((item) => item !== id)),
		});
	};

	const reviewRoles = () => {
		const section = rolesRef.current;
		if (!section) return;
		for (const card of section.querySelectorAll("[data-role-card]")) flash(card);
		// Last, so the section heading wins over each card's own scroll.
		const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
		section.scrollIntoView({ block: "start", behavior: reduce ? "auto" : "smooth" });
	};

	return (
		<div className="flex flex-col gap-6 lg:grid lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start xl:grid-cols-[minmax(0,1fr)_380px]">
			<div className="contents lg:flex lg:min-w-0 lg:flex-col lg:gap-7">
				<NeedsYou now={now} onReview={reviewRoles} className="order-2 lg:order-none" />
				<NewRoles
					ref={rolesRef}
					now={now}
					deleted={deleted}
					onOpenSchedule={onScheduleChange}
					className="order-3 scroll-mt-6 lg:order-none"
				/>
			</div>
			<div className="contents lg:flex lg:flex-col lg:gap-[18px]">
				<ComingUp now={now} className="order-1 lg:order-none" />
				<Schedules deleted={deleted} onOpenSchedule={onScheduleChange} className="order-4 lg:order-none" />
			</div>
			<ScheduleSheet schedule={schedule} onScheduleChange={onScheduleChange} onDelete={deleteSchedule} />
		</div>
	);
}

// ---- Shared bits ----

/** 0 for today, -1 for yesterday, 1 for tomorrow (in the account timezone), otherwise null. */
function useDayOffset() {
	const { format } = useCareerTime();
	return (value: Date | string, now: Date) => {
		const key = (date: Date | string) => format(date, { dateStyle: "short" });
		const day = key(value);
		for (const offset of [0, -1, 1]) if (key(new Date(now.getTime() + offset * 86_400_000)) === day) return offset;
		return null;
	};
}

// ---- Needs you ----

/** The icon keeps the meaning (colour and glyph); its tile stays neutral. */
const notificationKind = (kind: Notification["notice"]["type"]): { icon: IconName; tone: string; action: string } => {
	if (kind === "opportunities") return { icon: "globe-simple", tone: "text-accent", action: t`Review` };
	if (kind === "followup") return { icon: "envelope", tone: "text-warning", action: t`Review draft` };
	if (kind === "briefing") return { icon: "clipboard-text", tone: "text-success", action: t`Open briefing` };
	return { icon: "info", tone: "text-warning", action: t`Open` };
};

type NeedsYouProps = { now: Date; onReview: () => void; className?: string };

function NeedsYou({ now, onReview, className }: NeedsYouProps) {
	const queryClient = useQueryClient();
	const router = useRouter();
	const { time, when, locale } = useCareerTime();
	const dayOffset = useDayOffset();
	const queryKey = orpc.career.notifications.queryKey({ input: {} });
	const { data, isError, refetch } = useQuery(orpc.career.notifications.queryOptions({ input: {} }));
	const applicationQuery = useQuery(applicationsListQueryOptions());
	const applications = applicationQuery.data;
	const [showRead, setShowRead] = useState(false);
	const [pending, setPending] = useState<string[]>([]);
	const setReadAt = (id: string, readAt: Date | null) =>
		queryClient.setQueryData(queryKey, (current) => current?.map((row) => (row.id === id ? { ...row, readAt } : row)));
	const markRead = useMutation({
		...orpc.career.markNotificationRead.mutationOptions(),
		onError: (error, { id }) => {
			setPending((current) => current.filter((item) => item !== id));
			setReadAt(id, null);
			toastError(error, t`Couldn't mark this as read. Try again.`, { allowServerMessage: true });
		},
	});

	const isUnread = (row: Notification) => !row.readAt && !pending.includes(row.id);
	const unread = data?.filter(isUnread) ?? [];
	const read = data?.filter((row) => !isUnread(row)) ?? [];
	const rows = showRead ? (data ?? []) : unread;

	// Hidden at once; the server hears about it when the toast closes. The cache edit drops the sidebar count too,
	// while `pending` keeps the row hidden through any refetch.
	const dismiss = (row: Notification) => {
		setPending((current) => [...current, row.id]);
		setReadAt(row.id, new Date());
		withUndo({
			description: t`Marked as read`,
			commit: () => markRead.mutate({ id: row.id }),
			onUndo: () => {
				setPending((current) => current.filter((id) => id !== row.id));
				setReadAt(row.id, null);
			},
		});
	};

	// One lookup table and one formatter per render, not a scan and a constructor per row.
	const companies = new Map(applications?.map((application) => [application.id, application.company]));
	const relativeDay = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
	const meta = (row: Notification) => {
		const source =
			row.notice.type === "opportunities"
				? t`Opportunity discovery`
				: row.notice.type === "briefing"
					? t`Interview preparation`
					: row.applicationId
						? companies.get(row.applicationId)
						: undefined;
		const offset = dayOffset(row.createdAt, now);
		const stamp =
			offset === null ? when(row.createdAt) : `${relativeDay.format(offset, "day")}, ${time(row.createdAt)}`;
		return [source, stamp].filter(Boolean).join(" · ");
	};

	const act = (row: Notification) => {
		if (row.notice.type === "opportunities") onReview();
		else if (row.url) router.history.push(row.url);
	};

	return (
		<CareerWidget title={t`Needs you`} icon="tray" count={data ? unread.length : undefined} className={className}>
			{isError || applicationQuery.isError ? (
				<CareerLoadError
					onRetry={() => {
						void refetch();
						void applicationQuery.refetch();
					}}
				/>
			) : !data ? (
				<Skeleton className="h-32 rounded-xl" />
			) : (
				<Swap id={rows.length > 0 ? "list" : "empty"}>
					{rows.length > 0 ? (
						<div role="list">
							<AnimatePresence initial={false}>
								{rows.map((row, index) => {
									const kind = notificationKind(row.notice.type);
									// Only in-app paths: notifications link into the app, never elsewhere.
									const actionable = row.notice.type === "opportunities" || /^\/(?!\/)/.test(row.url ?? "");
									return (
										<CollapseRow key={row.id} role="listitem">
											{index > 0 && <RowSeparator />}
											<div
												role="group"
												aria-labelledby={`note-${row.id}`}
												// Off-screen rows skip layout and paint; they stay findable and readable.
												className={cn(
													"flex items-start gap-3 [contain-intrinsic-size:auto_96px] [content-visibility:auto]",
													index > 0 && "pt-3",
													index < rows.length - 1 && "pb-3",
												)}
											>
												<RowIcon className={kind.tone}>
													<Icon name={kind.icon} size={20} />
												</RowIcon>
												<div className="flex min-w-0 flex-1 flex-wrap items-start gap-x-3 gap-y-2">
													<div className="grid min-w-0 flex-1 basis-56 gap-0.5">
														<p id={`note-${row.id}`} className="text-sm leading-5 font-semibold">
															{row.title}
														</p>
														<p className="line-clamp-3 text-[13px] leading-[19px] text-muted">{row.body}</p>
														<p className="mt-0.5 text-xs text-muted">{meta(row)}</p>
													</div>
													{actionable && (
														<Button variant="secondary" size="sm" onPress={() => act(row)}>
															{kind.action}
														</Button>
													)}
												</div>
												{isUnread(row) && (
													<IconButton
														icon="check"
														label={t`Mark as read`}
														size="sm"
														iconSize={18}
														className="text-muted"
														onPress={() => dismiss(row)}
													/>
												)}
											</div>
										</CollapseRow>
									);
								})}
							</AnimatePresence>
						</div>
					) : (
						<EmptyState size="sm">
							<EmptyState.Header>
								<EmptyState.Media variant="icon">
									<Icon name="check-circle" size={20} />
								</EmptyState.Media>
								<EmptyState.Title>
									<Trans>You're up to date</Trans>
								</EmptyState.Title>
								<EmptyState.Description>
									<Trans>New roles, reminders and finished briefings appear here.</Trans>
								</EmptyState.Description>
							</EmptyState.Header>
							{read.length > 0 && (
								<EmptyState.Content>
									<Button variant="ghost" size="sm" onPress={() => setShowRead(true)}>
										<Trans>Show {read.length} read</Trans>
									</Button>
								</EmptyState.Content>
							)}
						</EmptyState>
					)}
				</Swap>
			)}
		</CareerWidget>
	);
}

// ---- New roles ----

type Tracked = Record<string, { applicationId: string; undoable: boolean }>;

type NewRolesProps = {
	ref: Ref<HTMLDivElement>;
	now: Date;
	deleted: string[];
	onOpenSchedule: (schedule: string) => void;
	className?: string;
};

function NewRoles({ ref, now, deleted, onOpenSchedule, className }: NewRolesProps) {
	const queryClient = useQueryClient();
	const { time, day } = useCareerTime();
	const dayOffset = useDayOffset();
	const { data: rows, isError, refetch } = useQuery(orpc.career.opportunities.queryOptions({ input: {} }));
	const scheduleQuery = useQuery(orpc.career.schedules.queryOptions({ input: {} }));
	const schedules = scheduleQuery.data;
	const [hidden, setHidden] = useState<string[]>([]);
	const [tracked, setTracked] = useState<Tracked>({});
	const [expanded, setExpanded] = useState(false);
	const invalidateRoles = () => queryClient.invalidateQueries({ queryKey: orpc.career.opportunities.key() });
	// Callbacks live on the hooks, not on mutate(), so each of several quick calls gets its own.
	const track = useMutation({
		...orpc.career.trackOpportunity.mutationOptions(),
		onSuccess: ({ applicationId }, { id }) => {
			setTracked((current) => ({ ...current, [id]: { applicationId, undoable: true } }));
			window.setTimeout(
				() =>
					setTracked((current) => {
						const entry = current[id];
						return entry ? { ...current, [id]: { ...entry, undoable: false } } : current;
					}),
				10_000,
			);
			// Every mutation refetches all queries (MutationCache), so the sidebar's Applications count updates.
			const row = rows?.find((item) => item.id === id);
			toast.add({ description: row ? t`Saved ${companyOf(row)} to Applications` : t`Saved to Applications` });
		},
		onError: (error) =>
			toastError(error, t`Couldn't save this role to Applications. Try again.`, { allowServerMessage: true }),
	});
	const untrack = useMutation({
		...orpc.applications.delete.mutationOptions(),
		onSuccess: async (_data, { id: applicationId }) => {
			// The role is back once the list knows it's untracked; dropping it from `tracked` first would flicker.
			await invalidateRoles();
			setTracked((current) =>
				Object.fromEntries(Object.entries(current).filter(([, entry]) => entry.applicationId !== applicationId)),
			);
		},
		onError: (error) =>
			toastError(error, t`Couldn't remove it from Applications. Try again.`, { allowServerMessage: true }),
	});
	const dismiss = useMutation({
		...orpc.career.dismissOpportunity.mutationOptions(),
		onError: (error, { id }) => {
			setHidden((current) => current.filter((item) => item !== id));
			toastError(error, t`Couldn't hide this role. Try again.`, { allowServerMessage: true });
		},
	});

	const visible = (rows ?? [])
		.filter((row) => !hidden.includes(row.id) && (!row.trackedApplicationId || tracked[row.id]))
		.sort(
			(a, b) =>
				b.matches.length - a.matches.length || new Date(b.firstSeenAt).getTime() - new Date(a.firstSeenAt).getTime(),
		);
	const shown = expanded ? visible : visible.slice(0, 5);
	const discovery =
		schedules?.filter((schedule) => schedule.kind === "discovery" && !deleted.includes(schedule.id)) ?? [];
	const active = discovery.find((schedule) => schedule.enabled) ?? discovery[0];

	const onTrack = (row: Opportunity) => track.mutate({ id: row.id });
	const onUndoTrack = (applicationId: string) => untrack.mutate({ id: applicationId });

	const onDismiss = (row: Opportunity) => {
		setHidden((current) => [...current, row.id]);
		withUndo({
			description: t`Hidden from New roles`,
			commit: () => dismiss.mutate({ id: row.id }),
			onUndo: () => setHidden((current) => current.filter((id) => id !== row.id)),
		});
	};

	const emptyLine = () => {
		if (!active) return null;
		if (!active.enabled)
			return (
				<p className="flex flex-wrap items-center gap-x-1 text-sm text-muted">
					<Trans>No new roles. Discovery is paused.</Trans>
					<Button variant="ghost" size="sm" onPress={() => onOpenSchedule(active.id)}>
						<Trans>Open the schedule</Trans>
					</Button>
				</p>
			);
		const offset = dayOffset(active.nextRunAt, now);
		const clock = time(active.nextRunAt);
		return (
			<p className="text-sm text-muted">
				{offset === 0
					? t`No new roles. Discovery runs again today at ${clock}.`
					: offset === 1
						? t`No new roles. Discovery runs again tomorrow at ${clock}.`
						: t`No new roles. Discovery runs again on ${day(active.nextRunAt)} at ${clock}.`}
			</p>
		);
	};

	const note = t`Nothing is applied for or created until you choose.`;

	return (
		<div ref={ref} className={className}>
			<CareerWidget
				title={t`New roles from your search`}
				icon="globe-simple"
				count={rows ? visible.filter((row) => !tracked[row.id]).length : undefined}
			>
				{isError || scheduleQuery.isError ? (
					<CareerLoadError
						onRetry={() => {
							void refetch();
							void scheduleQuery.refetch();
						}}
					/>
				) : !rows || !schedules ? (
					<Skeleton className="h-40 rounded-xl" />
				) : visible.length === 0 ? (
					active ? (
						emptyLine()
					) : (
						<EmptyState size="sm">
							<EmptyState.Header>
								<EmptyState.Media variant="icon">
									<Icon name="globe-simple" size={20} />
								</EmptyState.Media>
								<EmptyState.Title>
									<Trans>Get new roles here every morning</Trans>
								</EmptyState.Title>
							</EmptyState.Header>
							<EmptyState.Content>
								<Button variant="secondary" size="sm" onPress={() => onOpenSchedule("new:discovery")}>
									<Trans>Set up discovery</Trans>
								</Button>
							</EmptyState.Content>
						</EmptyState>
					)
				) : (
					<div>
						<AnimatePresence initial={false}>
							{shown.map((row, index) => {
								const offset = dayOffset(row.firstSeenAt, now);
								return (
									<CollapseRow key={row.id}>
										{index > 0 && <RowSeparator />}
										<RoleCard
											row={row}
											first={index === 0}
											found={
												offset === 0
													? t`Found today`
													: offset === -1
														? t`Found yesterday`
														: t`Found ${day(row.firstSeenAt)}`
											}
											tracked={tracked[row.id]}
											pending={track.isPending && track.variables?.id === row.id}
											onTrack={onTrack}
											onUndo={onUndoTrack}
											onDismiss={onDismiss}
										/>
									</CollapseRow>
								);
							})}
						</AnimatePresence>
						{visible.length > shown.length && (
							<Button variant="ghost" size="sm" className="mt-1" onPress={() => setExpanded(true)}>
								<Trans>Show {visible.length - shown.length} more</Trans>
							</Button>
						)}
						<p className="mt-2 text-xs text-muted">{note}</p>
					</div>
				)}
			</CareerWidget>
		</div>
	);
}

type RoleCardProps = {
	row: Opportunity;
	found: string;
	first: boolean;
	tracked: Tracked[string] | undefined;
	pending: boolean;
	onTrack: (row: Opportunity) => void;
	onUndo: (applicationId: string) => void;
	onDismiss: (row: Opportunity) => void;
};

const companyOf = (row: Opportunity) => row.company || new URL(row.url).hostname.replace(/^www\./, "");

function RoleCard({ row, found, first, tracked, pending, onTrack, onUndo, onDismiss }: RoleCardProps) {
	const { matches, unknowns } = row;
	const company = companyOf(row);
	const unknownLabels = { salary: t`Salary not listed`, office: t`Office days not stated` };
	return (
		<article
			data-role-card
			aria-labelledby={`role-${row.id}`}
			className={cn("flex items-start gap-3 rounded-xl py-4", first && "pt-0")}
		>
			<RowIcon className="text-sm font-semibold text-muted">{getInitials(company).slice(0, 1)}</RowIcon>
			<div className="grid min-w-0 flex-1 gap-3">
				<div className="grid gap-0.5">
					<h3 id={`role-${row.id}`} className="text-[15px] leading-5 font-semibold">
						{row.role}
					</h3>
					<p className="text-[13px] text-muted">{[company, row.location, found].filter(Boolean).join(" · ")}</p>
				</div>
				{row.snippet && <p className="line-clamp-3 text-sm leading-[21px] text-muted">{row.snippet}</p>}
				{matches.length + unknowns.length > 0 && (
					<div className="flex flex-wrap gap-1.5">
						{matches.map((match) => (
							<InfoChip key={match} tone="match">
								{match}
							</InfoChip>
						))}
						{unknowns.map((unknown) => (
							<InfoChip key={unknown} tone="unknown">
								{unknownLabels[unknown]}
							</InfoChip>
						))}
					</div>
				)}
				<Swap id={tracked ? "tracked" : "actions"}>
					{tracked ? (
						<p className="flex min-h-8 items-center gap-2 text-[13px] text-success">
							<Icon name="check-circle" size={18} className="shrink-0" />
							<span className="me-auto">
								<Trans>Saved to Applications with the posting</Trans>
							</span>
							{tracked.undoable && (
								<Button variant="ghost" size="sm" onPress={() => onUndo(tracked.applicationId)}>
									<Trans>Undo</Trans>
								</Button>
							)}
						</p>
					) : (
						<div className="flex flex-wrap items-center gap-2">
							<Button variant="secondary" size="sm" isPending={pending} onPress={() => onTrack(row)}>
								{pending ? (
									<Spinner size="sm" color="current" aria-hidden />
								) : (
									<Icon name="bookmark-simple" size={18} />
								)}
								<Trans>Track in Applications</Trans>
							</Button>
							<a
								href={row.url}
								target="_blank"
								rel="noopener noreferrer"
								className={buttonVariants({ variant: "ghost", size: "sm" })}
							>
								<Trans>Read posting</Trans>
								<Icon name="arrow-square-out" size={16} />
							</a>
							<Button variant="ghost" size="sm" className="ms-auto text-muted" onPress={() => onDismiss(row)}>
								<Trans>Not for me</Trans>
							</Button>
						</div>
					)}
				</Swap>
			</div>
		</article>
	);
}

// ---- Rail ----

type ComingUpProps = { now: Date; className?: string };

function ComingUp({ now, className }: ComingUpProps) {
	const { format, time, locale } = useCareerTime();
	const applicationQuery = useQuery(applicationsListQueryOptions());
	const applications = applicationQuery.data;
	const briefingQuery = useQuery(orpc.career.savedItems.queryOptions({ input: { kind: "briefing" } }));
	const briefings = briefingQuery.data;
	if (applicationQuery.isError || briefingQuery.isError)
		return (
			<CareerLoadError
				onRetry={() => {
					void applicationQuery.refetch();
					void briefingQuery.refetch();
				}}
			/>
		);
	if (applicationQuery.isPending || briefingQuery.isPending) return <Skeleton className="h-36 rounded-xl" />;
	const open = (applications ?? []).filter((application) => application.status !== "closed");
	const next = upcomingInterviews(collectInterviews(open), now)[0];
	if (!next) return null;

	const { application, interview, start } = next;
	const kind = interviewKindOf(interview.kind)?.label ?? interview.kind;
	const ready = briefings?.some((item) => item.interviewId === interview.id);

	return (
		<CareerWidget title={t`Coming up`} icon="calendar-blank" className={className}>
			<div className="flex items-start gap-3">
				<span className="flex w-12 shrink-0 flex-col items-center rounded-xl bg-default py-1.5">
					<span className="text-xs leading-4 font-medium text-muted">{format(start, { weekday: "short" })}</span>
					<span className="text-xl leading-6 font-semibold tabular-nums">{format(start, { day: "numeric" })}</span>
				</span>
				<div className="grid min-w-0 gap-0.5">
					<p className="flex items-center gap-1.5 text-sm font-semibold">
						<span
							aria-hidden="true"
							className="size-2 shrink-0 rounded-full"
							style={{ backgroundColor: `var(--stage-${application.status})` }}
						/>
						{t`${kind} interview`}
					</p>
					<p className="text-[13px] text-muted">
						{[application.company, time(start), formatDuration(interview.durationMinutes, locale)].join(" · ")}
					</p>
				</div>
			</div>
			<div className="flex flex-wrap items-center gap-1.5">
				<CountdownChip at={start} now={now} />
				{ready && (
					<Chip size="sm" variant="soft" color="success" className="gap-1">
						<Icon name="check" size={14} />
						<Chip.Label>
							<Trans>Briefing ready</Trans>
						</Chip.Label>
					</Chip>
				)}
			</div>
			<Link
				to="/dashboard/applications/$applicationId/{-$tab}"
				params={{ applicationId: application.id, tab: "prepare" }}
				className={buttonVariants({ variant: "secondary", size: "sm", fullWidth: true })}
			>
				<Trans>Open workspace</Trans>
				<Icon name="arrow-right" size={18} className="rtl:-scale-x-100" />
			</Link>
		</CareerWidget>
	);
}

type SchedulesProps = { deleted: string[]; onOpenSchedule: (schedule: string) => void; className?: string };

const KIND_ORDER = ["discovery", "prepare", "follow-up"];

function Schedules({ deleted, onOpenSchedule, className }: SchedulesProps) {
	const queryClient = useQueryClient();
	const { day, time, when } = useCareerTime();
	const queryKey = orpc.career.schedules.queryKey({ input: {} });
	const { data: schedules, isError, refetch } = useQuery(orpc.career.schedules.queryOptions({ input: {} }));
	const applicationQuery = useQuery(applicationsListQueryOptions());
	const applications = applicationQuery.data;
	const save = useMutation({
		...orpc.career.saveSchedule.mutationOptions(),
		onMutate: (input) => {
			const previous = queryClient.getQueryData(queryKey)?.find((item) => item.id === input.id);
			queryClient.setQueryData(queryKey, (current) =>
				current?.map((item) =>
					item.id === input.id
						? {
								...item,
								enabled: input.enabled ?? item.enabled,
								nextRunAt: input.nextRunAt instanceof Date ? input.nextRunAt : item.nextRunAt,
							}
						: item,
				),
			);
			return { previous };
		},
		onSuccess: (saved, input) => {
			const { title } = scheduleKind(input.kind);
			toast.add({
				description: input.enabled ? t`${title} is on · next ${when(saved.nextRunAt)}` : t`${title} paused`,
			});
		},
		onError: (error, _input, context) => {
			const previous = context?.previous;
			if (previous)
				queryClient.setQueryData(queryKey, (current) =>
					current?.map((item) => (item.id === previous.id ? previous : item)),
				);
			toastError(error, t`Couldn't change this schedule. Try again.`, { allowServerMessage: true });
		},
	});
	// A stable order (kind, then newest): an update must not reshuffle rows that share a creation time.
	const rows = schedules
		?.filter((row) => !deleted.includes(row.id))
		.sort(
			(a, b) =>
				KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind) ||
				new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime() ||
				a.id.localeCompare(b.id),
		);

	const describe = (row: Schedule) => {
		const application = applications?.find((item) => item.id === row.applicationId);
		if (row.kind === "discovery") return row.query;
		if (row.kind === "follow-up") return application ? `${application.company} · ${application.role}` : "";
		const interview = application?.activity.find((entry) => entry.type === "interview" && entry.id === row.interviewId);
		const kind = interview?.type === "interview" ? (interviewKindOf(interview.kind)?.label ?? interview.kind) : null;
		return [application?.company, kind ? t`${kind} interview` : null].filter(Boolean).join(" · ");
	};

	const status = (row: Schedule) => {
		if (!row.intervalDays && row.lastQueuedAt) return t`Done · ${day(row.nextRunAt)}`;
		let line = when(row.nextRunAt);
		if (row.kind === "discovery") {
			const clock = time(row.nextRunAt);
			const next = day(row.nextRunAt);
			const days = row.intervalDays ?? 1;
			line =
				days === 1
					? t`Daily at ${clock} · next ${next}`
					: days === 7
						? t`Weekly at ${clock} · next ${next}`
						: t`Every ${days} days at ${clock} · next ${next}`;
		} else if (row.kind === "prepare") {
			const lead = row.lead === "2h" ? t`2 hours before` : row.lead === "morning" ? t`Morning of` : t`24 hours before`;
			line = `${lead} · ${line}`;
		}
		return row.enabled ? line : t`Paused · ${line}`;
	};

	const toggle = (row: Schedule, enabled: boolean) => {
		// A finished one-off reminder has nothing left to run: switching it on means picking a new time.
		if (enabled && !row.intervalDays && row.lastQueuedAt && new Date(row.nextRunAt).getTime() <= Date.now())
			return onOpenSchedule(row.id);
		// Turning a repeating schedule back on starts from its next future run, at the same time of day.
		const nextRunAt =
			enabled && row.intervalDays
				? rollForward(new Date(row.nextRunAt), row.intervalDays, row.timezone)
				: new Date(row.nextRunAt);
		save.mutate({
			id: row.id,
			kind: row.kind as Kind,
			applicationId: row.applicationId,
			query: row.query,
			interviewId: row.interviewId,
			lead: row.lead as Lead | null,
			enabled,
			email: row.email,
			nextRunAt,
			timezone: row.timezone,
			intervalDays: row.intervalDays,
			aiProviderId: row.aiProviderId,
		});
	};

	return (
		<CareerWidget
			title={t`Schedules`}
			icon="clock"
			className={className}
			trailing={
				<Button variant="ghost" size="sm" onPress={() => onOpenSchedule("new")}>
					<Icon name="plus" size={18} />
					<Trans>Add</Trans>
				</Button>
			}
		>
			{isError || applicationQuery.isError ? (
				<CareerLoadError
					onRetry={() => {
						void refetch();
						void applicationQuery.refetch();
					}}
				/>
			) : !rows ? (
				<Skeleton className="h-24 rounded-xl" />
			) : rows.length === 0 ? (
				<p className="text-sm text-muted">
					<Trans>Nothing scheduled yet.</Trans>
				</p>
			) : (
				<div>
					<AnimatePresence initial={false}>
						{rows.map((row, index) => {
							const { icon, title } = scheduleKind(row.kind);
							const done = !row.intervalDays && Boolean(row.lastQueuedAt);
							return (
								<CollapseRow key={row.id}>
									{index > 0 && <RowSeparator />}
									<div className={cn("flex items-start gap-3", index > 0 && "pt-3")}>
										<RowIcon>
											<Icon name={icon} size={20} />
										</RowIcon>
										<button
											type="button"
											onClick={() => onOpenSchedule(row.id)}
											className="grid min-w-0 flex-1 gap-0.5 rounded-lg text-start focus-visible:ring-2 focus-visible:ring-focus focus-visible:outline-none"
										>
											<span className="text-sm font-medium">{title}</span>
											<span className="line-clamp-2 text-[13px] text-muted">{describe(row)}</span>
											<span className={cn("text-xs", row.enabled && !done ? "text-success" : "text-muted")}>
												{status(row)}
											</span>
										</button>
										<div className="self-center">
											<Switch
												aria-label={[title, describe(row)].filter(Boolean).join(" · ")}
												isSelected={row.enabled}
												onChange={(enabled) => toggle(row, enabled)}
											>
												<Switch.Content>
													<Switch.Control>
														<Switch.Thumb />
													</Switch.Control>
												</Switch.Content>
											</Switch>
										</div>
									</div>
								</CollapseRow>
							);
						})}
					</AnimatePresence>
				</div>
			)}
			<p className="text-xs leading-[17px] text-muted">
				<Trans>Reminders appear here. Email copies are optional and need a verified address.</Trans>
			</p>
		</CareerWidget>
	);
}
