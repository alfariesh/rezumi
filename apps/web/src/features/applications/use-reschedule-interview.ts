import type { ScheduledInterview } from "./interviews";
import type { ApplicationSummary } from "./types";
import { t } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "@rezumi/ui/components/toast";
import { applicationDetailQueryKey, applicationsListQueryKey } from "./queries";
import { toastError } from "@/libs/error-message";
import { orpc } from "@/libs/orpc/client";

type RescheduleInput = { id: string; entryId: string; at: string; durationMinutes: number };

const MIN_MINUTES = 5;
const MAX_MINUTES = 24 * 60;

/**
 * Moves or resizes an interview (calendar drag). The calendar updates at once; a toast says where it went and offers
 * Undo, which puts the old time back. The server moves the interview's briefing schedule with it.
 */
export function useRescheduleInterview() {
	const queryClient = useQueryClient();
	const { i18n } = useLingui();
	const listKey = applicationsListQueryKey();

	const applyTo = (input: RescheduleInput) => {
		const at = new Date(input.at);
		const patch = <T extends Pick<ApplicationSummary, "id" | "activity">>(item: T): T =>
			item.id === input.id
				? {
						...item,
						activity: item.activity.map((entry) =>
							entry.id === input.entryId && entry.type === "interview"
								? { ...entry, at, durationMinutes: input.durationMinutes }
								: entry,
						),
					}
				: item;
		queryClient.setQueryData(listKey, (rows) => rows?.map(patch));
		queryClient.setQueryData(applicationDetailQueryKey(input.id), (item) => item && patch(item));
	};

	const mutation = useMutation({
		...orpc.applications.updateInterview.mutationOptions(),
		onMutate: async (input) => {
			const detailKey = applicationDetailQueryKey(input.id);
			await Promise.all([
				queryClient.cancelQueries({ queryKey: listKey }),
				queryClient.cancelQueries({ queryKey: detailKey }),
			]);
			const previous = { list: queryClient.getQueryData(listKey), detail: queryClient.getQueryData(detailKey) };
			if (input.at && input.durationMinutes)
				applyTo({ ...input, at: input.at, durationMinutes: input.durationMinutes });
			return previous;
		},
		onError: (error, input, context) => {
			if (context?.list) queryClient.setQueryData(listKey, context.list);
			if (context?.detail) queryClient.setQueryData(applicationDetailQueryKey(input.id), context.detail);
			toastError(error, t`Couldn't move the interview. Try again.`);
		},
		onSettled: (_data, _error, input) => {
			void queryClient.invalidateQueries({ queryKey: listKey });
			void queryClient.invalidateQueries({ queryKey: applicationDetailQueryKey(input.id) });
		},
	});

	return (item: ScheduledInterview, start: Date, end: Date) => {
		const durationMinutes = Math.min(
			MAX_MINUTES,
			Math.max(MIN_MINUTES, Math.round((end.getTime() - start.getTime()) / 60_000)),
		);
		const before: RescheduleInput = {
			id: item.application.id,
			entryId: item.interview.id,
			at: item.start.toISOString(),
			durationMinutes: item.interview.durationMinutes,
		};
		const input: RescheduleInput = { ...before, at: start.toISOString(), durationMinutes };
		if (input.at === before.at && input.durationMinutes === before.durationMinutes) return;

		const moved = input.at !== before.at;
		const format = (options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(i18n.locale, options);
		const when = format({
			weekday: "short",
			day: "numeric",
			month: "short",
			hour: "numeric",
			minute: "2-digit",
		}).format(start);
		const endTime = format({ hour: "numeric", minute: "2-digit" }).format(end);

		mutation.mutate(input, {
			onSuccess: () => {
				const id = toast.add({
					type: "success",
					description: moved ? t`Interview moved to ${when}` : t`Interview now ends at ${endTime}`,
					actionProps: {
						children: t`Undo`,
						onPress: () => {
							toast.close(id);
							mutation.mutate(before);
						},
					},
				});
			},
		});
	};
}
