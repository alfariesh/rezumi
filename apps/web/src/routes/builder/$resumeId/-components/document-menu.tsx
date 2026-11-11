import { Dropdown, Label, Modal, Separator } from "@heroui/react";
import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useId, useState } from "react";
import { Icon } from "@rezumi/ui/components/icon";
import { toast } from "@rezumi/ui/components/toast";
import { NotesSectionBuilder } from "../-sidebar/right/sections/notes";
import { DocumentDetails } from "./document-details";
import { useDialogStore } from "@/dialogs/store";
import {
	useCurrentBuilderResumeSelector,
	useCurrentResume,
	usePatchResume,
	useResumeStore,
} from "@/features/resume/builder/draft";
import { DocumentMenuTrigger, DocumentTitle } from "@/features/resume/editor/chrome";
import { SaveStatus } from "@/features/resume/editor/save-status";
import { useEditorStore } from "@/features/resume/editor/store";
import { useResumeExport } from "@/features/resume/export/use-resume-export";
import { getResumeErrorMessage } from "@/libs/error-message";
import { orpc } from "@/libs/orpc/client";

type DocumentDialog = "notes" | "details" | null;

/**
 * The document's name in the editor bar, renamed in place, then the ▾ that opens the document menu (rename and tags,
 * duplicate, lock, notes, details, print and delete) and the save state.
 */
export function DocumentMenu() {
	const name = useCurrentBuilderResumeSelector((resume) => resume.name);
	const isLocked = useCurrentBuilderResumeSelector((resume) => resume.isLocked);
	const [dialog, setDialog] = useState<DocumentDialog>(null);
	const detailsDescriptionId = useId();
	const rename = useRenameResume();

	return (
		<>
			<DocumentTitle name={name} isLocked={isLocked} onRename={rename} />
			<Dropdown>
				<DocumentMenuTrigger name={name} />
				<DocumentMenuItems onOpenDialog={setDialog} />
			</Dropdown>
			<SaveStatus />

			<Modal.Backdrop isOpen={dialog === "notes"} onOpenChange={(open) => !open && setDialog(null)}>
				<Modal.Container size="lg">
					<Modal.Dialog>
						<Modal.CloseTrigger aria-label={t`Close`} />
						<Modal.Header>
							<Modal.Heading>
								<Trans>Notes</Trans>
							</Modal.Heading>
						</Modal.Header>
						<Modal.Body>
							<NotesSectionBuilder />
						</Modal.Body>
					</Modal.Dialog>
				</Modal.Container>
			</Modal.Backdrop>

			<Modal.Backdrop isOpen={dialog === "details"} onOpenChange={(open) => !open && setDialog(null)}>
				<Modal.Container size="md">
					<Modal.Dialog aria-describedby={detailsDescriptionId}>
						<Modal.CloseTrigger aria-label={t`Close`} />
						<DocumentDetails descriptionId={detailsDescriptionId} />
					</Modal.Dialog>
				</Modal.Container>
			</Modal.Backdrop>
		</>
	);
}

/** Renames the resume at once on screen; a refusal puts the old name back and says why. */
function useRenameResume() {
	const id = useCurrentBuilderResumeSelector((resume) => resume.id);
	const patchResume = usePatchResume();
	const { mutate } = useMutation(orpc.resume.update.mutationOptions());

	return (next: string) => {
		const previous = useResumeStore.getState().resume?.name;
		patchResume((draft) => {
			draft.name = next;
		});
		mutate(
			{ id, name: next },
			{
				onError: (error) => {
					if (previous !== undefined)
						patchResume((draft) => {
							draft.name = previous;
						});
					toast.add({ type: "error", description: getResumeErrorMessage(error) });
				},
			},
		);
	};
}

type DocumentMenuItemsProps = {
	onOpenDialog: (dialog: DocumentDialog) => void;
};

function DocumentMenuItems({ onOpenDialog }: DocumentMenuItemsProps) {
	const navigate = useNavigate();
	const { openDialog } = useDialogStore();
	const resume = useCurrentResume();
	const patchResume = usePatchResume();
	const { onPrint } = useResumeExport(resume);
	const { id, name, slug, tags, isLocked } = resume;
	const setSheetTab = useEditorStore((state) => state.setSheetTab);
	// Downloads need a connection, as in the bar.
	const offline = useResumeStore((state) => state.saveStatus === "offline");

	const { mutate: trashResume } = useMutation(orpc.documents.trash.mutationOptions());
	const { mutate: restoreResume } = useMutation(orpc.documents.restore.mutationOptions());
	const { mutate: setLockedResume } = useMutation(orpc.resume.setLocked.mutationOptions());

	// Locking is reversible, so it doesn't ask for confirmation.
	const handleToggleLock = () => {
		setLockedResume(
			{ id, isLocked: !isLocked },
			{
				onSuccess: () => {
					patchResume((draft) => {
						draft.isLocked = !isLocked;
					});
				},
				onError: (error) => {
					toast.add({ type: "error", description: getResumeErrorMessage(error) });
				},
			},
		);
	};

	// Undoable, so it doesn't ask first: the resume waits in Trash for 30 days.
	const handleTrash = () => {
		trashResume(
			{ type: "resume", id },
			{
				onSuccess: () => {
					void navigate({ to: "/dashboard/documents" });
					toast.add({
						description: t`“${name}” moved to Trash`,
						actionProps: {
							children: t`Undo`,
							onClick: () =>
								restoreResume(
									{ type: "resume", id },
									{ onError: (error) => toast.add({ type: "error", description: getResumeErrorMessage(error) }) },
								),
						},
					});
				},
				onError: (error) => {
					toast.add({ type: "error", description: getResumeErrorMessage(error) });
				},
			},
		);
	};

	return (
		<Dropdown.Popover placement="bottom start" className="w-60">
			<Dropdown.Menu>
				<Dropdown.Item
					id="rename"
					textValue={t`Rename…`}
					isDisabled={isLocked}
					onAction={() => openDialog("resume.update", { id, name, slug, tags })}
				>
					<Icon name="pencil-simple" />
					<Label>
						<Trans>Rename…</Trans>
					</Label>
				</Dropdown.Item>
				<Dropdown.Item
					id="duplicate"
					textValue={t`Duplicate`}
					onAction={() => openDialog("resume.duplicate", { id, name, slug, tags })}
				>
					<Icon name="copy" />
					<Label>
						<Trans>Duplicate</Trans>
					</Label>
				</Dropdown.Item>
				<Dropdown.Item id="lock" textValue={isLocked ? t`Unlock editing` : t`Lock editing`} onAction={handleToggleLock}>
					<Icon name={isLocked ? "lock-open" : "lock"} />
					<Label>{isLocked ? <Trans>Unlock editing</Trans> : <Trans>Lock editing</Trans>}</Label>
				</Dropdown.Item>
				<Separator />
				<Dropdown.Item id="notes" textValue={t`Notes`} onAction={() => onOpenDialog("notes")}>
					<Icon name="note" />
					<Label>
						<Trans>Notes</Trans>
					</Label>
				</Dropdown.Item>
				<Dropdown.Item id="details" textValue={t`Details`} onAction={() => onOpenDialog("details")}>
					<Icon name="info" />
					<Label>
						<Trans>Details</Trans>
					</Label>
				</Dropdown.Item>
				<Dropdown.Item id="print" textValue={t`Print`} onAction={() => void onPrint()}>
					<Icon name="printer" />
					<Label>
						<Trans>Print</Trans>
					</Label>
				</Dropdown.Item>
				{/* Download & history, from every layout: phones have no ▾ beside Download PDF and no clock in the bar. */}
				<Dropdown.Item
					id="download"
					textValue={t`More download formats`}
					isDisabled={offline}
					onAction={() => setSheetTab("download")}
				>
					<Icon name="download-simple" />
					<Label>
						<Trans>More download formats</Trans>
					</Label>
				</Dropdown.Item>
				<Dropdown.Item id="history" textValue={t`History`} onAction={() => setSheetTab("history")}>
					<Icon name="clock-counter-clockwise" />
					<Label>
						<Trans>History</Trans>
					</Label>
				</Dropdown.Item>
				<Separator />
				<Dropdown.Item
					id="trash"
					textValue={t`Move to Trash`}
					variant="danger"
					isDisabled={isLocked}
					onAction={handleTrash}
				>
					<Icon name="trash" />
					<Label>
						<Trans>Move to Trash</Trans>
					</Label>
				</Dropdown.Item>
			</Dropdown.Menu>
		</Dropdown.Popover>
	);
}
