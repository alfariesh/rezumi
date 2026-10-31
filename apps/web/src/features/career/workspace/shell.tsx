import type { SavedItem } from "../hooks";
import type { CoachConversation } from "./coach-sheet";
import type { Application } from "@/features/applications/types";
import type { InterviewTimelineEntry } from "@rezumi/schema/applications/data";
import type { WorkspaceTab } from "@rezumi/schema/career";
import type { ReactNode } from "react";
import { EmptyState } from "@heroui-pro/react";
import { Segment } from "@heroui-pro/react";
import {
	Alert,
	Avatar,
	Button,
	buttonVariants,
	Chip,
	Disclosure,
	Link as TextLink,
	Spinner,
	Typography,
} from "@heroui/react";
import { t } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import { Trans } from "@lingui/react/macro";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { m } from "motion/react";
import { useState } from "react";
import { WORKSPACE_TABS } from "@rezumi/schema/career";
import { Icon } from "@rezumi/ui/components/icon";
import { IconButton } from "@rezumi/ui/components/icon-button";
import { useBreakpoint } from "@rezumi/ui/hooks/use-breakpoint";
import { downloadWithAnchor } from "@rezumi/utils/file";
import { getInitials } from "@rezumi/utils/string";
import { cn } from "@rezumi/utils/style";
import { useOverlayHistory, useSavedItems } from "../hooks";
import { CareerWidget, CountdownChip, Eyebrow, minutesUntil, tabLabel, useCareerTime, useNow } from "../shared";
import { ApplyTab } from "./apply";
import { CoachSheet } from "./coach-sheet";
import { DebriefTab } from "./debrief";
import { FitTab } from "./fit";
import { MessagesTab } from "./messages";
import { PractiseTab } from "./practise";
import { PrepareTab } from "./prepare";
import { SavedTab } from "./saved";
import { RowIcon, RowSeparator } from "@/components/layout/icon-row";
import { ApplicationNotes } from "@/features/applications/components/application-notes";
import { InterviewDialog } from "@/features/applications/components/interview-dialog";
import { buildIcs } from "@/features/applications/ics";
import { formatDuration, interviewKindOf, isInterview } from "@/features/applications/interviews";
import { describeNextStep, getNextStep } from "@/features/applications/next-step";
import { getStageLabel, PIPELINE } from "@/features/applications/stages";
import { D1, EASE } from "@/libs/motion";
import { orpc } from "@/libs/orpc/client";
import { renderAsH1 } from "@/libs/typography";

export type WorkspaceSearch = {
	coach?: CoachConversation | undefined;
	edit?: "interview" | undefined;
	version?: string | undefined;
	speak?: boolean | undefined;
	story?: string | undefined;
};

/** What every tab receives: the application, and a saved version to show read-only ("Open in Prepare"). */
export type WorkspaceTabProps = {
	application: Application;
	/** A saved item opened from Saved: the tab shows it read-only with "Back to current". */
	version: SavedItem | undefined;
	/** The next interview still to come, or the most recent one if it just ended. */
	interview: InterviewTimelineEntry | undefined;
	/** Practise: open with Speak selected. */
	speak: boolean;
	story?: string | undefined;
	now: Date;
	go: (tab: WorkspaceTab, search?: WorkspaceSearch) => void;
};

const DAY = 86_400_000;
const archiveKinds = {
	fit: "fit",
	apply: "answers",
	prepare: "briefing",
	practise: "practice",
	debrief: "debrief",
	messages: "reply",
	saved: null,
} satisfies Record<WorkspaceTab, SavedItem["data"]["kind"] | null>;

/** The interview a workspace is about: the next one to come, else the latest one if it ended in the last day. */
function currentInterview(application: Application, now: Date) {
	const interviews = application.activity.filter(isInterview).sort((a, b) => +new Date(a.at) - +new Date(b.at));
	const end = (interview: InterviewTimelineEntry) => +new Date(interview.at) + interview.durationMinutes * 60_000;
	return (
		interviews.find((interview) => end(interview) >= +now) ??
		interviews.filter((interview) => +now - end(interview) < DAY).at(-1)
	);
}

/** Rule 7: the tab a stage opens on. Offers are compared in Career, so an offer opens on its messages. */
function defaultTab(application: Application, now: Date): WorkspaceTab {
	const interview = currentInterview(application, now);
	const ended = interview && +new Date(interview.at) + interview.durationMinutes * 60_000 < +now;
	switch (application.status) {
		case "saved":
			return "fit";
		case "applied":
			return "apply";
		case "screening":
		case "interview":
			return ended ? "debrief" : "prepare";
		case "offer":
			return "messages";
		case "closed":
			return "saved";
	}
}

type WorkspaceProps = {
	applicationId: string;
	tab: WorkspaceTab | undefined;
	search: WorkspaceSearch;
};

export function Workspace({ applicationId, tab: requested, search }: WorkspaceProps) {
	const navigate = useNavigate();
	const now = useNow();
	// The round being edited is fixed when the dialog opens; "next interview" can move on while it's open.
	const [editing, setEditing] = useState<{ id: string | null } | null>(null);
	const [detailsOpen, setDetailsOpen] = useState(false);
	const breakpoint = useBreakpoint();
	const query = useQuery(orpc.applications.getById.queryOptions({ input: { id: applicationId } }));
	const saved = useSavedItems(applicationId);
	const workspace = useQuery(orpc.career.workspace.queryOptions({ input: { applicationId } }));
	const overlay = useOverlayHistory();
	const application = query.data;

	if (query.isPending)
		return (
			<div className="grid min-h-svh place-items-center">
				<Spinner size="lg" color="current" aria-label={t`Loading`} />
			</div>
		);
	if (!application)
		return (
			<div className="grid min-h-svh place-items-center p-6">
				<EmptyState>
					<EmptyState.Header>
						<EmptyState.Media variant="icon">
							<Icon name="warning-circle" size={20} />
						</EmptyState.Media>
						<EmptyState.Title role="alert">
							<Trans>This application couldn't be opened.</Trans>
						</EmptyState.Title>
					</EmptyState.Header>
					<EmptyState.Content>
						<Link to="/dashboard/applications" className={cn(buttonVariants({ variant: "secondary" }))}>
							<Trans>Back to applications</Trans>
						</Link>
					</EmptyState.Content>
				</EmptyState>
			</div>
		);

	const tab = requested ?? defaultTab(application, now);
	const interview = currentInterview(application, now);
	const version = search.version ? saved.data?.find((item) => item.id === search.version) : undefined;
	const archived = search.version !== undefined;
	const archiveUnavailable = archived && (!version || version.data.kind !== archiveKinds[tab]);
	const waiting = saved.isPending || (!archived && tab !== "saved" && workspace.isPending);
	const failed =
		(saved.isError && saved.data === undefined) ||
		(!archived && tab !== "saved" && workspace.isError && workspace.data === undefined);
	const blocked = waiting || failed || archiveUnavailable;
	// The panel fades itself in, so the page-wide view transition would only add a second fade.
	const go = (next: WorkspaceTab, nextSearch: WorkspaceSearch = {}) =>
		void navigate({
			to: "/dashboard/applications/$applicationId/{-$tab}",
			params: { applicationId, tab: next },
			search: nextSearch,
			viewTransition: false,
		});
	const setSearch = (patch: WorkspaceSearch, push = false) =>
		void navigate({
			to: "/dashboard/applications/$applicationId/{-$tab}",
			params: { applicationId, tab },
			search: { ...search, ...patch },
			replace: !push,
		});
	const openSearch = (patch: WorkspaceSearch) => {
		overlay.open();
		setSearch(patch, true);
	};
	const closeSearch = (patch: WorkspaceSearch) => overlay.close(() => setSearch(patch));
	const props: WorkspaceTabProps = {
		application,
		version,
		interview,
		now,
		go,
		speak: search.speak === true,
		story: search.story,
	};
	// Messages shows the newest read message: it waits for a decision while its changes aren't applied.
	const newestReply = saved.data?.find((item) => item.data.kind === "reply");
	const unreadMessages =
		newestReply?.data.kind === "reply" && newestReply.data.changes.length > 0 && !newestReply.data.applied ? 1 : 0;
	const editOpen = search.edit === "interview";
	if (editOpen && !editing) setEditing({ id: interview?.id ?? null });
	if (!editOpen && editing) setEditing(null);
	const editingId = editing ? editing.id : (interview?.id ?? null);
	const editingInterview = application.activity.filter(isInterview).find((entry) => entry.id === editingId);
	const minutes = interview ? minutesUntil(new Date(interview.at), now) : null;
	const wide = breakpoint === "desktop" || breakpoint === "wide";

	return (
		<div className="mx-auto flex min-h-svh w-full max-w-[1440px] flex-col">
			<WorkspaceHeader application={application} onAskCoach={() => openSearch({ coach: true })} />
			<div
				className={cn(
					"grid min-h-0 flex-1 content-start gap-x-8 gap-y-2 px-4 pb-10 md:px-8",
					!wide && "grid-rows-[auto_minmax(0,1fr)]",
					wide && (breakpoint === "wide" ? "grid-cols-[300px_minmax(0,1fr)]" : "grid-cols-[264px_minmax(0,1fr)]"),
				)}
			>
				{wide ? (
					<aside
						aria-label={t`Application details`}
						className="grid grid-cols-[minmax(0,1fr)] content-start gap-4 pt-2"
					>
						<ContextColumn
							application={application}
							interview={interview}
							now={now}
							onEdit={() => openSearch({ edit: "interview" })}
						/>
					</aside>
				) : (
					<Disclosure isExpanded={detailsOpen} onExpandedChange={setDetailsOpen}>
						<Disclosure.Heading>
							<Disclosure.Trigger className="flex w-fit cursor-(--cursor-interactive) items-center gap-1 rounded-sm py-2 text-sm font-medium text-muted transition-colors duration-quick outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-focus">
								<Trans>Details</Trans>
								<Disclosure.Indicator />
							</Disclosure.Trigger>
						</Disclosure.Heading>
						<Disclosure.Content>
							<Disclosure.Body className="grid grid-cols-[minmax(0,1fr)] gap-4 pb-2">
								<ContextColumn
									application={application}
									interview={interview}
									now={now}
									onEdit={() => openSearch({ edit: "interview" })}
								/>
							</Disclosure.Body>
						</Disclosure.Content>
					</Disclosure>
				)}
				<div className="grid min-w-0 content-start gap-0">
					<div className="-mx-4 [scrollbar-width:none] overflow-x-auto px-4 sm:mx-0 sm:px-0">
						<Segment
							aria-label={t`Workspace sections`}
							selectedKey={tab}
							onSelectionChange={(key) => go(String(key) as WorkspaceTab)}
							className="w-max"
						>
							{WORKSPACE_TABS.map((value) => (
								<Segment.Item key={value} id={value} className="w-auto flex-none gap-1.5">
									{tabLabel(value)}
									{value === "prepare" && minutes !== null && minutes > 0 && minutes < 7 * 24 * 60 && (
										<TabBadge color={minutes <= 60 ? "warning" : "default"}>
											{minutes <= 60 ? t`${minutes} min` : t`${Math.round(minutes / 60)} h`}
										</TabBadge>
									)}
									{value === "messages" && unreadMessages > 0 && <TabBadge color="accent">{unreadMessages}</TabBadge>}
									{value === "saved" && (saved.data?.length ?? 0) > 0 && (
										<TabBadge color="default">{saved.data?.length}</TabBadge>
									)}
								</Segment.Item>
							))}
						</Segment>
					</div>
					{WORKSPACE_TABS.map((value) => (
						<div
							key={value}
							role="tabpanel"
							hidden={value !== tab}
							aria-label={tabLabel(value)}
							className="@container min-w-0 px-0 py-6"
						>
							{value === tab && (
								<m.div
									initial={{ opacity: 0, transform: "translateY(4px)" }}
									animate={{ opacity: 1, transform: "translateY(0px)" }}
									transition={{ duration: D1, ease: EASE }}
								>
									{blocked ? (
										waiting ? (
											<p
												role="status"
												className="flex items-center gap-2 rounded-2xl bg-surface-secondary p-5 text-sm text-muted"
											>
												<Spinner size="sm" color="current" aria-hidden />
												{archived ? <Trans>Loading saved version…</Trans> : <Trans>Loading workspace…</Trans>}
											</p>
										) : (
											<Alert status="danger" role="alert">
												<Alert.Indicator />
												<Alert.Content>
													<Alert.Description>
														{failed ? (
															archived ? (
																<Trans>This saved version couldn't be loaded.</Trans>
															) : (
																<Trans>This workspace couldn't be loaded.</Trans>
															)
														) : version ? (
															<Trans>This saved version belongs to a different tab. Open it from Saved.</Trans>
														) : (
															<Trans>This saved version is no longer available.</Trans>
														)}
													</Alert.Description>
													<div className="mt-3 flex flex-wrap gap-2">
														{failed && (
															<Button
																size="sm"
																variant="secondary"
																onPress={() => {
																	void saved.refetch();
																	if (!archived) void workspace.refetch();
																}}
															>
																<Trans>Try again</Trans>
															</Button>
														)}
														{archived && (
															<Button size="sm" variant="secondary" onPress={() => setSearch({ version: undefined })}>
																<Trans>Back to current</Trans>
															</Button>
														)}
													</div>
												</Alert.Content>
											</Alert>
										)
									) : (
										<>
											{version && (
												<Alert className="mb-4">
													<Alert.Indicator>
														<Icon name="clock-counter-clockwise" size={18} />
													</Alert.Indicator>
													<Alert.Content>
														<Alert.Description>
															<Trans>You're looking at a saved version. It can't be edited.</Trans>
														</Alert.Description>
													</Alert.Content>
													<Button size="sm" variant="secondary" onPress={() => setSearch({ version: undefined })}>
														<Trans>Back to current</Trans>
													</Button>
												</Alert>
											)}
											<TabBody tab={value} {...props} />
										</>
									)}
								</m.div>
							)}
						</div>
					))}
				</div>
			</div>
			<CoachSheet
				application={application}
				tab={tab}
				conversation={search.coach}
				onConversationChange={(coach) =>
					coach === undefined
						? closeSearch({ coach })
						: search.coach === undefined
							? openSearch({ coach })
							: setSearch({ coach })
				}
			/>
			<InterviewDialog
				application={application}
				interview={editOpen ? (editingInterview ?? null) : null}
				open={search.edit === "interview"}
				onOpenChange={(open) => (open ? openSearch({ edit: "interview" }) : closeSearch({ edit: undefined }))}
			/>
		</div>
	);
}

function TabBody({ tab, ...props }: WorkspaceTabProps & { tab: WorkspaceTab }) {
	switch (tab) {
		case "fit":
			return <FitTab {...props} />;
		case "apply":
			return <ApplyTab {...props} />;
		case "prepare":
			return <PrepareTab {...props} />;
		case "practise":
			return <PractiseTab {...props} />;
		case "debrief":
			return <DebriefTab {...props} />;
		case "messages":
			return <MessagesTab {...props} />;
		case "saved":
			return <SavedTab {...props} />;
	}
}

type TabBadgeProps = { color: "default" | "accent" | "warning"; children: ReactNode };

/** A count or countdown after a tab's name: quiet by default, accent for something waiting, warning when it's close. */
function TabBadge({ color, children }: TabBadgeProps) {
	return (
		<Chip size="sm" variant="soft" color={color} className="whitespace-nowrap tabular-nums">
			{children}
		</Chip>
	);
}

const stageDot = {
	saved: "bg-stage-saved",
	applied: "bg-stage-applied",
	screening: "bg-stage-screening",
	interview: "bg-stage-interview",
	offer: "bg-stage-offer",
	closed: "bg-stage-closed",
} as const;

type WorkspaceHeaderProps = { application: Application; onAskCoach: () => void };

function WorkspaceHeader({ application, onAskCoach }: WorkspaceHeaderProps) {
	const { date } = useCareerTime();
	const reached = PIPELINE.indexOf(application.status);
	const sent = application.status !== "saved";
	return (
		<header className="grid gap-4 px-4 pt-8 pb-6 md:px-8">
			<TextLink
				href="/dashboard/applications"
				className="w-fit gap-1 text-sm text-muted no-underline transition-colors duration-quick hover:text-foreground"
			>
				<Icon name="caret-left" size={16} className="rtl:-scale-x-100" />
				<Trans>Applications</Trans>
			</TextLink>
			<div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
				<div className="grid min-w-0 gap-2">
					<Typography type="h2" render={renderAsH1}>
						{application.role} · {application.company}
					</Typography>
					<p className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-sm text-muted">
						<Chip size="sm" variant="soft" className="gap-1.5">
							<span aria-hidden="true" className={cn("size-1.5 rounded-full", stageDot[application.status])} />
							<Chip.Label>{getStageLabel(application.status)}</Chip.Label>
						</Chip>
						{application.location && <span>{application.location}</span>}
						{sent && <span>{t`Applied ${date(application.appliedAt)}`}</span>}
						{application.sourceUrl && (
							<TextLink href={application.sourceUrl} target="_blank" rel="noreferrer" className="text-sm">
								<Trans>View posting</Trans>
								<TextLink.Icon />
							</TextLink>
						)}
					</p>
				</div>
				<div className="flex flex-wrap items-center gap-4">
					{application.status !== "closed" && (
						<div aria-hidden="true" className="hidden gap-1 lg:flex">
							{PIPELINE.map((stage, index) => (
								<span
									key={stage}
									className={cn("h-1.5 w-10 rounded-full", index <= reached ? stageDot[stage] : "bg-default")}
								/>
							))}
						</div>
					)}
					<div className="flex items-center gap-2">
						{application.status === "offer" && (
							<Link to="/dashboard/career/offers" className={cn(buttonVariants({ variant: "ghost" }))}>
								<Trans>Compare offers</Trans>
							</Link>
						)}
						<Button variant="secondary" onPress={onAskCoach}>
							<Icon name="sparkle" size={18} />
							<Trans>Ask the coach</Trans>
						</Button>
					</div>
				</div>
			</div>
		</header>
	);
}

type ContextColumnProps = {
	application: Application;
	interview: InterviewTimelineEntry | undefined;
	now: Date;
	onEdit: () => void;
};

/** Next step (with who you'll meet), the documents sent, and notes: the job at a glance beside every tab. */
function ContextColumn({ application, interview, now, onEdit }: ContextColumnProps) {
	const { i18n } = useLingui();
	const { day, date, time } = useCareerTime();
	const documents = useQuery(orpc.documents.list.queryOptions({ input: { trashed: false } }));
	const hasSentVersion = Boolean(application.sentResumeVersionId || application.sentCoverLetterVersionId);
	const trashed = useQuery({
		...orpc.documents.list.queryOptions({ input: { trashed: true } }),
		enabled: hasSentVersion,
	});
	const step = getNextStep(application, now);
	const text = describeNextStep(step, application, i18n.locale);
	const upcoming = step.kind === "interview" ? step.interview : interview;
	const available = [...(documents.data ?? []), ...(trashed.data ?? [])];
	const resume = available.find((document) => document.type === "resume" && document.id === application.resumeId);
	const letter = available.find((document) => document.type === "letter" && document.id === application.coverLetterId);
	const missingDocument = Boolean((application.resumeId && !resume) || (application.coverLetterId && !letter));
	const documentsPending = missingDocument && (documents.isPending || (hasSentVersion && trashed.isPending));
	const documentsFailed = missingDocument && (documents.isError || (hasSentVersion && trashed.isError));
	const sent = application.status !== "saved";

	const addToCalendar = () => {
		if (!upcoming) return;
		const start = new Date(upcoming.at);
		const people = upcoming.participants.map((person) => [person.name, person.role].filter(Boolean).join(", "));
		const ics = buildIcs({
			uid: upcoming.id,
			title: `${interviewKindOf(upcoming.kind)?.label ?? ""} interview · ${application.role}, ${application.company}`,
			start,
			end: new Date(start.getTime() + upcoming.durationMinutes * 60_000),
			...(upcoming.location ? { location: upcoming.location } : {}),
			description: [people.join("\n"), upcoming.notes].filter(Boolean).join("\n\n"),
		});
		downloadWithAnchor(
			new Blob([ics], { type: "text/calendar" }),
			`${application.company}-interview.ics`.replace(/[^\w.-]+/g, "-"),
		);
	};

	return (
		<>
			<CareerWidget
				title={<Trans>Next step</Trans>}
				icon={upcoming ? "calendar-dot" : text.icon}
				trailing={
					upcoming ? (
						<IconButton icon="pencil-simple" label={t`Edit`} size="sm" iconSize={16} onPress={onEdit} />
					) : undefined
				}
			>
				<div className="grid gap-0.5">
					<p className="text-sm font-semibold">
						{upcoming ? t`${interviewKindOf(upcoming.kind)?.label ?? ""} interview` : text.title}
					</p>
					{upcoming ? (
						<>
							<p className="text-sm text-muted">
								{day(upcoming.at)} · {time(upcoming.at)} · {formatDuration(upcoming.durationMinutes, i18n.locale)}
							</p>
							{upcoming.location && <p className="text-xs text-muted">{upcoming.location}</p>}
						</>
					) : (
						text.sub && <p className="text-sm text-muted">{text.sub}</p>
					)}
				</div>
				{upcoming && <CountdownChip at={new Date(upcoming.at)} now={now} />}
				{upcoming ? (
					<Button size="sm" variant="secondary" fullWidth onPress={addToCalendar}>
						<Icon name="calendar-plus" size={16} />
						<Trans>Add to calendar</Trans>
					</Button>
				) : (
					<Button size="sm" variant="secondary" className="w-fit" onPress={onEdit}>
						<Trans>Add an interview</Trans>
					</Button>
				)}

				{upcoming && upcoming.participants.length > 0 && (
					<section className="grid gap-2.5">
						<Eyebrow>
							<Trans>Who you'll meet</Trans>
						</Eyebrow>
						{upcoming.participants.map((person) => (
							<div key={`${person.name}-${person.role}`} className="flex items-center gap-2.5">
								<Avatar size="sm">
									<Avatar.Fallback>{getInitials(person.name)}</Avatar.Fallback>
								</Avatar>
								<div className="grid min-w-0">
									<span className="truncate text-sm font-medium">{person.name}</span>
									{person.role && <span className="truncate text-xs text-muted">{person.role}</span>}
								</div>
							</div>
						))}
					</section>
				)}
				{upcoming?.notes && (
					<section className="grid gap-2">
						<Eyebrow>
							<Trans>Interview notes</Trans>
						</Eyebrow>
						<p className="rounded-xl bg-default px-3 py-2.5 text-sm leading-5 whitespace-pre-wrap text-muted">
							{upcoming.notes}
						</p>
					</section>
				)}
			</CareerWidget>

			{(resume || letter || documentsPending || documentsFailed) && (
				<CareerWidget
					title={
						sent ? <Trans>What you sent · {date(application.appliedAt)}</Trans> : <Trans>Documents for this job</Trans>
					}
					icon="paperclip"
					contentClassName="grid-cols-[minmax(0,1fr)] gap-1 p-2"
				>
					{documentsPending ? (
						<p role="status" className="px-2 py-1 text-xs text-muted">
							<Trans>Loading linked documents…</Trans>
						</p>
					) : documentsFailed ? (
						<div className="grid justify-items-start gap-1.5 px-2 py-1">
							<p role="alert" className="text-xs text-muted">
								<Trans>Linked documents couldn't be loaded.</Trans>
							</p>
							<Button
								size="sm"
								variant="ghost"
								onPress={() => {
									void documents.refetch();
									if (hasSentVersion) void trashed.refetch();
								}}
							>
								<Trans>Try again</Trans>
							</Button>
						</div>
					) : null}
					{resume && application.resumeId && (
						<Link
							to="/builder/$resumeId"
							params={{ resumeId: application.resumeId }}
							search={application.sentResumeVersionId ? { version: application.sentResumeVersionId } : {}}
							className="group block min-w-0 rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-focus"
						>
							<div className="flex items-center gap-3 rounded-2xl px-2 py-2 transition-colors duration-quick group-hover:bg-default">
								<RowIcon>
									<Icon name="file-text" size={20} />
								</RowIcon>
								<span className="grid min-w-0 flex-1">
									<span className="truncate text-sm font-medium">{resume.name}</span>
									<span className="text-xs text-muted">
										{application.sentResumeVersionId ? (
											<Trans>Resume · version sent</Trans>
										) : (
											<Trans>Resume · not sent yet</Trans>
										)}
									</span>
								</span>
							</div>
						</Link>
					)}
					{/* The rule starts under the text: the rows' 8px padding plus the indent. */}
					{resume && application.resumeId && letter && application.coverLetterId && (
						<RowSeparator className="-my-1 ms-[calc(var(--spacing-row-indent)+0.5rem)]" />
					)}
					{letter && application.coverLetterId && (
						<Link
							to="/builder/letter/$coverLetterId"
							params={{ coverLetterId: application.coverLetterId }}
							search={application.sentCoverLetterVersionId ? { version: application.sentCoverLetterVersionId } : {}}
							className="group block min-w-0 rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-focus"
						>
							<div className="flex items-center gap-3 rounded-2xl px-2 py-2 transition-colors duration-quick group-hover:bg-default">
								<RowIcon>
									<Icon name="envelope-simple" size={20} />
								</RowIcon>
								<span className="grid min-w-0 flex-1">
									<span className="truncate text-sm font-medium">{letter.name}</span>
									<span className="text-xs text-muted">
										{application.sentCoverLetterVersionId ? (
											<Trans>Letter · version sent</Trans>
										) : (
											<Trans>Letter · not sent yet</Trans>
										)}
									</span>
								</span>
							</div>
						</Link>
					)}
				</CareerWidget>
			)}

			<section className="grid gap-1.5">
				<ApplicationNotes key={application.id} application={application} />
				<p className="text-xs text-muted">
					<Trans>The coach reads these for this application only.</Trans>
				</p>
			</section>
		</>
	);
}
