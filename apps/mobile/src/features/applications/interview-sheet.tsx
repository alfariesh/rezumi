// Schedule or edit one interview (kind, date and time on the interview's clock, length, place, people, notes, reminder,
// Add to calendar), and delete it. Device reminders follow the saved interview (`@/features/reminders`). Each opening
// starts from the stored interview (or the tapped slot); leaving with changes asks first.
import type { InterviewEditor } from "./interview/use-interview-editor";
import type { InterviewTimelineEntry } from "@rezumi/schema/applications/data";
import { useLingui } from "@lingui/react/macro";
import { useState } from "react";
import { View } from "react-native";
import { InterviewFields } from "./interview/interview-fields";
import { useInterviewEditor } from "./interview/use-interview-editor";
import { useApplication, useApplications } from "./queries";
import { Button, ConfirmDialog, Sheet, Skeleton } from "@/ui";

export type InterviewSheetProps = {
	applicationId: string;
	/** The interview to edit; null or undefined schedules a new one. */
	interview?: InterviewTimelineEntry | null | undefined;
	/** A new interview's starting slot on the user's clock (from a tap on the calendar grid). */
	initial?: { date: string; time: string } | undefined;
	isOpen: boolean;
	onOpenChange: (open: boolean) => void;
};

/** The application from the list everyone shares, or its detail when the list isn't loaded. */
function useInterviewApplication(id: string) {
	const list = useApplications();
	const detail = useApplication(list.data ? "" : id);
	return list.data?.find((item) => item.id === id) ?? detail.data;
}

export function InterviewSheet(props: InterviewSheetProps) {
	const { t } = useLingui();
	const application = useInterviewApplication(props.applicationId);
	// A new session on every opening, so the draft starts from what is stored now.
	const [session, setSession] = useState(0);
	const [wasOpen, setWasOpen] = useState(props.isOpen);
	if (props.isOpen !== wasOpen) {
		setWasOpen(props.isOpen);
		if (props.isOpen) setSession((count) => count + 1);
	}
	if (!application)
		return (
			<Sheet isOpen={props.isOpen} onOpenChange={props.onOpenChange} title={t`Interview`} closeLabel={t`Close`}>
				<View className="gap-3">
					<Skeleton variant="none" className="h-10 rounded-xl" />
					<Skeleton variant="none" className="h-24 rounded-xl" />
				</View>
			</Sheet>
		);
	return <InterviewSheetSession key={session} {...props} application={application} />;
}

type SessionProps = InterviewSheetProps & { application: InterviewEditor["application"] };

function InterviewSheetSession({ application, interview, initial, isOpen, onOpenChange }: SessionProps) {
	const { t } = useLingui();
	const [discarding, setDiscarding] = useState(false);
	const [deleting, setDeleting] = useState(false);
	const editor = useInterviewEditor({ application, interview, initial, onDone: () => onOpenChange(false) });
	const zone = editor.view === "zone";
	return (
		<>
			<Sheet
				isOpen={isOpen}
				onOpenChange={onOpenChange}
				title={zone ? t`Interview time zone` : interview ? t`Edit interview` : t`Schedule an interview`}
				closeLabel={t`Close`}
				detents={[0.92]}
				canDismiss={!editor.dirty && !editor.pending}
				onDismissAttempt={() => {
					if (!editor.pending) setDiscarding(true);
				}}
				footer={<InterviewFooter editor={editor} />}
				testID="interview-sheet"
			>
				<InterviewFields editor={editor} onDelete={() => setDeleting(true)} />
			</Sheet>
			<ConfirmDialog
				isOpen={discarding}
				onOpenChange={setDiscarding}
				title={t`Discard your changes?`}
				message={t`The interview stays as it was.`}
				confirmLabel={t`Discard`}
				cancelLabel={t`Keep editing`}
				destructive
				onConfirm={() => onOpenChange(false)}
			/>
			<ConfirmDialog
				isOpen={deleting}
				onOpenChange={setDeleting}
				title={t`Delete this interview?`}
				message={t`Its notes, people and reminder go too. This can't be undone.`}
				confirmLabel={t`Delete interview`}
				cancelLabel={t`Keep interview`}
				destructive
				onConfirm={() => void editor.remove()}
			/>
		</>
	);
}

type InterviewFooterProps = { editor: InterviewEditor };

/** Save, or Back to the form from the time zone list. */
export function InterviewFooter({ editor }: InterviewFooterProps) {
	const { t } = useLingui();
	if (editor.view === "zone")
		return (
			<Button variant="secondary" onPress={() => editor.setView("form")}>
				<Button.Label>{t`Back to the interview`}</Button.Label>
			</Button>
		);
	return (
		<Button variant="primary" isDisabled={!editor.canSave} onPress={() => void editor.save()} testID="interview-save">
			<Button.Label>{editor.pending ? t`Saving…` : t`Save interview`}</Button.Label>
		</Button>
	);
}
