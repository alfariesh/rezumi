import { Button, Description, Input, Label, Modal, TextField } from "@heroui/react";
import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { ORPCError } from "@orpc/client";
import { useId, useRef, useState } from "react";

type ResumePasswordDialogProps = {
	onSubmit: (password: string) => Promise<void>;
	onClose: () => void;
};

export function ResumePasswordDialog({ onSubmit, onClose }: ResumePasswordDialogProps) {
	const id = useId();
	const submitting = useRef(false);
	const [password, setPassword] = useState("");
	const [confirmation, setConfirmation] = useState("");
	const [error, setError] = useState("");
	const [isPending, setIsPending] = useState(false);

	const submit = async () => {
		if (submitting.current) return;
		if (password.length < 6 || password.length > 64) {
			setError(t`Use between 6 and 64 characters.`);
			return;
		}
		// Both values are entered in this browser form; no server-held secret is compared.
		// nosemgrep
		if (password !== confirmation) {
			setError(t`Enter the same password in both fields.`);
			return;
		}

		submitting.current = true;
		setIsPending(true);
		setError("");
		try {
			await onSubmit(password);
			onClose();
		} catch (error) {
			setError(error instanceof ORPCError ? error.message : t`Couldn't set the password. Try again.`);
		}
		submitting.current = false;
		setIsPending(false);
	};

	return (
		<Modal.Backdrop
			isOpen
			onOpenChange={(open) => {
				if (!open && !submitting.current) onClose();
			}}
		>
			<Modal.Container size="sm">
				<Modal.Dialog aria-describedby={`${id}-description`}>
					{!isPending && <Modal.CloseTrigger aria-label={t`Close`} />}
					<Modal.Header>
						<Modal.Heading>
							<Trans>Protect your resume with a password</Trans>
						</Modal.Heading>
						<p id={`${id}-description`} className="text-sm text-muted">
							<Trans>Anyone who opens the public URL will need this password.</Trans>
						</p>
					</Modal.Header>
					<form
						noValidate
						onSubmit={(event) => {
							event.preventDefault();
							event.stopPropagation();
							void submit();
						}}
					>
						<Modal.Body className="grid gap-4">
							<TextField
								variant="secondary"
								type="password"
								autoComplete="new-password"
								isRequired
								minLength={6}
								maxLength={64}
								value={password}
								isDisabled={isPending}
								onChange={setPassword}
								isInvalid={!!error}
								validationBehavior="aria"
								className="gap-1.5"
							>
								<Label>
									<Trans>Password</Trans>
								</Label>
								<Input fullWidth aria-describedby={error ? `${id}-error` : undefined} />
								<Description>
									<Trans>Use between 6 and 64 characters.</Trans>
								</Description>
							</TextField>
							<TextField
								variant="secondary"
								type="password"
								autoComplete="new-password"
								isRequired
								minLength={6}
								maxLength={64}
								value={confirmation}
								isDisabled={isPending}
								onChange={setConfirmation}
								isInvalid={!!error}
								validationBehavior="aria"
								className="gap-1.5"
							>
								<Label>
									<Trans>Confirm password</Trans>
								</Label>
								<Input fullWidth aria-describedby={error ? `${id}-error` : undefined} />
							</TextField>
							{error && (
								// A plain alert: HeroUI's ErrorMessage renders only inside a field that offers its slot.
								<p id={`${id}-error`} role="alert" className="text-sm text-danger">
									{error}
								</p>
							)}
						</Modal.Body>
						<Modal.Footer>
							<Button type="button" variant="secondary" isDisabled={isPending} onPress={onClose}>
								<Trans>Cancel</Trans>
							</Button>
							<Button type="submit" isDisabled={isPending}>
								<Trans>Set password</Trans>
							</Button>
						</Modal.Footer>
					</form>
				</Modal.Dialog>
			</Modal.Container>
		</Modal.Backdrop>
	);
}
