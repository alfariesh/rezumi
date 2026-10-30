import type { ReschedulableInterview } from "./use-reschedule-interview";
import type { ApplicationSummary as Application } from "@/features/applications/types";
import { useLingui } from "@lingui/react/macro";
import { useState } from "react";
import { View } from "react-native";
import { fromZonedDateTime } from "@rezumi/utils/timezone";
import { WallClockField } from "@/features/application-detail/date-field";
import { interviewTypeLabel, useUserTime } from "@/features/application-detail/hooks";
import { isTimeZone, zonedParts } from "@/features/reminders";
import { Button, Segmented, Sheet, Text, useTheme } from "@/ui";

const LENGTHS = [30, 45, 60, 90];

export type RescheduleTarget = ReschedulableInterview & { application: Application };

type RescheduleSheetProps = {
	target: RescheduleTarget | null;
	open: boolean;
	onClose: () => void;
	/** `useRescheduleInterview`'s function, owned by the calendar so its Undo toast outlives this sheet. */
	onReschedule: (target: RescheduleTarget, start: Date, durationMinutes: number) => void;
};

/**
 * The way to reschedule without dragging: a new date, time and length for one interview. Saving moves it at once and
 * offers Undo, like a drag on the calendar.
 */
export function RescheduleSheet({ target, open, onClose, onReschedule }: RescheduleSheetProps) {
	const { t } = useLingui();
	return (
		<Sheet open={open && !!target} onClose={onClose} title={t`Reschedule interview`}>
			{/* Keyed by the stored time too, so reopening after a move starts from where the interview is now. */}
			{target ? (
				<RescheduleForm
					key={`${target.interview.id}:${String(target.interview.at)}:${target.interview.durationMinutes}`}
					target={target}
					onClose={onClose}
					onReschedule={onReschedule}
				/>
			) : null}
		</Sheet>
	);
}

type RescheduleFormProps = Pick<RescheduleSheetProps, "onClose" | "onReschedule"> & { target: RescheduleTarget };

function RescheduleForm({ target, onClose, onReschedule }: RescheduleFormProps) {
	const { t } = useLingui();
	const { space } = useTheme();
	const userTime = useUserTime();
	const { application, interview } = target;
	// The time is the interview's own wall clock, as in the interview editor.
	const timeZone = interview.timezone && isTimeZone(interview.timezone) ? interview.timezone : userTime.timeZone;
	const [initial] = useState(() => ({
		...zonedParts(interview.at, timeZone),
		durationMinutes: interview.durationMinutes,
	}));
	const [draft, setDraft] = useState(initial);
	const unchanged = draft.date === initial.date && draft.time === initial.time;
	// Keep the exact stored instant when the clock time is unchanged, including inside a DST overlap.
	const at = unchanged ? new Date(interview.at) : fromZonedDateTime(draft.date, draft.time, timeZone);
	const lengths = LENGTHS.includes(draft.durationMinutes)
		? LENGTHS
		: [...LENGTHS, draft.durationMinutes].sort((a, b) => a - b);

	return (
		<View style={{ padding: space.s4, gap: space.s4 }}>
			<Text color="ink2">
				{interviewTypeLabel(interview.kind)} · {application.role} · {application.company}
			</Text>
			<View style={{ flexDirection: "row", gap: space.s4 }}>
				<WallClockField
					label={t`Date`}
					mode="date"
					value={draft.date}
					onChange={(date) => setDraft((current) => ({ ...current, date }))}
				/>
				<WallClockField
					label={t`Time · ${timeZone}`}
					mode="time"
					value={draft.time}
					onChange={(time) => setDraft((current) => ({ ...current, time }))}
					error={at ? undefined : t`This time does not exist in the selected timezone. Choose another time.`}
				/>
			</View>
			<View style={{ gap: space.s2 }}>
				<Text variant="callout" color="ink2">
					{t`Length · minutes`}
				</Text>
				<Segmented
					label={t`Length in minutes`}
					value={String(draft.durationMinutes)}
					options={lengths.map((minutes) => ({ value: String(minutes), label: String(minutes) }))}
					onChange={(minutes) => setDraft((current) => ({ ...current, durationMinutes: Number(minutes) }))}
				/>
			</View>
			{at && timeZone !== userTime.timeZone ? (
				<Text variant="callout" color="ink3">
					{t`${draft.time} in ${timeZone} is ${userTime.when(at)} in your timezone (${userTime.timeZone}).`}
				</Text>
			) : null}
			<Button
				fullWidth
				label={t`Move interview`}
				disabled={!at || (unchanged && draft.durationMinutes === initial.durationMinutes)}
				onPress={() => {
					if (!at) return;
					onReschedule(target, at, draft.durationMinutes);
					onClose();
				}}
			/>
		</View>
	);
}
