// Reset (from the reset email's link, `/auth/reset-password?token=`): choose a new password. Success signs every other
// device out (the server revokes sessions and app tokens), so the person signs in again with the new password.
import { useLingui } from "@lingui/react/macro";
import { useRouter } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { ErrorAlert } from "./error-alert";
import { AuthFrame } from "./frame";
import { passwordLimits, passwordStrength } from "./password-strength";
import { useAuthAction } from "./use-auth-action";
import { useAuthServer } from "./use-auth-server";
import { resetPassword } from "@/auth/native-sign-in";
import { routes } from "@/routes";
import { Button, Description, FieldError, Input, Label, TextField, showToast } from "@/ui";

type ResetPasswordScreenProps = { token?: string | undefined; error?: string | undefined };

export function ResetPasswordScreen({ token, error: linkError }: ResetPasswordScreenProps) {
	const { t } = useLingui();
	const router = useRouter();
	const { server } = useAuthServer();
	const [password, setPassword] = useState("");
	const [submitted, setSubmitted] = useState(false);
	const { pending, error, run } = useAuthAction("reset");
	const tooShort = password.length < passwordLimits.min;
	const strength = passwordStrength(password);

	if (!token || linkError) {
		return (
			<AuthFrame
				title={t`This link has expired`}
				description={t`Reset links work once, for one hour. Ask for a new one.`}
				testID="reset-password-expired"
			>
				<Button size="lg" onPress={() => router.replace(routes.forgotPassword())}>
					<Button.Label>{t`Send a new link`}</Button.Label>
				</Button>
			</AuthFrame>
		);
	}

	const submit = async () => {
		setSubmitted(true);
		if (tooShort || password.length > passwordLimits.max) return;
		const done = await run(async () => {
			await resetPassword(server, token, password);
			return true;
		});
		if (!done) return;
		showToast({ title: t`Password changed. Sign in with your new password.`, variant: "success" });
		router.replace(routes.emailSignIn());
	};

	return (
		<AuthFrame
			title={t`Choose a new password`}
			description={t`After this, you're signed out on your other devices.`}
			testID="reset-password"
		>
			<ErrorAlert message={error} />
			<View className="gap-2">
				<TextField isInvalid={submitted && tooShort} isRequired>
					<Label>{t`New password`}</Label>
					<Input
						value={password}
						onChangeText={setPassword}
						accessibilityLabel={t`New password`}
						secureTextEntry
						autoCapitalize="none"
						autoCorrect={false}
						autoComplete="new-password"
						textContentType="newPassword"
						passwordRules={`minlength: ${passwordLimits.min}; maxlength: ${passwordLimits.max};`}
						maxLength={passwordLimits.max}
						autoFocus
						returnKeyType="go"
						onSubmitEditing={() => void submit()}
						testID="new-password"
					/>
					{submitted && tooShort ? (
						<FieldError>{t`Use at least ${passwordLimits.min} characters.`}</FieldError>
					) : (
						<Description>
							{strength === "strong"
								? t`Strong password.`
								: t`At least ${passwordLimits.min} characters. A longer password is stronger.`}
						</Description>
					)}
				</TextField>
			</View>
			<Button size="lg" isDisabled={pending} onPress={() => void submit()} testID="reset-password-submit">
				<Button.Label>{pending ? t`Saving…` : t`Save new password`}</Button.Label>
			</Button>
		</AuthFrame>
	);
}
