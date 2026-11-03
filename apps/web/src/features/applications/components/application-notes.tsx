import type { Application } from "../types";
import { Widget } from "@heroui-pro/react";
import { TextArea } from "@heroui/react";
import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useId, useState } from "react";
import { toast } from "@rezumi/ui/components/toast";
import { useInvalidateApplications } from "../use-application-actions";
import { WidgetAction, WidgetHeading } from "@/components/layout/widget-heading";
import { orpc } from "@/libs/orpc/client";

type ApplicationNotesProps = { application: Pick<Application, "id" | "notes"> };

// Notes save a moment after typing stops.
const NOTES_SAVE_DELAY_MS = 800;
const drafts = new Map<string, string>();
const saves = new Map<string, Promise<void>>();

export function ApplicationNotes({ application }: ApplicationNotesProps) {
	const id = useId();
	const invalidate = useInvalidateApplications();
	const queryClient = useQueryClient();
	const [notes, setNotes] = useState(() => drafts.get(application.id) ?? application.notes ?? "");
	const { mutateAsync, isError } = useMutation({
		...orpc.applications.update.mutationOptions(),
		onSuccess: () => invalidate(application.id),
		onError: () => toast.add({ type: "error", description: t`Couldn't save the notes. Try again.` }),
	});
	const save = useCallback(() => {
		const pending: Promise<void> = (saves.get(application.id) ?? Promise.resolve())
			.then(async () => {
				const value = drafts.get(application.id);
				if (value === undefined) return;
				await mutateAsync({ id: application.id, notes: value.trim() ? value : null });
				queryClient.setQueryData<Application>(
					orpc.applications.getById.queryKey({ input: { id: application.id } }),
					(current) => (current ? { ...current, notes: value.trim() ? value : null } : current),
				);
				if (drafts.get(application.id) === value) drafts.delete(application.id);
			})
			.catch(() => {}) // The mutation reports failure; retain the draft for retry.
			.finally(() => {
				if (saves.get(application.id) === pending) saves.delete(application.id);
			});
		saves.set(application.id, pending);
		return pending;
	}, [application.id, mutateAsync, queryClient]);

	useEffect(() => {
		if (!drafts.has(application.id)) return;
		const timeout = window.setTimeout(() => {
			void save();
		}, NOTES_SAVE_DELAY_MS);
		return () => window.clearTimeout(timeout);
	}, [notes, application.id, save]);

	// Closing the sheet mid-sentence still saves what was typed.
	useEffect(
		() => () => {
			void save();
		},
		[save],
	);

	return (
		<Widget role="region" aria-labelledby={`${id}-title`}>
			<WidgetHeading
				id={`${id}-title`}
				icon="note-pencil"
				title={<Trans>Notes</Trans>}
				action={
					isError && (
						<WidgetAction
							onPress={() => {
								void save();
							}}
						>
							<Trans>Retry save</Trans>
						</WidgetAction>
					)
				}
			/>
			{/* The area is the widget's content: the white `widget__content` surface, with no frame inside it. */}
			<TextArea
				id={id}
				aria-labelledby={`${id}-title`}
				rows={4}
				value={notes}
				placeholder={t`Anything to remember about this job`}
				className="widget__content mt-0 block w-[calc(100%-0.75rem)] resize-none rounded-xl border-0 bg-surface shadow-none"
				onChange={(event) => {
					drafts.set(application.id, event.target.value);
					setNotes(event.target.value);
				}}
			/>
		</Widget>
	);
}
