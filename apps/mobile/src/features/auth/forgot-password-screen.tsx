// Forgot password: mails a reset link. The answer is the same whether or not the address has an account, so the screen
// never tells anyone which emails are registered. The link opens the Reset screen in the app (or the web page).
import { useLingui } from "@lingui/react/macro";
import { useRouter } from "expo-router";
import { useState } from "react";
import { ErrorAlert } from "./error-alert";
import { AuthFrame } from "./frame";
import { useAuthAction } from "./use-auth-action";
import { useAuthServer } from "./use-auth-server";
import { requestPasswordReset } from "@/auth/native-sign-in";
import { routes } from "@/routes";
import { Alert, Button, FieldError, Input, Label, TextField } from "@/ui";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type ForgotPasswordScreenProps = { email?: string | undefined };

export function ForgotPasswordScreen({ email: initialEmail = "" }: ForgotPasswordScreenProps) {
	const { t } = useLingui();
	const router = useRouter();
	const { server } = useAuthServer();
	const [email, setEmail] = useState(initialEmail);
	const [submitted, setSubmitted] = useState(false);
	const [sentTo, setSentTo] = useState<string | null>(null);
	const { pending, error, run } = useAuthAction("reset");
	const invalid = submitted && !emailPattern.test(email.trim());

	const submit = async () => {
		setSubmitted(true);
		const address = email.trim().toLowerCase();
		if (!emailPattern.test(address)) return;
		const done = await run(async () => {
			await requestPasswordReset(server, address);
			return true;
		});
		if (done) setSentTo(address);
	};

	if (sentTo) {
		return (
			<AuthFrame
				title={t`Check your email`}
				description={t`If ${sentTo} has a Rezumi account, a link to choose a new password is on its way. It works for one hour.`}
				testID="forgot-password-sent"
			>
				<Button size="lg" onPress={() => router.replace(routes.emailSignIn(sentTo))}>
					<Button.Label>{t`Back to sign in`}</Button.Label>
				</Button>
			</AuthFrame>
		);
	}

	return (
		<AuthFrame
			title={t`Reset your password`}
			description={t`Enter the email of your account. We'll send you a link to choose a new password.`}
			testID="forgot-password"
		>
			<ErrorAlert message={error} />
			<TextField isInvalid={invalid} isRequired>
				<Label>{t`Email`}</Label>
				<Input
					value={email}
					onChangeText={setEmail}
					accessibilityLabel={t`Email`}
					placeholder={t`name@example.com`}
					keyboardType="email-address"
					autoCapitalize="none"
					autoCorrect={false}
					autoComplete="email"
					textContentType="username"
					returnKeyType="send"
					onSubmitEditing={() => void submit()}
					testID="email"
				/>
				<FieldError>{t`Enter an email like name@example.com.`}</FieldError>
			</TextField>
			<Button size="lg" isDisabled={pending} onPress={() => void submit()} testID="forgot-password-submit">
				<Button.Label>{pending ? t`Sending…` : t`Send reset link`}</Button.Label>
			</Button>
			<Alert status="default">
				<Alert.Indicator />
				<Alert.Content>
					<Alert.Description>{t`Signed in with Apple, Google or another provider? You have no password here: sign in with that provider instead.`}</Alert.Description>
				</Alert.Content>
			</Alert>
		</AuthFrame>
	);
}
