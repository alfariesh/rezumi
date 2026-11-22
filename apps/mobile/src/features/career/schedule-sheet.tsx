// One schedule in a sheet (the web's career/schedule-sheet.tsx): a job alert repeating a job search, an interview
// briefing, or a follow-up reminder. Home mounts it while open; it opens itself, asks before dropping unsaved edits
// and saves through career.saveSchedule. A job alert saves its whole `search`: the role, city and country from the
// sheet and the other filters as the search had them.
import type { Schedule } from "./hooks";
import type { Draft, Kind, Lead } from "./schedule-fields";
import type { RouterInput } from "@/api/client";
import type { JobSearchCriteria } from "@rezumi/schema/jobs/search";
import { t } from "@lingui/core/macro";
import { useLingui } from "@lingui/react/macro";
import { ORPCError } from "@orpc/client";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { View } from "react-native";
import { alertFields, alertSearch, startingAlertSearch } from "@rezumi/career/jobs";
import { careerScheduleInputSchema } from "@rezumi/schema/career";
import { fromZonedDateTime } from "@rezumi/utils/timezone";
import { client, useCareerAction, useCareerQueries, useCareerTime, useNow } from "./hooks";
import { ScheduleBody } from "./schedule-body";
import { collectInterviews, nextCareerRun, prepareRunAt, rollForward, toZoned } from "./scheduling";
import { orpc } from "@/api/client";
import { useFlags } from "@/api/flags";
import { useSession } from "@/auth/session";
import { useHasAIProvider } from "@/features/ai/provider-state";
import { useApplications } from "@/features/applications/queries";
import { Button, ConfirmDialog, Sheet, showToast } from "@/ui";

type Input = RouterInput["career"]["saveSchedule"];
type Applications = NonNullable<ReturnType<typeof useApplications>["data"]>;

const KINDS: readonly Kind[] = ["discovery", "prepare", "follow-up"];

/** The name a schedule goes by on Home and in toasts. */
export const scheduleTitle = (kind: string) =>
	kind === "prepare" ? t`Interview preparation` : kind === "follow-up" ? t`Follow-up reminder` : t`Job alert`;

type ScheduleSheetProps = {
	schedule: Schedule | null;
	kind: Kind;
	onClose: () => void;
	onDelete: (id: string) => void;
	/** New job alert from the Jobs screen: the search to repeat. */
	search?: JobSearchCriteria | undefined;
};

/** How many job alerts the plan keeps on, when saving was refused for that; never a way to buy more (K6). */
function jobAlertLimit(error: unknown): number | null {
	if (!(error instanceof ORPCError) || error.code !== "PLAN_LIMIT_REACHED") return null;
	const data = (error.data ?? {}) as { limit?: unknown; max?: unknown };
	return data.limit === "jobAlerts" ? (typeof data.max === "number" ? data.max : 0) : null;
}

/** Reads what the sheet needs; a new alert without a search also waits for the Preferences defaults. */
function useScheduleData(props: ScheduleSheetProps) {
	const session = useSession();
	const time = useCareerTime();
	const career = useCareerQueries();
	const applications = useApplications();
	const flags = useFlags();
	const ai = useHasAIProvider();
	const signedIn = session.status === "signed-in";
	const needsDefaults = !props.schedule && !props.search;
	const defaults = useQuery({
		...orpc.jobs.defaults.queryOptions(),
		enabled: signedIn && needsDefaults,
		staleTime: Number.POSITIVE_INFINITY,
		queryKey: [...orpc.jobs.defaults.key(), session.server],
	});
	const quota = useQuery({
		...orpc.jobs.quota.queryOptions(),
		enabled: signedIn,
		queryKey: [...orpc.jobs.quota.key(), session.server],
	});
	const queries = [time.profile, career.profile, applications, flags];
	const failed = queries.find((query) => query.isError) ?? null;
	const ready =
		queries.every((query) => query.data !== undefined) && (!needsDefaults || !defaults.isPending || defaults.isError);
	return { time, career, applications, flags, ai, defaults, quota, failed, ready };
}
type Data = ReturnType<typeof useScheduleData>;

function initialDraft(props: ScheduleSheetProps, data: Data, applications: Applications, now: Date): Draft {
	const { schedule } = props;
	const zone = data.time.timeZone;
	const at = schedule
		? schedule.intervalDays
			? rollForward(new Date(schedule.nextRunAt), schedule.intervalDays, zone, now)
			: new Date(schedule.nextRunAt)
		: nextCareerRun(now, 1, zone);
	const search = startingAlertSearch({
		existing: schedule,
		search: props.search,
		defaults: data.defaults.data,
		targetRoles: data.career.profile.data?.targetRoles ?? [],
	});
	return {
		kind: schedule ? (KINDS.find((kind) => kind === schedule.kind) ?? "discovery") : props.kind,
		...alertFields(search),
		every: String(schedule?.intervalDays ?? 1),
		date: toZoned(at, zone).date,
		time: schedule ? toZoned(at, zone).time : "08:00",
		interviewId: schedule?.interviewId ?? collectInterviews(applications, now)[0]?.interview.id ?? "",
		applicationId: schedule?.applicationId ?? applications.find((row) => row.status !== "closed")?.id ?? "",
		lead: (schedule?.lead as Lead | null) ?? "24h",
		aiProviderId: schedule?.aiProviderId ?? data.ai.defaultProvider?.id ?? "",
		enabled: schedule?.enabled ?? true,
		email: schedule?.email ?? false,
	};
}

/** The draft, what follows from it (run time, errors, what blocks saving) and the save itself. */
function useScheduleForm(props: ScheduleSheetProps) {
	const { t } = useLingui();
	const { schedule, onClose } = props;
	const now = useNow();
	const data = useScheduleData(props);
	const action = useCareerAction();
	const [start, setStart] = useState<Draft | null>(null);
	const [draft, setDraft] = useState<Draft | null>(null);
	const [tried, setTried] = useState(false);
	const [roleTouched, setRoleTouched] = useState(false);
	const [problem, setProblem] = useState<{ limit: number } | "invalid" | null>(null);
	const applications = data.applications.data;
	if (!draft && data.ready && applications) {
		const initial = initialDraft(props, data, applications, now);
		setStart(initial);
		setDraft(initial);
	}

	const { timeZone, locale } = data.time;
	const upcoming = collectInterviews(applications ?? [], now);
	const open = (applications ?? []).filter((row) => row.status !== "closed");
	const interview = upcoming.find((row) => row.interview.id === draft?.interviewId);
	const { ai } = data;
	const provider = ai.usableProviders.find((row) => row.id === draft?.aiProviderId) ?? ai.defaultProvider;
	const entered = draft ? fromZonedDateTime(draft.date, draft.time, timeZone) : null;
	const runAt =
		draft?.kind === "prepare" ? (interview ? prepareRunAt(interview.start, draft.lead, timeZone) : null) : entered;
	const available = data.flags.data?.careerSchedulingEnabled ?? false;
	const alertsUnavailable = draft?.kind === "discovery" && data.quota.data?.available === false;
	const smtp = data.flags.data?.smtpEnabled ?? false;
	const verified = data.time.profile.data?.emailVerified ?? false;
	const roleError = draft?.kind === "discovery" && draft.role.trim().length < 2 ? t`Add a role to look for.` : null;
	const whenError =
		!draft || draft.kind === "prepare"
			? null
			: !entered
				? t`This time does not exist in your timezone. Choose another time.`
				: entered <= now
					? t`Pick a time after now.`
					: null;
	const blocked =
		!draft ||
		(draft.enabled && !available) ||
		alertsUnavailable ||
		(draft.kind === "prepare" && (!interview || !ai.hasAIProvider)) ||
		(draft.kind === "follow-up" && !open.some((row) => row.id === draft.applicationId));

	const save = () => {
		if (!draft || blocked) return;
		setTried(true);
		if (roleError || whenError || !runAt) return;
		const discovery = draft.kind === "discovery";
		const prepare = draft.kind === "prepare";
		const input: Input = {
			...(schedule ? { id: schedule.id } : {}),
			kind: draft.kind,
			query: discovery ? draft.role.trim() : "",
			search: discovery ? alertSearch(draft) : null,
			applicationId: prepare
				? (interview?.application.id ?? null)
				: draft.kind === "follow-up"
					? draft.applicationId
					: null,
			interviewId: prepare ? draft.interviewId : null,
			lead: prepare ? draft.lead : null,
			enabled: draft.enabled,
			email: smtp && verified && draft.email,
			timezone: timeZone,
			locale,
			nextRunAt: runAt,
			intervalDays: discovery ? Number(draft.every) : null,
			aiProviderId: prepare ? (provider?.id ?? null) : null,
		};
		if (!careerScheduleInputSchema.safeParse(input).success) return setProblem("invalid");
		setProblem(null);
		void action.run(
			async () => {
				try {
					return await client.career.saveSchedule(input);
				} catch (error) {
					const limit = jobAlertLimit(error);
					if (limit !== null) setProblem({ limit });
					throw error;
				}
			},
			() => {
				showToast({ title: t`Schedule saved`, variant: "success" });
				onClose();
			},
		);
	};

	const body = {
		draft,
		set: (patch: Partial<Draft>) => setDraft((current) => current && { ...current, ...patch }),
		isNew: !schedule,
		failed: data.failed,
		timeZone,
		locale,
		now,
		upcoming,
		open,
		interview,
		runAt,
		ai,
		providerMissing:
			schedule?.kind === "prepare" &&
			ai.usableProviders.length > 0 &&
			!ai.usableProviders.some((row) => row.id === schedule.aiProviderId)
				? (ai.defaultProvider?.label ?? "")
				: null,
		available,
		alertsUnavailable,
		smtp,
		verified,
		email: data.time.profile.data?.email ?? "",
		errors: { role: tried || roleTouched ? roleError : null, when: tried ? whenError : null },
		onRoleBlur: () => setRoleTouched(true),
		limit: problem && problem !== "invalid" ? problem.limit : null,
		saveError: problem === "invalid" ? t`Check the fields and try again.` : problem ? null : (action.error ?? null),
		onClose,
	};
	const dirty = !!draft && JSON.stringify(draft) !== JSON.stringify(start);
	return { body, draft, dirty, blocked, pending: action.pending, save };
}

export function ScheduleSheet(props: ScheduleSheetProps) {
	const { t } = useLingui();
	const { schedule, onClose, onDelete } = props;
	const form = useScheduleForm(props);
	const [discarding, setDiscarding] = useState(false);
	const kind = form.draft?.kind ?? props.kind;
	const title =
		kind === "discovery"
			? schedule
				? t`Edit job alert`
				: t`New job alert`
			: schedule
				? t`Edit schedule`
				: t`New schedule`;

	return (
		<>
			<Sheet
				isOpen
				onOpenChange={(next) => {
					if (!next) onClose();
				}}
				title={title}
				closeLabel={t`Close`}
				canDismiss={!form.dirty && !form.pending}
				onDismissAttempt={() => {
					if (form.dirty) setDiscarding(true);
				}}
				footer={
					form.draft ? (
						<View className="flex-row flex-wrap items-center gap-2">
							{schedule ? (
								<Button
									variant="danger-soft"
									isDisabled={form.pending}
									onPress={() => {
										onDelete(schedule.id);
										onClose();
									}}
								>
									<Button.Label>{t`Delete`}</Button.Label>
								</Button>
							) : null}
							<View className="flex-1" />
							<Button variant="primary" isDisabled={form.blocked || form.pending} onPress={form.save}>
								<Button.Label>{form.pending ? t`Saving…` : t`Save schedule`}</Button.Label>
							</Button>
						</View>
					) : undefined
				}
			>
				<ScheduleBody {...form.body} />
			</Sheet>
			<ConfirmDialog
				isOpen={discarding}
				onOpenChange={setDiscarding}
				title={t`Discard changes?`}
				confirmLabel={t`Discard`}
				cancelLabel={t`Keep editing`}
				destructive
				onConfirm={onClose}
			/>
		</>
	);
}
