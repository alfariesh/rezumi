import type { RouterOutput } from "./api";
import { Button } from "@heroui/react";
import { Trans, useLingui } from "@lingui/react/macro";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { followUpAt, followUpDay } from "../shared/follow-ups";
import { askWorker, orpc } from "./api";
import { errorKind } from "./errors";
import { TextField } from "./fields";
import { SaveError } from "./save-error";

type ReminderFieldsProps = {
	day: string;
	note: string;
	onChange: (patch: { followUpOn?: string; followUpNote?: string }) => void;
	/** Shown under the date: why it starts where it does. */
	hint?: string | null;
};

/** 01-desain.md §3.3 item 4: the reminder's day and a short note. */
export function ReminderFields({ day, note, onChange, hint }: ReminderFieldsProps) {
	const { t } = useLingui();
	return (
		<fieldset className="flex flex-col gap-2">
			<legend className="mb-1 text-sm font-medium">
				<Trans comment="Browser extension: the follow-up reminder for this application">Reminder</Trans>
			</legend>
			<TextField
				label={t`Follow up on`}
				type="date"
				value={day}
				maxLength={10}
				onChange={(followUpOn) => onChange({ followUpOn })}
			/>
			{hint ? <p className="text-xs text-muted">{hint}</p> : null}
			{day ? (
				<TextField
					label={t`Reminder note`}
					value={note}
					maxLength={500}
					placeholder={t`Ask the recruiter for an update`}
					onChange={(followUpNote) => onChange({ followUpNote })}
				/>
			) : null}
		</fieldset>
	);
}

type Application = RouterOutput["applications"]["getById"];

/** 01-desain.md §3.4: change or clear the saved application's reminder; the badge and due list follow at once. */
export function ReminderEditor({ application }: { application: Application }) {
	const { t } = useLingui();
	const queryClient = useQueryClient();
	const update = useMutation(orpc.applications.update.mutationOptions());
	const savedDay = application.followUpAt ? followUpDay(application.followUpAt) : "";
	const savedNote = application.followUpNote ?? "";
	const [day, setDay] = useState(savedDay);
	const [note, setNote] = useState(savedNote);
	const changed = day !== savedDay || (day !== "" && note.trim() !== savedNote);

	const save = (next: { day: string; note: string }) =>
		update.mutate(
			{
				id: application.id,
				followUpAt: followUpAt(next.day),
				followUpNote: next.day ? next.note.trim().slice(0, 500) || null : null,
			},
			{
				onSuccess: () => {
					void askWorker({ type: "follow-ups" });
					void queryClient.invalidateQueries({ queryKey: orpc.applications.key() });
				},
			},
		);

	return (
		<form
			className="flex flex-col gap-2"
			onSubmit={(event) => {
				event.preventDefault();
				save({ day, note });
			}}
		>
			<ReminderFields
				day={day}
				note={note}
				onChange={(patch) => {
					if (patch.followUpOn !== undefined) setDay(patch.followUpOn);
					if (patch.followUpNote !== undefined) setNote(patch.followUpNote);
				}}
			/>
			<div aria-live="polite">
				{update.isError ? (
					<SaveError kind={errorKind(update.error)} onRetry={() => save({ day, note })} />
				) : update.isSuccess && !changed ? (
					<p className="text-xs text-success">{savedDay ? t`Reminder saved.` : t`Reminder cleared.`}</p>
				) : null}
			</div>
			<div className="flex gap-2">
				<Button type="submit" size="sm" variant="secondary" isPending={update.isPending} isDisabled={!changed}>
					<Trans>Save reminder</Trans>
				</Button>
				{savedDay ? (
					<Button
						size="sm"
						variant="tertiary"
						isDisabled={update.isPending}
						onPress={() => {
							setDay("");
							setNote("");
							save({ day: "", note: "" });
						}}
					>
						<Trans>Clear</Trans>
					</Button>
				) : null}
			</div>
		</form>
	);
}
