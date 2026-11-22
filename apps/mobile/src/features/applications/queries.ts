// Applications data: the list (with each row's first details), one application, writes with optimistic stage moves,
// the detail's own writes, stage actions with Undo toasts, and the device reminders an application should have.
import type { Application, ApplicationSummary } from "./types";
import type { ReminderTarget } from "@/features/reminders";
import type {
	ApplicationClosedReason,
	ApplicationStatus,
	InterviewTimelineEntry,
} from "@rezumi/schema/applications/data";
import { plural, t } from "@lingui/core/macro";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { File } from "expo-file-system";
import { useCallback, useEffect, useRef } from "react";
import { isInterview } from "@rezumi/career/applications";
import { applicationError } from "./error";
import { getInterviewKindLabel, getStageLabel } from "./stages";
import { orpc, rest } from "@/api/client";
import { getServer, useSession } from "@/auth/session";
import { syncReminders } from "@/features/reminders";
import { showToast } from "@/ui";

/** Same unfiltered list for list, board, calendar and detail; isolated by server. */
export const applicationsListQueryOptions = (server = getServer()) => {
	const options = orpc.applications.listSummary.queryOptions({ input: { includeInitialDetails: 3 } });
	return { ...options, queryKey: [...options.queryKey, server] };
};
export const applicationsListQueryKey = (server = getServer()) => applicationsListQueryOptions(server).queryKey;
export const applicationDetailQueryOptions = (id: string, server = getServer()) => {
	const options = orpc.applications.getById.queryOptions({ input: { id } });
	return { ...options, queryKey: [...options.queryKey, server] };
};
export const applicationDetailQueryKey = (id: string, server = getServer()) =>
	applicationDetailQueryOptions(id, server).queryKey;

function getInitialApplicationDetail(summary: ApplicationSummary | undefined) {
	const detail = summary?.initialDetail;
	return detail && detail.status === summary.status && detail.closedReason === summary.closedReason
		? detail
		: undefined;
}

export function useApplications() {
	const session = useSession();
	const queryClient = useQueryClient();
	const query = useQuery({ ...applicationsListQueryOptions(session.server), enabled: session.status === "signed-in" });

	useEffect(() => {
		if (!query.data || session.status !== "signed-in") return;
		const listUpdatedAt = query.dataUpdatedAt;
		for (const application of query.data) {
			const initialDetail = getInitialApplicationDetail(application);
			if (!initialDetail) continue;
			const detailKey = applicationDetailQueryOptions(application.id, session.server).queryKey;
			const existing = queryClient.getQueryData<Application>(detailKey);
			if (existing && existing.updatedAt.getTime() >= initialDetail.updatedAt.getTime()) continue;
			void queryClient.cancelQueries({ queryKey: detailKey }, { revert: false });
			queryClient.setQueryData(detailKey, initialDetail, { updatedAt: listUpdatedAt });
		}
	}, [query.data, query.dataUpdatedAt, queryClient, session.server, session.status]);

	return query;
}
export function useApplication(id: string) {
	const session = useSession();
	const queryClient = useQueryClient();
	const listKey = applicationsListQueryKey(session.server);
	const summary = queryClient.getQueryData<ApplicationSummary[]>(listKey)?.find((application) => application.id === id);
	const listUpdatedAt = queryClient.getQueryState(listKey)?.dataUpdatedAt;
	const initialDetail = getInitialApplicationDetail(summary);

	return useQuery({
		...applicationDetailQueryOptions(id, session.server),
		enabled: session.status === "signed-in" && !!id,
		initialData: initialDetail,
		...(listUpdatedAt !== undefined ? { initialDataUpdatedAt: listUpdatedAt } : {}),
	});
}

/** Loads the details of the first rows on screen ahead of a tap, two at a time, after scrolling settles. */
export function useApplicationDetailPrefetch() {
	const queryClient = useQueryClient();
	const prefetchInFlight = useRef(new Set<string>());
	const prefetchTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
	const prefetch = useCallback(
		(visibleIds: readonly string[]) => {
			clearTimeout(prefetchTimer.current);
			const ids = visibleIds.slice(0, 2);
			prefetchTimer.current = setTimeout(() => {
				for (const id of ids) {
					const options = applicationDetailQueryOptions(id);
					if (
						prefetchInFlight.current.has(id) ||
						queryClient.getQueryData(options.queryKey) ||
						queryClient.getQueryState(options.queryKey)?.fetchStatus === "fetching"
					)
						continue;
					if (prefetchInFlight.current.size >= 2) break;
					prefetchInFlight.current.add(id);
					void queryClient
						.fetchQuery(options)
						.catch(() => {})
						.finally(() => prefetchInFlight.current.delete(id));
				}
			}, 120);
		},
		[queryClient],
	);
	useEffect(() => () => clearTimeout(prefetchTimer.current), []);
	return prefetch;
}

/** Invalidates all application views, tags, stats and linked document summaries after writes. */
export function useInvalidateApplications() {
	const queryClient = useQueryClient();
	return async () => {
		await Promise.all([
			queryClient.invalidateQueries({ queryKey: orpc.applications.key() }),
			queryClient.invalidateQueries({ queryKey: orpc.documents.list.key() }),
		]);
	};
}

export function useApplicationMutations() {
	const invalidate = useInvalidateApplications();
	const queryClient = useQueryClient();
	// Settlement refetches authoritative state, including after a lost reply or optimistic rollback.
	const onSettled = () => {
		void invalidate();
	};
	// Deleted or closed applications need nothing, so their reminders on this device go (syncing to no targets).
	const cancelReminders = (ids: string[]) => {
		for (const id of ids) void syncReminders(id, []).catch(() => {});
	};
	const create = useMutation({ ...orpc.applications.create.mutationOptions(), onSettled });
	const update = useMutation({
		...orpc.applications.update.mutationOptions(),
		onMutate: async (input) => {
			const listKey = applicationsListQueryKey();
			await queryClient.cancelQueries({ queryKey: listKey });
			const previous = queryClient.getQueryData<ApplicationSummary[]>(listKey);
			queryClient.setQueryData<ApplicationSummary[]>(listKey, (rows) =>
				rows?.map((row) =>
					row.id === input.id
						? {
								...row,
								...(input.status ? { status: input.status } : {}),
								...(input.closedReason !== undefined ? { closedReason: input.closedReason } : {}),
							}
						: row,
				),
			);
			return { previous, listKey };
		},
		onError: (_error, _input, context) => {
			if (context?.previous) queryClient.setQueryData(context.listKey, context.previous);
		},
		onSuccess: (_data, input) => {
			if (input.status === "closed") cancelReminders([input.id]);
		},
		onSettled,
	});
	const remove = useMutation({
		...orpc.applications.delete.mutationOptions(),
		onSuccess: (_data, input) => cancelReminders([input.id]),
		onSettled,
	});
	const bulkUpdate = useMutation({
		...orpc.applications.bulkUpdate.mutationOptions(),
		onSuccess: (_data, input) => {
			if (input.status === "closed") cancelReminders(input.ids);
		},
		onSettled,
	});
	const bulkDelete = useMutation({
		...orpc.applications.bulkDelete.mutationOptions(),
		onSuccess: (_data, input) => cancelReminders(input.ids),
		onSettled,
	});
	const importCsv = useMutation({ ...orpc.applications.import.mutationOptions(), onSettled });
	return { create, update, remove, bulkUpdate, bulkDelete, importCsv };
}

// ---- The detail's own writes ----

export type AttachmentKind = "resume" | "cover-letter";

/** Notes, timeline entries, interviews, files and a new letter; each refreshes every view once it settles. */
export function useDetailMutations(applicationId: string) {
	const invalidate = useInvalidateApplications();
	const onSettled = () => void invalidate();
	return {
		addNote: useMutation({ ...orpc.applications.addNote.mutationOptions(), onSettled }),
		updateEntry: useMutation({ ...orpc.applications.updateTimelineEntry.mutationOptions(), onSettled }),
		deleteEntry: useMutation({ ...orpc.applications.deleteTimelineEntry.mutationOptions(), onSettled }),
		addInterview: useMutation({ ...orpc.applications.addInterview.mutationOptions(), onSettled }),
		updateInterview: useMutation({ ...orpc.applications.updateInterview.mutationOptions(), onSettled }),
		removeDocument: useMutation({ ...orpc.applications.removeDocument.mutationOptions(), onSettled }),
		createLetter: useMutation({ ...orpc.coverLetters.create.mutationOptions(), onSettled }),
		/** Uploads a picked PDF (already checked by `attachmentProblem`) through the REST multipart endpoint. */
		attach: useMutation({
			mutationFn: async ({ kind, uri }: { kind: AttachmentKind; uri: string }) => {
				const form = new FormData();
				form.append("file", new File(uri));
				const response = await rest(`/applications/${encodeURIComponent(applicationId)}/documents/${kind}`, {
					method: "POST",
					body: form,
				});
				if (!response.ok) throw new Error(`Upload failed (${response.status})`);
			},
			onSettled,
		}),
	};
}

/** The user's documents (not in Trash), for "What you sent", Mark as applied and Save a job. */
export function useDocuments() {
	const session = useSession();
	const options = orpc.documents.list.queryOptions({ input: { trashed: false } });
	return useQuery({
		...options,
		queryKey: [...options.queryKey, session.server],
		enabled: session.status === "signed-in",
	});
}

// ---- Stage actions with Undo ----

type StageRow = Pick<ApplicationSummary, "id" | "status" | "closedReason">;

const stageInput = (status: ApplicationStatus, closedReason: ApplicationClosedReason | null) =>
	status === "closed" ? { status, closedReason: closedReason ?? "not-selected" } : { status };

/**
 * Moves, closes and deletes from the list, its menus and the detail. A move or close shows at once (the list updates
 * optimistically) with an Undo toast that puts the old stage back; deleting is permanent, so callers confirm first.
 */
export function useApplicationActions() {
	const { update, remove, bulkUpdate, bulkDelete } = useApplicationMutations();
	const failed = (error: unknown) => showToast({ title: applicationError(error), variant: "danger" });
	const restore = (rows: readonly StageRow[]) => {
		const groups = new Map<string, StageRow[]>();
		for (const row of rows) {
			const key = `${row.status}:${row.closedReason ?? ""}`;
			groups.set(key, [...(groups.get(key) ?? []), row]);
		}
		for (const group of groups.values()) {
			const first = group[0];
			if (!first) continue;
			const input = stageInput(first.status, first.closedReason);
			if (group.length === 1) update.mutate({ id: first.id, ...input }, { onError: failed });
			else bulkUpdate.mutate({ ids: group.map((row) => row.id), ...input }, { onError: failed });
		}
	};

	const moveTo = (row: StageRow, status: ApplicationStatus, closedReason: ApplicationClosedReason | null = null) => {
		if (row.status === status && status !== "closed") return;
		const before = { id: row.id, status: row.status, closedReason: row.closedReason };
		update.mutate({ id: row.id, ...stageInput(status, closedReason) }, { onError: failed });
		showToast({
			title: status === "closed" ? t`Application closed` : t`Moved to ${getStageLabel(status)}`,
			undo: { label: t`Undo`, onUndo: () => restore([before]) },
		});
	};

	const moveMany = (
		rows: readonly StageRow[],
		status: ApplicationStatus,
		closedReason: ApplicationClosedReason | null = null,
	) => {
		const changed = rows.filter((row) => row.status !== status || status === "closed");
		if (changed.length === 0) return;
		const before = changed.map(({ id, status: from, closedReason: reason }) => ({
			id,
			status: from,
			closedReason: reason,
		}));
		bulkUpdate.mutate({ ids: changed.map((row) => row.id), ...stageInput(status, closedReason) }, { onError: failed });
		showToast({
			title:
				status === "closed"
					? plural(changed.length, { one: "# application closed", other: "# applications closed" })
					: plural(changed.length, {
							one: `# application moved to ${getStageLabel(status)}`,
							other: `# applications moved to ${getStageLabel(status)}`,
						}),
			undo: { label: t`Undo`, onUndo: () => restore(before) },
		});
	};

	return {
		pending: update.isPending || remove.isPending || bulkUpdate.isPending || bulkDelete.isPending,
		moveTo,
		moveMany,
		/** Permanent: confirm first. */
		remove: (id: string, onDone?: () => void) =>
			remove.mutate(
				{ id },
				{
					onSuccess: () => {
						showToast({ title: t`Application deleted` });
						onDone?.();
					},
					onError: failed,
				},
			),
		/** Permanent: confirm first. */
		removeMany: (ids: string[], onDone?: () => void) =>
			bulkDelete.mutate(
				{ ids },
				{
					onSuccess: ({ deleted }) => {
						showToast({ title: plural(deleted, { one: "# application deleted", other: "# applications deleted" }) });
						onDone?.();
					},
					onError: failed,
				},
			),
	};
}

// ---- Device reminders ----

/** The notification for one interview. The body has no time in it, so a time zone change needs no reschedule. */
export const interviewReminder = (
	application: Pick<Application, "id" | "company" | "role">,
	entry: InterviewTimelineEntry,
): ReminderTarget => ({
	kind: "interview",
	applicationId: application.id,
	entryId: entry.id,
	start: new Date(entry.at),
	title: t`${getInterviewKindLabel(entry.kind)} interview · ${application.company}`,
	body: [application.role, entry.location].filter(Boolean).join(" · "),
});

/** The notification for the follow-up; it fires at the follow-up itself (09:00 that day). */
export const followUpReminder = (
	application: Pick<Application, "id" | "company" | "role" | "followUpAt" | "followUpNote">,
): ReminderTarget | null =>
	application.followUpAt
		? {
				kind: "follow-up",
				applicationId: application.id,
				start: new Date(application.followUpAt),
				title: application.followUpNote || t`Follow up`,
				body: `${application.role} · ${application.company}`,
			}
		: null;

/** Everything that may have a reminder; a closed application has none. */
export function reminderTargets(
	application: Pick<Application, "id" | "status" | "activity" | "company" | "role" | "followUpAt" | "followUpNote">,
): ReminderTarget[] {
	if (application.status === "closed") return [];
	const followUp = followUpReminder(application);
	return [
		...application.activity.filter(isInterview).map((entry) => interviewReminder(application, entry)),
		...(followUp ? [followUp] : []),
	];
}
