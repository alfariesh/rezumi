import type { ReactNode } from "react";
import { Button, Label, Modal, Spinner, TextArea, TextField } from "@heroui/react";
import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { useId, useState } from "react";
import { getReadableErrorMessage } from "@/libs/error-message";

type ReasonDialogProps = {
	isOpen: boolean;
	onOpenChange: (open: boolean) => void;
	title: ReactNode;
	description?: ReactNode;
	/** Fields of the action itself, above the reason; the caller holds their values. */
	children?: ReactNode;
	submitLabel: ReactNode;
	/** A refund or a revocation: the button reads as destructive. */
	danger?: boolean;
	/** False while the caller's fields aren't filled in. */
	canSubmit?: boolean;
	/** Runs the action with the reason; a thrown error is shown in the dialog, which stays open. */
	onSubmit: (reason: string) => Promise<unknown>;
};

/** Every admin action that changes billing asks why; the reason goes to the audit log (and to Dodo Payments for refunds). */
export function ReasonDialog({
	isOpen,
	onOpenChange,
	title,
	description,
	children,
	submitLabel,
	danger = false,
	canSubmit = true,
	onSubmit,
}: ReasonDialogProps) {
	const descriptionId = useId();
	const [reason, setReason] = useState("");
	const [pending, setPending] = useState(false);
	const [failure, setFailure] = useState<string | null>(null);
	const ready = canSubmit && reason.trim().length >= 3 && !pending;

	const close = (open: boolean) => {
		onOpenChange(open);
		if (!open) {
			setReason("");
			setFailure(null);
		}
	};

	const submit = async () => {
		setPending(true);
		setFailure(null);
		try {
			await onSubmit(reason.trim());
			close(false);
		} catch (error) {
			setFailure(getReadableErrorMessage(error, t`That didn't work. Try again.`));
		} finally {
			setPending(false);
		}
	};

	return (
		<Modal.Backdrop isOpen={isOpen} onOpenChange={close}>
			<Modal.Container size="md">
				<Modal.Dialog {...(description && { "aria-describedby": descriptionId })}>
					<Modal.CloseTrigger aria-label={t`Close`} />
					<Modal.Header>
						<Modal.Heading>{title}</Modal.Heading>
						{description && (
							<p id={descriptionId} className="text-sm text-muted">
								{description}
							</p>
						)}
					</Modal.Header>
					<Modal.Body>
						<form
							className="grid gap-4"
							onSubmit={(event) => {
								event.preventDefault();
								if (ready) void submit();
							}}
						>
							{children}
							<TextField fullWidth value={reason} onChange={setReason} className="gap-1.5">
								<Label>
									<Trans>Reason</Trans>
								</Label>
								<TextArea variant="secondary" maxLength={255} className="min-h-20" />
							</TextField>
							<p className="text-xs text-muted">
								<Trans>Kept in the audit log with your name. At least 3 characters.</Trans>
							</p>
							{failure && (
								<p role="alert" className="text-sm text-danger">
									{failure}
								</p>
							)}
							<Modal.Footer className="p-0">
								<Button variant="secondary" onPress={() => close(false)}>
									<Trans>Cancel</Trans>
								</Button>
								<Button type="submit" variant={danger ? "danger" : "primary"} isDisabled={!ready} isPending={pending}>
									{pending && <Spinner size="sm" color="current" aria-hidden />}
									{submitLabel}
								</Button>
							</Modal.Footer>
						</form>
					</Modal.Body>
				</Modal.Dialog>
			</Modal.Container>
		</Modal.Backdrop>
	);
}
