import type { AuthSession } from "@rezumi/auth/types";
import { Avatar, Button, Description, FieldError, Input, InputGroup, Label, Spinner, TextField } from "@heroui/react";
import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouteContext, useRouter } from "@tanstack/react-router";
import { useRef, useState } from "react";
import z from "zod";
import { toast } from "@rezumi/ui/components/toast";
import { getInitials } from "@rezumi/utils/string";
import { cn } from "@rezumi/utils/style";
import { SettingsSection } from "../section";
import { authClient } from "@/libs/auth/client";
import { getReadableErrorMessage } from "@/libs/error-message";
import { isImeComposing } from "@/libs/keyboard";
import { orpc } from "@/libs/orpc/client";
import { sessionQueryKey } from "@/libs/root-context";

const nameSchema = z.string().trim().min(1).max(64);
const usernameSchema = z
	.string()
	.trim()
	.min(3)
	.max(64)
	.regex(/^[a-z0-9._-]+$/);
const emailSchema = z.email().trim();

type FieldProps = {
	label: string;
	value: string;
	/** Saves the new value; resolves to an error message, or null when it saved. */
	save: (value: string) => Promise<string | null>;
	validate: (value: string) => string | null;
	prefix?: string;
	hint?: React.ReactNode;
	type?: "text" | "email";
	autoComplete?: string;
	className?: string;
};

/** A text setting that saves when it loses focus. Invalid or failed values stay, with the reason under them. */
function SavedField({
	label,
	value,
	save,
	validate,
	prefix,
	hint,
	type = "text",
	autoComplete,
	className,
}: FieldProps) {
	const [draft, setDraft] = useState(value);
	const [error, setError] = useState<string | null>(null);
	const [saving, setSaving] = useState(false);

	const commit = async () => {
		const next = draft.trim();
		if (next === value) return setError(null);
		const invalid = validate(next);
		if (invalid) return setError(invalid);
		setSaving(true);
		let failure: string | null;
		try {
			failure = await save(next);
		} catch {
			failure = t`Couldn't save. Try again.`;
		}
		setSaving(false);
		setError(failure);
	};

	const inputProps = {
		"aria-busy": saving || undefined,
		onBlur: () => void commit(),
		onKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => {
			if (isImeComposing(event)) return;
			if (event.key === "Enter") event.currentTarget.blur();
			if (event.key === "Escape") {
				setDraft(value);
				setError(null);
			}
		},
	};

	return (
		<TextField
			fullWidth
			type={type}
			value={draft}
			{...(autoComplete ? { autoComplete } : {})}
			isInvalid={Boolean(error)}
			// The save runs on blur and our own checks decide validity, so the browser's native validation stays out.
			validationBehavior="aria"
			onChange={setDraft}
			className={cn("content-start gap-1.5", className)}
		>
			<Label>{label}</Label>
			{prefix ? (
				<InputGroup fullWidth variant="secondary">
					<InputGroup.Prefix>
						<span dir="ltr">{prefix}</span>
					</InputGroup.Prefix>
					<InputGroup.Input {...inputProps} />
				</InputGroup>
			) : (
				<Input variant="secondary" {...inputProps} />
			)}
			{hint && <Description>{hint}</Description>}
			{/* Saving runs on blur, so focus has left the field: the alert role is what announces the reason. */}
			<FieldError>{error ? <span role="alert">{error}</span> : null}</FieldError>
		</TextField>
	);
}

type ProfileSectionProps = { session: AuthSession };

export function ProfileSection({ session }: ProfileSectionProps) {
	const router = useRouter();
	const queryClient = useQueryClient();
	const context = useRouteContext({ strict: false });
	const smtpEnabled = context.flags?.smtpEnabled ?? false;
	const user = session.user;
	const host = window.location.host;

	const updateUser = async (patch: Parameters<typeof authClient.updateUser>[0]) => {
		const { error } = await authClient.updateUser(patch);
		if (error) return getReadableErrorMessage(error, t`Couldn't save. Try again.`);
		await queryClient.invalidateQueries({ queryKey: sessionQueryKey });
		await router.invalidate();
		return null;
	};

	const changeEmail = async (email: string) => {
		const { error } = await authClient.changeEmail({ newEmail: email, callbackURL: "/dashboard/settings/account" });
		if (error) return getReadableErrorMessage(error, t`Couldn't change the email. Try again.`);
		// A verified address approves the change first; Better Auth then sends the new address its own link.
		const currentEmail = user.email;
		toast.add({
			type: "success",
			description: user.emailVerified
				? t`We sent a link to ${currentEmail} to approve the change. Then open the link we send to ${email}.`
				: t`We sent a confirmation link to ${email}. Open it to finish the change.`,
		});
		return null;
	};

	const resendVerification = async () => {
		const { error } = await authClient.sendVerificationEmail({
			email: user.email,
			callbackURL: "/dashboard/settings/account",
		});
		toast.add(
			error
				? { type: "error", description: getReadableErrorMessage(error, t`Couldn't send the email. Try again.`) }
				: { type: "success", description: t`We sent a new verification link to ${user.email}.` },
		);
	};

	return (
		<SettingsSection title={<Trans>Profile</Trans>}>
			<ProfilePhoto name={user.name} image={user.image ?? null} onChange={(image) => updateUser({ image })} />

			<div className="grid gap-3 sm:grid-cols-2">
				<SavedField
					label={t`Name`}
					value={user.name}
					autoComplete="name"
					validate={(value) => (nameSchema.safeParse(value).success ? null : t`Enter a name, up to 64 characters.`)}
					save={(name) => updateUser({ name })}
				/>
				<SavedField
					label={t`Username`}
					value={user.username ?? ""}
					prefix={`${host}/`}
					autoComplete="username"
					validate={(value) =>
						usernameSchema.safeParse(value).success
							? null
							: t`Use 3 to 64 lowercase letters, numbers, dots, hyphens and underscores.`
					}
					save={(username) => updateUser({ username, displayUsername: username })}
				/>
				<SavedField
					className="sm:col-span-2"
					type="email"
					label={t`Email`}
					value={user.email}
					autoComplete="email"
					validate={(value) => (emailSchema.safeParse(value).success ? null : t`Enter a valid email address.`)}
					save={changeEmail}
					hint={
						<>
							<Trans>
								Changing it sends a confirmation to the new address. Your username is part of every public link.
							</Trans>{" "}
							{user.emailVerified ? null : smtpEnabled ? (
								<button
									type="button"
									className="underline underline-offset-2 hover:text-foreground"
									onClick={() => void resendVerification()}
								>
									<Trans>Not verified yet. Resend the link</Trans>
								</button>
							) : (
								<Trans>Email delivery isn't set up on this server, so the address isn't verified.</Trans>
							)}
						</>
					}
				/>
			</div>
		</SettingsSection>
	);
}

type ProfilePhotoProps = {
	name: string;
	image: string | null;
	onChange: (image: string | null) => Promise<string | null>;
};

/** The account photo, shown in the app. Resumes keep their own picture. */
function ProfilePhoto({ name, image, onChange }: ProfilePhotoProps) {
	const input = useRef<HTMLInputElement>(null);
	const upload = useMutation(orpc.storage.uploadFile.mutationOptions({ meta: { noInvalidate: true } }));

	const choose = (file: File | undefined) => {
		if (!file) return;
		upload.mutate(file, {
			onSuccess: async ({ url }) => {
				const failure = await onChange(url);
				if (failure) toast.add({ type: "error", description: failure });
			},
			onError: (error) =>
				toast.add({
					type: "error",
					description: getReadableErrorMessage(error, t`Couldn't upload the photo. Try again.`),
				}),
			onSettled: () => {
				if (input.current) input.current.value = "";
			},
		});
	};

	return (
		<div className="flex items-center gap-3.5">
			<Avatar color="accent" variant="soft" className="size-14">
				{image && <Avatar.Image src={image} alt="" />}
				<Avatar.Fallback className="text-lg font-semibold">{getInitials(name)}</Avatar.Fallback>
			</Avatar>
			<input
				ref={input}
				type="file"
				accept="image/*"
				className="sr-only"
				tabIndex={-1}
				aria-hidden
				onChange={(event) => choose(event.target.files?.[0])}
			/>
			<Button size="sm" variant="secondary" isPending={upload.isPending} onPress={() => input.current?.click()}>
				{upload.isPending && <Spinner size="sm" color="current" aria-hidden />}
				<Trans>Change photo</Trans>
			</Button>
			{image && (
				<Button size="sm" variant="ghost" onPress={() => void onChange(null)}>
					<Trans>Remove photo</Trans>
				</Button>
			)}
		</div>
	);
}
