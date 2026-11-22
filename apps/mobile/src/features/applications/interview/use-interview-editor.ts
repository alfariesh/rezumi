// The interview sheet's state: the draft, the reminder choice, what is wrong with them, and the actions. The sheet,
// its fields and its footer all read this one object.
import type { InterviewDraft } from "./draft";
import type { ReminderChoice } from "./use-interview-actions";
import type { ApplicationSummary } from "@/features/applications/types";
import type { InterviewTimelineEntry } from "@rezumi/schema/applications/data";
import { useRef, useState } from "react";
import { draftDetails, draftFrom, draftStart, emptyDraft } from "./draft";
import { useInterviewActions } from "./use-interview-actions";
import { useUserTime } from "@/features/applications/date";
import { DEFAULT_LEAD, allowReminders } from "@/features/reminders";

type EditorOptions = {
	application: Pick<ApplicationSummary, "id" | "role" | "company" | "activity">;
	interview?: InterviewTimelineEntry | null | undefined;
	initial?: { date: string; time: string } | undefined;
	/** Called once the interview is saved or deleted. */
	onDone: () => void;
};

export function useInterviewEditor({ application, interview, initial, onDone }: EditorOptions) {
	const userTime = useUserTime();
	const actions = useInterviewActions(application);
	const [start] = useState(() =>
		interview ? draftFrom(interview, userTime.timeZone) : emptyDraft(userTime.timeZone, initial),
	);
	const [draft, setDraft] = useState(start);
	const [remind, setRemind] = useState<ReminderChoice | null>(null);
	const [view, setView] = useState<"form" | "zone">("form");
	const busy = useRef(false);
	const existingLead = interview ? actions.leadFor(interview.id) : null;
	const reminder = remind ?? { on: existingLead !== null, lead: existingLead ?? DEFAULT_LEAD };

	const at = draftStart(draft, interview);
	const details = draftDetails(draft);
	const peopleInvalid = details.error?.issues.some((issue) => issue.path[0] === "participants") ?? false;
	const dirty =
		JSON.stringify(draft) !== JSON.stringify(start) ||
		(remind !== null && (remind.on !== (existingLead !== null) || remind.lead !== (existingLead ?? DEFAULT_LEAD)));

	const set = <K extends keyof InterviewDraft>(key: K, value: InterviewDraft[K]) => {
		if (!busy.current) setDraft((current) => ({ ...current, [key]: value }));
	};

	/** A reminder turned on asks for notifications then (the primer first); refused, it stays off. */
	const setReminderOn = async (on: boolean) => {
		if (!on) return setRemind({ ...reminder, on: false });
		setRemind({ ...reminder, on: true });
		if (!(await allowReminders())) setRemind({ ...reminder, on: false });
	};

	const run = async (task: () => Promise<boolean>) => {
		if (busy.current) return;
		busy.current = true;
		const done = await task();
		busy.current = false;
		if (done) onDone();
	};

	return {
		application,
		interview: interview ?? null,
		draft,
		set,
		at,
		canSave: !!at && details.success && !actions.pending,
		peopleInvalid,
		dirty,
		pending: actions.pending,
		userTime,
		reminder,
		setReminderOn,
		setLead: (lead: number) => setRemind({ ...reminder, lead }),
		view,
		setView,
		save: () => run(() => actions.save(draft, interview, reminder, existingLead !== null)),
		remove: () => run(() => (interview ? actions.remove(interview) : Promise.resolve(false))),
		share: () => (interview ? actions.share(interview, userTime.timeZone) : Promise.resolve()),
	};
}

export type InterviewEditor = ReturnType<typeof useInterviewEditor>;
