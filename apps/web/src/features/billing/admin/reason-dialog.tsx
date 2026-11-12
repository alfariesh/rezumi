import type { ReactNode } from "react";
import { Button, Label, Modal, Spinner, TextArea, TextField } from "@heroui/react";
import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { ORPCError } from "@orpc/client";
import { useId, useState } from "react";
import { getOrpcErrorMessage } from "@/libs/error-message";

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
	/** The words for a thrown error; by default its code's wording here, never the server's own (English) message. */
	describeError?: (error: unknown) => string;
};

/** A billing admin action's refusal in the admin's language, by its code. */
function describeAdminError(error: unknown): string {
	const worded = getOrpcErrorMessage(error, {
		fallback: t`That didn't work. Try again.`,
		byCode: {
			NOT_FOUND: t`It doesn't exist anymore. Reload the page.`,
			CONFLICT: t`Something is still in progress, or changed meanwhile. Reload the page, check its status, then try again.`,
			BAD_GATEWAY: t`The payment provider didn't answer. It's checked again automatically, so don't send it twice.`,
			BILLING_UNAVAILABLE: t`Payments aren't set up on this server.`,
			BAD_REQUEST: t`This can't be done as entered. Check the amount and the current state of the payment or account, then try again.`,
		},
	});
	// A refusal's specifics (what is left to refund, the provider's own reason, the credit balance) exist only in the
	// server's message, and the admin needs them to decide what to enter next.
	if (error instanceof ORPCError && error.code === "BAD_REQUEST" && error.message && error.message !== "Bad Request") {
		return `${worded} (${error.message})`;
	}
	return worded;
}

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
	describeError = describeAdminError,
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
			setFailure(describeError(error));
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
							<p id={descriptionId} className="text-body-sm text-muted">
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
								<TextArea variant="secondary" maxLength={255} />
							</TextField>
							<p className="text-body-xs text-muted">
								<Trans>Kept in the audit log with your name. At least 3 characters.</Trans>
							</p>
							{failure && (
								<p role="alert" className="text-body-sm text-danger">
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
