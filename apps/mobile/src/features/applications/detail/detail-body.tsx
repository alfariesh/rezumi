// One application's detail, shared by the sheet (phones) and the pane beside the list (tablets): header and stage,
// Open workspace, next step, interviews, notes, contacts, what was sent, files, the posting, details and activity.
// Moves and closes have Undo; Delete asks first. Device reminders follow the stored application.
import type { Application } from "../types";
import type { InterviewTimelineEntry } from "@rezumi/schema/applications/data";
import { useLingui } from "@lingui/react/macro";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { View } from "react-native";
import { InterviewSheet } from "../interview-sheet";
import { reminderTargets, useApplicationActions } from "../queries";
import { Activity } from "./activity";
import { Attachments } from "./attachments";
import { Contacts } from "./contacts";
import { DetailHeader, StageSection } from "./detail-header";
import { EditDetailsSheet, Facts } from "./facts";
import { Interviews } from "./interviews";
import { NextStepCard } from "./next-step-card";
import { Notes } from "./notes";
import { Posting, openPosting } from "./posting";
import { SentDocuments } from "./sent-documents";
import { CloseSheet, MarkAppliedSheet } from "./stage-sheets";
import { syncReminders } from "@/features/reminders";
import { routes } from "@/routes";
import { Alert, Button, ConfirmDialog, Icon } from "@/ui";

type Overlay =
	| { kind: "interview"; interview: InterviewTimelineEntry | null }
	| { kind: "close" | "applied" | "edit" | "delete" }
	| null;

type DetailBodyProps = {
	application: Application;
	/** The pane shows the role as its heading; the sheet has it in its title row. */
	showTitle: boolean;
	/** Showing what's stored on the device: a refresh failed or the app is offline. */
	stale: boolean;
	onClose: () => void;
};

export function DetailBody({ application, showTitle, stale, onClose }: DetailBodyProps) {
	const { t } = useLingui();
	const router = useRouter();
	const actions = useApplicationActions();
	const [overlay, setOverlay] = useState<Overlay>(null);
	const closeOverlay = (open: boolean) => !open && setOverlay(null);
	const openInterview = (interview: InterviewTimelineEntry | null) => setOverlay({ kind: "interview", interview });

	// Interviews moved or deleted elsewhere (the web, another device) move or cancel this device's reminders. Query
	// results keep their identity while unchanged, so this runs once per stored version.
	useEffect(() => {
		void syncReminders(application.id, reminderTargets(application)).catch(() => undefined);
	}, [application]);

	return (
		<View className="gap-6 pb-6" testID="application-detail">
			<View className="gap-4">
				<DetailHeader
					application={application}
					showTitle={showTitle}
					onViewPosting={
						application.sourceUrl
							? () => openPosting(application.sourceUrl ?? "", t`Couldn't open the posting. Try again.`)
							: null
					}
					onEdit={() => setOverlay({ kind: "edit" })}
					onDelete={() => setOverlay({ kind: "delete" })}
				/>
				{stale ? (
					<Alert status="warning">
						<Alert.Indicator />
						<Alert.Content>
							<Alert.Title>{t`Showing the details saved on this device. They couldn't be refreshed.`}</Alert.Title>
						</Alert.Content>
					</Alert>
				) : null}
				<StageSection
					application={application}
					onMove={(status) => actions.moveTo(application, status)}
					onMarkApplied={() => setOverlay({ kind: "applied" })}
					onClose={() => setOverlay({ kind: "close" })}
				/>
				<Button
					variant="primary"
					onPress={() => router.push(routes.application(application.id))}
					testID="open-workspace"
				>
					<Button.Label>{t`Open workspace`}</Button.Label>
					<Icon name="arrow-right" size={16} tone="accent-foreground" />
				</Button>
			</View>
			<NextStepCard application={application} onInterview={openInterview} />
			<Interviews application={application} onOpen={openInterview} />
			<Notes key={application.id} application={application} />
			<Contacts application={application} />
			<SentDocuments application={application} />
			<Attachments application={application} />
			<Posting application={application} />
			<Facts application={application} onEdit={() => setOverlay({ kind: "edit" })} />
			<Activity application={application} onInterview={openInterview} />
			<Button variant="danger-soft" onPress={() => setOverlay({ kind: "delete" })} testID="detail-delete">
				<Icon name="trash" size={16} tone="danger" />
				<Button.Label>{t`Delete application…`}</Button.Label>
			</Button>

			<InterviewSheet
				applicationId={application.id}
				interview={overlay?.kind === "interview" ? overlay.interview : null}
				isOpen={overlay?.kind === "interview"}
				onOpenChange={closeOverlay}
			/>
			<CloseSheet
				isOpen={overlay?.kind === "close"}
				onOpenChange={closeOverlay}
				onPick={(reason) => actions.moveTo(application, "closed", reason)}
			/>
			<MarkAppliedSheet application={application} isOpen={overlay?.kind === "applied"} onOpenChange={closeOverlay} />
			<EditDetailsSheet application={application} isOpen={overlay?.kind === "edit"} onOpenChange={closeOverlay} />
			<ConfirmDialog
				isOpen={overlay?.kind === "delete"}
				onOpenChange={closeOverlay}
				title={t`Delete this application?`}
				message={t`“${application.role} · ${application.company}” and its timeline are deleted permanently. This can't be undone.`}
				confirmLabel={t`Delete application`}
				cancelLabel={t`Keep application`}
				destructive
				onConfirm={() => actions.remove(application.id, onClose)}
			/>
		</View>
	);
}
