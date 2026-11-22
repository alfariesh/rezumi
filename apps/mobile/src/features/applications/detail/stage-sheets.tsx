// The detail's stage sheets: Close with a reason (kept for Insights), and Mark as applied (Saved → Applied: the day
// and the documents actually sent; their current versions are kept).
import type { Application } from "../types";
import type { ApplicationClosedReason } from "@rezumi/schema/applications/data";
import { useLingui } from "@lingui/react/macro";
import { useState } from "react";
import { View } from "react-native";
import { todayKey } from "../date";
import { ReasonChoices } from "../list/choices";
import { useApplicationMutations } from "../queries";
import { DocumentChoice } from "./document-choice";
import { Button, DatePicker, ListRow, ListSection, Sheet, Switch, Text, showToast } from "@/ui";

type CloseSheetProps = {
	isOpen: boolean;
	onOpenChange: (open: boolean) => void;
	onPick: (reason: ApplicationClosedReason) => void;
};

export function CloseSheet({ isOpen, onOpenChange, onPick }: CloseSheetProps) {
	const { t } = useLingui();
	return (
		<Sheet isOpen={isOpen} onOpenChange={onOpenChange} title={t`Close this application`} closeLabel={t`Close`}>
			<ReasonChoices
				onPick={(reason) => {
					onOpenChange(false);
					onPick(reason);
				}}
			/>
		</Sheet>
	);
}

type MarkAppliedSheetProps = { application: Application; isOpen: boolean; onOpenChange: (open: boolean) => void };

export function MarkAppliedSheet({ application, isOpen, onOpenChange }: MarkAppliedSheetProps) {
	const { t } = useLingui();
	return (
		<Sheet isOpen={isOpen} onOpenChange={onOpenChange} title={t`Mark as applied`} closeLabel={t`Close`}>
			{isOpen ? <MarkAppliedForm application={application} onDone={() => onOpenChange(false)} /> : null}
		</Sheet>
	);
}

type MarkAppliedFormProps = { application: Application; onDone: () => void };

export function MarkAppliedForm({ application, onDone }: MarkAppliedFormProps) {
	const { t, i18n } = useLingui();
	const { update } = useApplicationMutations();
	const [date, setDate] = useState<string | null>(todayKey);
	const [resumeId, setResumeId] = useState(application.resumeId ?? "");
	const [letterId, setLetterId] = useState(application.coverLetterId ?? "");
	const [resumeFileSent, setResumeFileSent] = useState(true);
	const [letterFileSent, setLetterFileSent] = useState(true);
	const confirm = () => {
		if (!date) return;
		update.mutate(
			{
				id: application.id,
				status: "applied",
				stageEnteredAt: date,
				resumeId: resumeId || null,
				coverLetterId: letterId || null,
				...(!resumeFileSent ? { resumeFileUrl: null, resumeFileName: null } : {}),
				...(!letterFileSent ? { coverLetterUrl: null, coverLetterName: null } : {}),
			},
			{
				onSuccess: () => {
					onDone();
					showToast({ title: t`Marked as applied`, variant: "success" });
				},
				onError: () => showToast({ title: t`Couldn't record the submission. Try again.`, variant: "danger" }),
			},
		);
	};
	return (
		<View className="gap-4 pb-2">
			<Text tone="muted">{t`Choose the documents you actually sent. Their current versions are kept.`}</Text>
			<DatePicker
				label={t`Application date`}
				value={date}
				onChange={setDate}
				placeholder={t`Choose a day`}
				locale={i18n.locale}
				variant="secondary"
				maximumDate={todayKey()}
			/>
			<ListSection>
				<DocumentChoice type="resume" label={t`Resume sent`} value={resumeId} onChange={setResumeId} />
				<DocumentChoice type="letter" label={t`Letter sent`} value={letterId} onChange={setLetterId} />
				{application.resumeFileUrl ? (
					<ListRow
						title={t`Sent the attached resume`}
						description={application.resumeFileName ?? "PDF"}
						trailing={
							<Switch
								isSelected={resumeFileSent}
								onSelectedChange={setResumeFileSent}
								accessibilityLabel={t`Sent the attached resume`}
							/>
						}
					/>
				) : null}
				{application.coverLetterUrl ? (
					<ListRow
						title={t`Sent the attached letter`}
						description={application.coverLetterName ?? "PDF"}
						trailing={
							<Switch
								isSelected={letterFileSent}
								onSelectedChange={setLetterFileSent}
								accessibilityLabel={t`Sent the attached letter`}
							/>
						}
					/>
				) : null}
			</ListSection>
			<Button variant="primary" isDisabled={!date || update.isPending} onPress={confirm} testID="mark-applied-confirm">
				<Button.Label>{t`Confirm applied`}</Button.Label>
			</Button>
		</View>
	);
}
