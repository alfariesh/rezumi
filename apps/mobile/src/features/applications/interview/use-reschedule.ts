// Moves or resizes an interview (a calendar drag, its screen-reader actions, or Move earlier/later), as web's
// `useRescheduleInterview`. The calendar shows the new time at once; a toast says where it went and offers Undo,
// which puts the old time back. The server moves the interview's briefing with it; this device's reminder follows.
import type { Application, ApplicationSummary } from "@/features/applications/types";
import type { InterviewTimelineEntry } from "@rezumi/schema/applications/data";
import { useLingui } from "@lingui/react/macro";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { withInterviewTime } from "@rezumi/career/calendar";
import { orpc } from "@/api/client";
import { useUserTime } from "@/features/applications/date";
import {
	applicationDetailQueryKey,
	applicationsListQueryKey,
	reminderTargets,
	useInvalidateApplications,
} from "@/features/applications/queries";
import { syncReminders } from "@/features/reminders";
import { showToast } from "@/ui";

type RescheduleInput = { id: string; entryId: string; at: string; durationMinutes: number };

/** What to reschedule: the interview and the application it belongs to. */
export type ReschedulableInterview = { application: Pick<ApplicationSummary, "id">; interview: InterviewTimelineEntry };

const MIN_MINUTES = 5;
const MAX_MINUTES = 24 * 60;

export function useRescheduleInterview() {
	const { t } = useLingui();
	const queryClient = useQueryClient();
	const invalidate = useInvalidateApplications();
	const userTime = useUserTime();

	const applyTo = (input: RescheduleInput) => {
		const change = { ...input, at: new Date(input.at) };
		queryClient.setQueryData<ApplicationSummary[]>(applicationsListQueryKey(), (rows) =>
			rows?.map((row) => withInterviewTime(row, change)),
		);
		queryClient.setQueryData<Application>(
			applicationDetailQueryKey(input.id),
			(item) => item && withInterviewTime(item, change),
		);
	};

	const mutation = useMutation({
		...orpc.applications.updateInterview.mutationOptions(),
		onMutate: async (input) => {
			const listKey = applicationsListQueryKey();
			const detailKey = applicationDetailQueryKey(input.id);
			await Promise.all([
				queryClient.cancelQueries({ queryKey: listKey }),
				queryClient.cancelQueries({ queryKey: detailKey }),
			]);
			const previous = {
				listKey,
				detailKey,
				list: queryClient.getQueryData<ApplicationSummary[]>(listKey),
				detail: queryClient.getQueryData<Application>(detailKey),
			};
			if (input.at && input.durationMinutes)
				applyTo({ ...input, at: input.at, durationMinutes: input.durationMinutes });
			return previous;
		},
		onError: (_error, _input, context) => {
			if (context?.list) queryClient.setQueryData(context.listKey, context.list);
			if (context?.detail) queryClient.setQueryData(context.detailKey, context.detail);
			showToast({ title: t`Couldn't move the interview. Try again.`, variant: "danger" });
		},
		onSuccess: (saved) => void syncReminders(saved.id, reminderTargets(saved)).catch(() => undefined),
		onSettled: () => void invalidate(),
	});

	return (item: ReschedulableInterview, start: Date, durationMinutes: number) => {
		const before: RescheduleInput = {
			id: item.application.id,
			entryId: item.interview.id,
			at: new Date(item.interview.at).toISOString(),
			durationMinutes: item.interview.durationMinutes,
		};
		const input: RescheduleInput = {
			...before,
			at: start.toISOString(),
			durationMinutes: Math.min(MAX_MINUTES, Math.max(MIN_MINUTES, Math.round(durationMinutes))),
		};
		if (input.at === before.at && input.durationMinutes === before.durationMinutes) return;
		const moved = input.at !== before.at;
		const when = userTime.when(start);
		const endTime = userTime.time(new Date(start.getTime() + input.durationMinutes * 60_000));
		// The toast lives on mutate's callbacks: the calendar (not a sheet) owns this hook, so it outlives the drag.
		mutation.mutate(input, {
			onSuccess: () =>
				showToast({
					title: moved ? t`Interview moved to ${when}` : t`Interview now ends at ${endTime}`,
					undo: { label: t`Undo`, onUndo: () => mutation.mutate(before) },
				}),
		});
	};
}
