import { Button, Description, InputGroup, Label, Modal, TextField } from "@heroui/react";
import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { useId, useRef, useState } from "react";
import { Icon } from "@rezumi/ui/components/icon";
import { IconButton } from "@rezumi/ui/components/icon-button";
import { CellSwitchRow } from "@rezumi/ui/components/switch";
import { toast } from "@rezumi/ui/components/toast";
import { portfolioErrorMessage } from "../errors";
import { PanelGroup } from "./fields";
import { useSettingAction } from "./setting-action";
import { usePortfolioRecord } from "./store";
import { useConfirm } from "@/hooks/use-confirm";
import { client } from "@/libs/orpc/client";

const MIN_LENGTH = 6;
const MAX_LENGTH = 64;

/**
 * Publish → Password (Phase 13 3.4): visitors need it to see the portfolio and its works. Turning it on asks for the
 * password; while it's on it can be changed, and turning it off removes it after asking. Settings live beside the
 * data, so none of this is an Undo step or moves the data's version.
 */
export function PasswordGroup() {
	const record = usePortfolioRecord();
	const confirm = useConfirm();
	const { run, pending } = useSettingAction();
	const [dialog, setDialog] = useState<"set" | "change" | null>(null);

	const remove = async () => {
		const confirmed = await confirm(t`Remove the password?`, {
			description: t`Anyone with the link can see your portfolio again, and search engines may list it if that's on.`,
			confirmText: t`Remove password`,
		});
		if (!confirmed) return;
		const done = await run(() => client.portfolio.removePassword({}), t`Couldn't remove the password. Try again.`);
		if (done) toast.add({ description: t`Password removed` });
	};

	return (
		<PanelGroup icon="lock" title={<Trans>Password</Trans>}>
			<CellSwitchRow
				label={t`Protect with a password`}
				isSelected={record.hasPassword}
				isDisabled={pending}
				onChange={(checked) => (checked ? setDialog("set") : void remove())}
			/>
			<p className="px-1 text-body-xs text-muted">
				<Trans>
					Visitors need this password to see your portfolio and its works. While it's on, search engines don't list it
					and link previews show a general picture.
				</Trans>
			</p>
			{record.hasPassword && (
				<Button variant="secondary" className="w-fit" isDisabled={pending} onPress={() => setDialog("change")}>
					<Icon name="key" size={18} />
					<Trans>Change password</Trans>
				</Button>
			)}
			{dialog && (
				<PasswordDialog
					changing={dialog === "change"}
					onClose={() => setDialog(null)}
					onSubmit={async (password) => {
						const done = await run(
							() => client.portfolio.setPassword({ password }),
							t`Couldn't set the password. Try again.`,
						);
						if (done) toast.add({ description: dialog === "change" ? t`Password changed` : t`Password set` });
						return done;
					}}
				/>
			)}
		</PanelGroup>
	);
}

type PasswordDialogProps = {
	changing: boolean;
	/** Saves it; false when that failed (the reason was shown), so the dialog stays. */
	onSubmit: (password: string) => Promise<boolean>;
	onClose: () => void;
};

function PasswordDialog({ changing, onSubmit, onClose }: PasswordDialogProps) {
	const id = useId();
	const submitting = useRef(false);
	const [password, setPassword] = useState("");
	const [visible, setVisible] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [pending, setPending] = useState(false);

	const submit = async () => {
		if (submitting.current) return;
		if (password.length < MIN_LENGTH || password.length > MAX_LENGTH) {
			setError(t`Use between 6 and 64 characters.`);
			return;
		}
		submitting.current = true;
		setPending(true);
		setError(null);
		try {
			if (await onSubmit(password)) onClose();
		} catch (failure) {
			setError(portfolioErrorMessage(failure, { fallback: t`Couldn't set the password. Try again.` }));
		} finally {
			submitting.current = false;
			setPending(false);
		}
	};

	return (
		<Modal.Backdrop isOpen isDismissable={!pending} onOpenChange={(open) => !open && !submitting.current && onClose()}>
			<Modal.Container size="sm">
				<Modal.Dialog aria-labelledby={`${id}-title`} aria-describedby={`${id}-description`}>
					{!pending && <Modal.CloseTrigger aria-label={t`Close`} />}
					<Modal.Header>
						<Modal.Heading id={`${id}-title`}>
							{changing ? <Trans>Change password</Trans> : <Trans>Protect with a password</Trans>}
						</Modal.Heading>
						<p id={`${id}-description`} className="text-body-sm text-muted">
							{changing ? (
								<Trans>Everyone who opened it with the old password has to enter the new one.</Trans>
							) : (
								<Trans>Give it only to the people who should see your portfolio.</Trans>
							)}
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
						<Modal.Body className="grid gap-2">
							<TextField
								variant="secondary"
								type={visible ? "text" : "password"}
								autoComplete="new-password"
								isRequired
								minLength={MIN_LENGTH}
								maxLength={MAX_LENGTH}
								value={password}
								isDisabled={pending}
								onChange={(value) => {
									setPassword(value);
									setError(null);
								}}
								isInvalid={error !== null}
								validationBehavior="aria"
								className="gap-1.5"
							>
								<Label>
									<Trans>Password</Trans>
								</Label>
								<InputGroup variant="secondary" fullWidth>
									<InputGroup.Input
										autoFocus
										spellCheck={false}
										autoCapitalize="none"
										aria-describedby={error ? `${id}-error` : undefined}
									/>
									<InputGroup.Suffix className="pe-1">
										<IconButton
											icon={visible ? "eye-slash" : "eye"}
											size="sm"
											variant="ghost"
											label={visible ? t`Hide password` : t`Show password`}
											aria-pressed={visible}
											onPress={() => setVisible((shown) => !shown)}
										/>
									</InputGroup.Suffix>
								</InputGroup>
								<Description>
									<Trans>At least 6 characters.</Trans>
								</Description>
							</TextField>
							{error && (
								<p id={`${id}-error`} role="alert" className="text-body-sm text-danger">
									{error}
								</p>
							)}
						</Modal.Body>
						<Modal.Footer>
							<Button type="button" variant="secondary" isDisabled={pending} onPress={onClose}>
								<Trans>Cancel</Trans>
							</Button>
							<Button type="submit" isPending={pending}>
								{changing ? <Trans>Change password</Trans> : <Trans>Set password</Trans>}
							</Button>
						</Modal.Footer>
					</form>
				</Modal.Dialog>
			</Modal.Container>
		</Modal.Backdrop>
	);
}
