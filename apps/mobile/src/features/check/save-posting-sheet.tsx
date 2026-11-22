import { useLingui } from "@lingui/react/macro";
import { useState } from "react";
import { MAX_POSTING_CHARS } from "@rezumi/resume/check";
import { useApplicationMutations } from "@/features/applications/queries";
import { Button, Input, Label, Sheet, TextField, showToast } from "@/ui";

type SavePostingSheetProps = {
	isOpen: boolean;
	onOpenChange: (open: boolean) => void;
	posting: string;
	onSaved: (applicationId: string) => Promise<void>;
};

/** Saves the pasted posting as a new application (company and role are required); the caller links it. */
export function SavePostingSheet({ isOpen, onOpenChange, posting, onSaved }: SavePostingSheetProps) {
	const { t } = useLingui();
	const [company, setCompany] = useState("");
	const [role, setRole] = useState("");
	const { create } = useApplicationMutations();
	const ready = !!company.trim() && !!role.trim() && !create.isPending;

	const save = async () => {
		try {
			const id = await create.mutateAsync({
				company: company.trim(),
				role: role.trim(),
				jobDescription: posting.trim().slice(0, MAX_POSTING_CHARS),
			});
			onOpenChange(false);
			await onSaved(id);
		} catch {
			showToast({ title: t`Couldn't save the application. Try again.`, variant: "danger" });
		}
	};

	return (
		<Sheet
			isOpen={isOpen}
			onOpenChange={onOpenChange}
			title={t`Save as application…`}
			closeLabel={t`Close`}
			footer={
				<Button isDisabled={!ready} onPress={() => void save()}>
					<Button.Label>{t`Save and link`}</Button.Label>
				</Button>
			}
		>
			<TextField isRequired>
				<Label>{t`Company`}</Label>
				<Input variant="secondary" accessibilityLabel={t`Company`} value={company} onChangeText={setCompany} />
			</TextField>
			<TextField isRequired>
				<Label>{t`Role`}</Label>
				<Input variant="secondary" accessibilityLabel={t`Role`} value={role} onChangeText={setRole} />
			</TextField>
		</Sheet>
	);
}
