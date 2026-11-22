// Saving, deleting and sharing one interview, and the device reminder that follows it: saved → the reminder is
// scheduled (asking for notifications the first time, behind the primer) or cancelled; deleted → cancelled.
import type { InterviewDraft } from "./draft";
import type { Application, ApplicationSummary } from "@/features/applications/types";
import type { InterviewTimelineEntry } from "@rezumi/schema/applications/data";
import { useLingui } from "@lingui/react/macro";
import { useMutation } from "@tanstack/react-query";
import { isInterview } from "@rezumi/career/applications";
import { icsFileName, interviewEvent } from "@rezumi/career/ics";
import { zonedParts } from "@rezumi/career/time";
import { draftDetails, draftStart } from "./draft";
import { orpc } from "@/api/client";
import { useInvalidateApplications } from "@/features/applications/queries";
import { interviewReminder } from "@/features/applications/queries";
import { getInterviewKindLabel } from "@/features/applications/stages";
import { shareIcs, useReminders } from "@/features/reminders";
import { showToast } from "@/ui";

type InterviewApplication = Pick<ApplicationSummary, "id" | "role" | "company" | "activity">;

export type ReminderChoice = { on: boolean; lead: number };

export function useInterviewActions(application: InterviewApplication) {
	const { t } = useLingui();
	const invalidate = useInvalidateApplications();
	const onSettled = () => void invalidate();
	const add = useMutation({ ...orpc.applications.addInterview.mutationOptions(), onSettled });
	const update = useMutation({ ...orpc.applications.updateInterview.mutationOptions(), onSettled });
	const removeEntry = useMutation({ ...orpc.applications.deleteTimelineEntry.mutationOptions(), onSettled });
	const reminders = useReminders(application.id);
	const target = (entryId: string) => ({ kind: "interview", applicationId: application.id, entryId }) as const;

	const followReminder = async (saved: Application, entryId: string, choice: ReminderChoice, hadOne: boolean) => {
		const entry = saved.activity.filter(isInterview).find((item) => item.id === entryId);
		if (!entry) return;
		if (!choice.on) {
			if (hadOne) await reminders.turnOff(target(entryId));
			return;
		}
		const result = await reminders.turnOn(interviewReminder(saved, entry), choice.lead);
		if (result === "denied")
			showToast({
				title: t`Interview saved without a reminder`,
				description: t`To get reminders, allow notifications for Rezumi in your device settings.`,
				variant: "warning",
			});
		if (result === "passed") showToast({ title: t`Interview saved. The reminder time has already passed.` });
	};

	/** Saves the draft; true once the interview is stored (its reminder follows, and says so if it can't). */
	const save = async (
		draft: InterviewDraft,
		interview: InterviewTimelineEntry | null | undefined,
		choice: ReminderChoice,
		hadReminder: boolean,
	) => {
		const at = draftStart(draft, interview);
		const details = draftDetails(draft);
		if (!at || !details.success) return false;
		const input = { id: application.id, at: at.toISOString(), ...details.data };
		let saved: Application;
		let entryId: string | undefined;
		try {
			if (interview) {
				saved = await update.mutateAsync({ ...input, entryId: interview.id });
				entryId = interview.id;
			} else {
				const known = new Set(application.activity.map((entry) => entry.id));
				saved = await add.mutateAsync(input);
				entryId = saved.activity.find((entry) => entry.type === "interview" && !known.has(entry.id))?.id;
			}
		} catch {
			showToast({
				title: interview
					? t`Couldn't update the interview. Try again.`
					: t`Couldn't confirm the save. Check the application before retrying to avoid a duplicate.`,
				variant: "danger",
			});
			return false;
		}
		showToast({ title: t`Interview saved`, variant: "success" });
		try {
			if (entryId) await followReminder(saved, entryId, choice, hadReminder);
		} catch {
			showToast({ title: t`Interview saved. Couldn't update its reminder. Edit the interview to try again.` });
		}
		return true;
	};

	/** Deletes the interview for good (the caller has confirmed) and cancels its reminder. */
	const remove = async (interview: InterviewTimelineEntry) => {
		try {
			await removeEntry.mutateAsync({ id: application.id, entryId: interview.id });
		} catch {
			showToast({ title: t`Couldn't delete the interview. Try again.`, variant: "danger" });
			return false;
		}
		await reminders.turnOff(target(interview.id)).catch(() => undefined);
		showToast({ title: t`Interview deleted` });
		return true;
	};

	/** Shares the saved interview as an .ics file (Add to calendar); no calendar permission is needed. */
	const share = async (interview: InterviewTimelineEntry, timeZone: string) => {
		const title = t`${getInterviewKindLabel(interview.kind)} interview · ${application.company}`;
		try {
			await shareIcs(
				interviewEvent(interview, title),
				icsFileName(application.company, zonedParts(interview.at, timeZone).date),
			);
		} catch {
			showToast({ title: t`Couldn't open the share sheet. Try again.`, variant: "danger" });
		}
	};

	return {
		save,
		remove,
		share,
		pending: add.isPending || update.isPending || removeEntry.isPending,
		leadFor: (entryId: string) => reminders.leadFor(target(entryId)),
	};
}
