import { AlertDialog, Button, Input, Label, Spinner, TextField } from "@heroui/react";
import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "@rezumi/ui/components/toast";
import { downloadWithAnchor } from "@rezumi/utils/file";
import { SettingsRow, SettingsSection } from "../section";
import { buildAccountZip } from "./export";
import { clearAccountData } from "@/libs/auth/clear-account-data";
import { authClient } from "@/libs/auth/client";
import { getReadableErrorMessage } from "@/libs/error-message";
import { client } from "@/libs/orpc/client";

const CONFIRMATION = "delete";

type DataSectionProps = { openDeletion?: boolean };

export function DataSection({ openDeletion = false }: DataSectionProps) {
	const [deleting, setDeleting] = useState(openDeletion);

	const exportAll = useMutation({
		mutationFn: async () => {
			const zip = buildAccountZip(await client.auth.exportData());
			const date = new Date().toISOString().slice(0, 10);
			downloadWithAnchor(new Blob([zip as BlobPart], { type: "application/zip" }), `rezumi-${date}.zip`);
		},
		onError: (error) =>
			toast.add({
				type: "error",
				description: getReadableErrorMessage(error, t`Couldn't export your data. Try again.`),
			}),
	});

	return (
		<SettingsSection divided title={<Trans>Your data</Trans>}>
			<SettingsRow
				icon="download-simple"
				title={<Trans>Export everything</Trans>}
				description={<Trans>All documents and applications as JSON, in one zip</Trans>}
			>
				<Button size="sm" variant="secondary" isPending={exportAll.isPending} onPress={() => exportAll.mutate()}>
					{exportAll.isPending && <Spinner size="sm" color="current" aria-hidden />}
					<Trans>Export</Trans>
				</Button>
			</SettingsRow>
			<SettingsRow
				icon="trash"
				title={<Trans>Delete account</Trans>}
				description={<Trans>Permanently removes everything. Export first if you want a copy.</Trans>}
			>
				<Button size="sm" variant="danger-soft" onPress={() => setDeleting(true)}>
					<Trans>Delete…</Trans>
				</Button>
			</SettingsRow>
			<DeleteAccountDialog open={deleting} onOpenChange={setDeleting} />
		</SettingsSection>
	);
}

type DeleteAccountDialogProps = { open: boolean; onOpenChange: (open: boolean) => void };

/** The one confirmation in Settings that asks you to type: it names what goes, and can't be undone. */
function DeleteAccountDialog({ open, onOpenChange }: DeleteAccountDialogProps) {
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const [typed, setTyped] = useState("");

	const remove = useMutation({
		mutationFn: () => client.auth.deleteAccount(),
		onSuccess: async () => {
			await authClient.signOut();
			clearAccountData(queryClient);
			toast.add({ description: t`Your account was deleted.` });
			void navigate({ to: "/" });
		},
		onError: (error) =>
			toast.add({
				type: "error",
				description: getReadableErrorMessage(error, t`Couldn't delete your account. Try again.`),
			}),
	});

	return (
		<AlertDialog.Backdrop
			isOpen={open}
			// The typed confirmation clears with the dialog.
			onOpenChange={(next) => {
				if (!next) setTyped("");
				onOpenChange(next);
			}}
			isKeyboardDismissDisabled={false}
		>
			<AlertDialog.Container size="sm">
				<AlertDialog.Dialog>
					<AlertDialog.Header>
						<AlertDialog.Icon status="danger" />
						<AlertDialog.Heading>
							<Trans>Delete your account?</Trans>
						</AlertDialog.Heading>
					</AlertDialog.Header>
					<AlertDialog.Body>
						<p>
							<Trans>
								All your documents, applications, API keys and public links are deleted for good. This can't be undone.
							</Trans>
						</p>
						<TextField fullWidth value={typed} onChange={setTyped} autoComplete="off" className="mt-4 gap-1.5">
							<Label>
								<Trans>
									Type <b className="font-mono font-medium">{CONFIRMATION}</b> to confirm
								</Trans>
							</Label>
							<Input variant="secondary" />
						</TextField>
					</AlertDialog.Body>
					<AlertDialog.Footer>
						<Button slot="close" variant="tertiary">
							<Trans>Keep account</Trans>
						</Button>
						<Button
							variant="danger"
							isDisabled={typed.trim().toLowerCase() !== CONFIRMATION}
							isPending={remove.isPending}
							onPress={() => remove.mutate()}
						>
							{remove.isPending && <Spinner size="sm" color="current" aria-hidden />}
							<Trans>Delete account</Trans>
						</Button>
					</AlertDialog.Footer>
				</AlertDialog.Dialog>
			</AlertDialog.Container>
		</AlertDialog.Backdrop>
	);
}
