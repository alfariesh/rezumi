import { useLingui } from "@lingui/react/macro";
import { useState } from "react";
import { MAX_POSTING_CHARS } from "@rezumi/resume/check";
import { useApplicationMutations } from "@/features/applications/queries";
import { Button, Input, Label, Sheet, Text, TextField, showToast } from "@/ui";

type SavePostingSheetProps = {
	/** The resume the application is saved for and linked to. */
	resumeId: string;
	isOpen: boolean;
	onOpenChange: (open: boolean) => void;
	posting: string;
	/** Links the new application; true once linked. */
	onSaved: (applicationId: string) => Promise<boolean>;
};

/**
 * Saves the pasted posting as a new application (company and role are required); the caller links it. When the
 * link fails the sheet stays open with the saved application, so trying again only links it and never saves a
 * second one.
 */
export function SavePostingSheet({ resumeId, isOpen, onOpenChange, posting, onSaved }: SavePostingSheetProps) {
	const { t } = useLingui();
	const [company, setCompany] = useState("");
	const [role, setRole] = useState("");
	const [saved, setSaved] = useState<string | null>(null);
	const [linking, setLinking] = useState(false);
	const { create } = useApplicationMutations();
	const busy = create.isPending || linking;
	const ready = (!!saved || (!!company.trim() && !!role.trim())) && !busy;

	const save = async () => {
		let applicationId = saved;
		if (!applicationId) {
			try {
				applicationId = await create.mutateAsync({
					company: company.trim(),
					role: role.trim(),
					jobDescription: posting.trim().slice(0, MAX_POSTING_CHARS),
					resumeId,
				});
			} catch {
				showToast({ title: t`Couldn't save the application. Try again.`, variant: "danger" });
				return;
			}
			setSaved(applicationId);
		}
		setLinking(true);
		let linked = false;
		try {
			linked = await onSaved(applicationId);
		} finally {
			setLinking(false);
		}
		if (!linked) return;
		setSaved(null);
		setCompany("");
		setRole("");
		onOpenChange(false);
	};

	return (
		<Sheet
			isOpen={isOpen}
			onOpenChange={onOpenChange}
			title={t`Save as application…`}
			closeLabel={t`Close`}
			footer={
				<Button isDisabled={!ready} onPress={() => void save()} testID="save-posting">
					<Button.Label>{saved ? t`Link the application` : t`Save and link`}</Button.Label>
				</Button>
			}
		>
			{saved ? (
				<Text tone="muted" accessibilityLiveRegion="polite">
					{t`The application is saved. Linking it to this resume didn't work yet.`}
				</Text>
			) : null}
			<TextField isRequired isDisabled={!!saved}>
				<Label>{t`Company`}</Label>
				<Input variant="secondary" accessibilityLabel={t`Company`} value={company} onChangeText={setCompany} />
			</TextField>
			<TextField isRequired isDisabled={!!saved}>
				<Label>{t`Role`}</Label>
				<Input variant="secondary" accessibilityLabel={t`Role`} value={role} onChangeText={setRole} />
			</TextField>
		</Sheet>
	);
}
