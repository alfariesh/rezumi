import type { DialogProps } from "../store";
import { Button, Input, InputOTP, Modal, REGEXP_ONLY_DIGITS } from "@heroui/react";
import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { useSelector } from "@tanstack/react-form";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { QRCodeSVG } from "qrcode.react";
import { useId, useState } from "react";
import { match } from "ts-pattern";
import z from "zod";
import { FormControl, FormItem, FormLabel, FormMessage } from "@rezumi/ui/components/form";
import { Icon } from "@rezumi/ui/components/icon";
import { toast } from "@rezumi/ui/components/toast";
import { downloadWithAnchor } from "@rezumi/utils/file";
import { useDialogStore } from "../store";
import { PasswordInput } from "@/components/input/password-input";
import { useFormBlocker } from "@/hooks/use-form-blocker";
import { authClient } from "@/libs/auth/client";
import { getReadableErrorMessage } from "@/libs/error-message";
import { sessionQueryKey } from "@/libs/root-context";
import { useAppForm } from "@/libs/tanstack-form";

const enableFormSchema = z.object({
	password: z
		.string()
		.min(6, { error: () => t`Enter your password.` })
		.max(64, { error: () => t`Use 64 characters or fewer.` }),
});

const verifyFormSchema = z.object({
	code: z.string().length(6, { error: () => t`Enter the 6-digit code.` }),
});

type TwoFactorSetupStep = "backup" | "enable" | "verify";

type TwoFactorStepProps = {
	step: TwoFactorSetupStep;
};

type TwoFactorQRCodeProps = {
	totpUri: string;
};

export function EnableTwoFactorDialog(_: DialogProps<"auth.two-factor.enable">) {
	const router = useRouter();
	const queryClient = useQueryClient();

	const [totpUri, setTotpUri] = useState<string | null>(null);
	const [backupCodes, setBackupCodes] = useState<string[] | null>(null);
	const [step, setStep] = useState<TwoFactorSetupStep>("enable");

	const descriptionId = useId();
	const closeDialog = useDialogStore((state) => state.closeDialog);

	const enableForm = useAppForm({
		defaultValues: { password: "" },
		validators: { onSubmit: enableFormSchema },
		onSubmit: async ({ value }) => {
			const toastId = toast.add({ type: "loading", description: t`Turning on two-step verification…` });

			const { data, error } = await authClient.twoFactor.enable({
				password: value.password,
				issuer: "Rezumi",
			});

			if (error) {
				toast.add({
					type: "error",
					description: getReadableErrorMessage(
						error,
						t({
							comment: "Fallback toast when enabling two-factor authentication fails",
							message: "Couldn't turn on two-step verification. Check your password and try again.",
						}),
					),
					id: toastId,
				});
				return;
			}

			if (data.method === "totp") {
				setTotpUri(data.totpURI);
				setBackupCodes(data.backupCodes);
				setStep("backup");
				toast.close(toastId);
			} else {
				toast.add({ type: "error", description: t`Couldn't set up two-step verification. Try again.`, id: toastId });
			}
		},
	});

	const verifyForm = useAppForm({
		defaultValues: { code: "" },
		validators: { onSubmit: verifyFormSchema },
		onSubmit: async ({ value }) => {
			const toastId = toast.add({ type: "loading", description: t`Verifying code…` });

			const { error } = await authClient.twoFactor.verifyTotp({ code: value.code });

			if (error) {
				toast.add({
					type: "error",
					description: getReadableErrorMessage(
						error,
						t({
							comment: "Fallback toast when verifying two-factor setup code fails",
							message: "Couldn't verify the code. Enter the current code from your authenticator app.",
						}),
					),
					id: toastId,
				});
				return;
			}

			toast.close(toastId);
			toast.add({ type: "success", description: t`Two-step verification turned on` });
			void queryClient.invalidateQueries({ queryKey: sessionQueryKey }).then(() => router.invalidate());
			closeDialog();
			onReset();
		},
	});

	const enableIsDirty = useSelector(enableForm.store, (s) => s.isDirty);
	const enableIsSubmitting = useSelector(enableForm.store, (s) => s.isSubmitting);
	const verifyIsDirty = useSelector(verifyForm.store, (s) => s.isDirty);
	const verifyIsSubmitting = useSelector(verifyForm.store, (s) => s.isSubmitting);

	const { requestClose } = useFormBlocker(enableForm, {
		shouldBlock: () => {
			if (step === "enable") return enableIsDirty && !enableIsSubmitting;
			if (step === "verify") return verifyIsDirty && !verifyIsSubmitting;
			return false;
		},
	});

	const onConfirmBackup = () => {
		setStep("verify");
	};

	const onReset = () => {
		enableForm.reset();
		verifyForm.reset();
		setStep("enable");
		setTotpUri(null);
		setBackupCodes(null);
	};

	const handleCopySecret = async () => {
		if (!totpUri) return;
		const secret = extractSecretFromTotpUri(totpUri);
		if (!secret) return;
		await navigator.clipboard.writeText(secret);
		toast.add({ type: "success", description: t`Secret copied` });
	};

	const handleCopyBackupCodes = async () => {
		if (!backupCodes) return;
		await navigator.clipboard.writeText(backupCodes.join("\n"));
		toast.add({ type: "success", description: t`Backup codes copied` });
	};

	const handleDownloadBackupCodes = () => {
		if (!backupCodes) return;
		downloadWithAnchor(new Blob([backupCodes.join("\n")], { type: "text/plain" }), "rezumi_backup-codes.txt");
	};

	return (
		<Modal.Container size="sm">
			<Modal.Dialog aria-describedby={descriptionId}>
				<Modal.CloseTrigger aria-label={t`Close`} />
				<Modal.Header>
					<Modal.Heading>
						<TwoFactorDialogTitle step={step} />
					</Modal.Heading>
					<p id={descriptionId} className="text-sm text-muted">
						<TwoFactorDialogDescription step={step} />
					</p>
				</Modal.Header>

				<Modal.Body>
					{match(step)
						.with("enable", () => (
							<form
								className="space-y-4"
								onSubmit={(event) => {
									event.preventDefault();
									event.stopPropagation();
									void enableForm.handleSubmit();
								}}
							>
								<enableForm.Field name="password">
									{(field) => (
										<FormItem hasError={field.state.meta.isTouched && field.state.meta.errors.length > 0}>
											<FormLabel>
												<Trans>Password</Trans>
											</FormLabel>
											<FormControl
												render={
													<PasswordInput
														minLength={6}
														maxLength={64}
														autoComplete="current-password"
														name={field.name}
														value={field.state.value}
														onBlur={field.handleBlur}
														onChange={(event) => field.handleChange(event.target.value)}
													/>
												}
											/>
											<FormMessage errors={field.state.meta.errors} />
										</FormItem>
									)}
								</enableForm.Field>

								<Modal.Footer className="p-0">
									<Button type="submit" isDisabled={enableIsSubmitting}>
										<Trans>Continue</Trans>
									</Button>
								</Modal.Footer>
							</form>
						))
						.with("verify", () => {
							const secret = totpUri ? extractSecretFromTotpUri(totpUri) : null;
							return (
								<div className="space-y-4">
									{totpUri && secret && (
										<>
											<div className="flex items-center gap-x-2">
												<Input fullWidth readOnly value={secret} className="font-mono text-sm" />
												<Button isIconOnly variant="ghost" onPress={() => handleCopySecret()}>
													<span className="sr-only">
														{t({
															comment: "Accessible label for the button that copies the two-factor secret key",
															message: "Copy secret",
														})}
													</span>
													<Icon name="copy" size={16} />
												</Button>
											</div>

											<TwoFactorQRCode totpUri={totpUri} />
										</>
									)}

									<p>
										<Trans>Then enter the 6-digit code from the app.</Trans>
									</p>

									<form
										className="space-y-4"
										onSubmit={(event) => {
											event.preventDefault();
											event.stopPropagation();
											void verifyForm.handleSubmit();
										}}
									>
										<verifyForm.Field name="code">
											{(field) => (
												<FormItem hasError={field.state.meta.isTouched && field.state.meta.errors.length > 0}>
													<FormLabel className="sr-only">
														<Trans>Verification code</Trans>
													</FormLabel>
													<FormControl
														render={(props) => (
															<InputOTP
																{...props}
																isInvalid={Boolean(props["aria-invalid"])}
																maxLength={6}
																pattern={REGEXP_ONLY_DIGITS}
																name={field.name}
																value={field.state.value}
																onBlur={field.handleBlur}
																onChange={field.handleChange}
																onComplete={() => void verifyForm.handleSubmit()}
															>
																<InputOTP.Group>
																	{Array.from({ length: 6 }, (_, index) => (
																		<InputOTP.Slot key={index} index={index} />
																	))}
																</InputOTP.Group>
															</InputOTP>
														)}
													/>
													<FormMessage errors={field.state.meta.errors} />
												</FormItem>
											)}
										</verifyForm.Field>

										<Modal.Footer className="gap-x-2 p-0">
											<Button variant="secondary" onPress={() => requestClose()}>
												<Trans comment="Secondary action button to close two-factor setup dialog">Cancel</Trans>
											</Button>
											<Button type="submit" isDisabled={verifyIsSubmitting}>
												<Trans comment="Primary action button to proceed to next step in two-factor setup">
													Continue
												</Trans>
											</Button>
										</Modal.Footer>
									</form>
								</div>
							);
						})
						.with("backup", () => (
							<div className="space-y-4">
								{backupCodes && (
									<div className="space-y-4">
										<div className="grid grid-cols-2 gap-2">
											{backupCodes.map((code) => (
												<div key={code} className="rounded-md border border-line p-2 text-center font-mono text-sm">
													{code}
												</div>
											))}
										</div>

										<div className="flex items-center gap-x-2">
											<Button variant="secondary" onPress={() => handleDownloadBackupCodes()} className="flex-1">
												<Icon name="arrow-down" size={16} className="me-2" />
												<Trans comment="Action button to download two-factor backup codes as a text file">
													Download codes
												</Trans>
											</Button>
											<Button variant="ghost" onPress={() => handleCopyBackupCodes()} className="flex-1">
												<Icon name="copy" size={16} className="me-2" />
												<Trans comment="Action button to copy two-factor backup codes to clipboard">Copy codes</Trans>
											</Button>
										</div>
									</div>
								)}

								<Modal.Footer className="p-0">
									<Button onPress={() => onConfirmBackup()}>
										<Trans comment="Final action button after saving backup codes">Continue</Trans>
									</Button>
								</Modal.Footer>
							</div>
						))
						.exhaustive()}
				</Modal.Body>
			</Modal.Dialog>
		</Modal.Container>
	);
}

function extractSecretFromTotpUri(totpUri: string): string | null {
	try {
		const url = new URL(totpUri);
		return url.searchParams.get("secret");
	} catch {
		return null;
	}
}

function TwoFactorDialogTitle({ step }: TwoFactorStepProps) {
	return match(step)
		.with("enable", () => <Trans>Turn on two-step verification</Trans>)
		.with("verify", () => <Trans>Set up your authenticator app</Trans>)
		.with("backup", () => <Trans>Save your backup codes</Trans>)
		.exhaustive();
}

function TwoFactorDialogDescription({ step }: TwoFactorStepProps) {
	return match(step)
		.with("enable", () => (
			<Trans>
				Enter your password to set up two-step verification. Once it's on, you need a code from your authenticator app
				every time you sign in.
			</Trans>
		))
		.with("verify", () => (
			<Trans>Scan the QR code with your authenticator app, or copy the secret and paste it into the app.</Trans>
		))
		.with("backup", () => (
			<Trans>Store these backup codes somewhere safe. Each one signs you in once if you lose your device.</Trans>
		))
		.exhaustive();
}

function TwoFactorQRCode({ totpUri }: TwoFactorQRCodeProps) {
	return (
		<QRCodeSVG
			value={totpUri}
			size={256}
			marginSize={2}
			className="rounded-md"
			title={t({
				comment: "Accessible title for QR code image shown during two-factor setup",
				message: "QR code for two-step verification",
			})}
		/>
	);
}
